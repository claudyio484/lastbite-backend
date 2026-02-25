const prisma = require('../config/prisma');

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { category, status, search, page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

    const where = { tenantId };
    if (category && category !== 'All') where.category = { name: category };
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/products/:id
const getProduct = async (req, res) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { category: true },
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      name, description, sku, barcode, categoryId,
      originalPrice, discountPct = 0, stock = 0, minStock = 0,
      isFeatured = false, expiryDate, images = [], status = 'ACTIVE',
    } = req.body;

    if (!name || originalPrice === undefined) {
      return res.status(400).json({ success: false, message: 'Name and originalPrice are required' });
    }

    const finalPrice = originalPrice - (originalPrice * discountPct / 100);

    const product = await prisma.product.create({
      data: {
        tenantId,
        categoryId,
        name,
        description,
        sku,
        barcode,
        originalPrice,
        discountPct,
        finalPrice,
        stock,
        minStock,
        isFeatured,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        images,
        status,
      },
      include: { category: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: { tenantId, userId: req.user.id, action: 'CREATE_PRODUCT', entity: 'product', entityId: product.id },
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error('Create product error:', err);
    if (err.code === 'P2002') {
      const fields = err.meta?.target || [];
      return res.status(409).json({ success: false, message: `Duplicate value for: ${fields.join(', ')}` });
    }
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    // Verify product belongs to this tenant
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    const { originalPrice, discountPct, ...rest } = req.body;
    let updateData = { ...rest };

    if (originalPrice !== undefined) {
      const disc = discountPct ?? existing.discountPct ?? 0;
      updateData.originalPrice = originalPrice;
      updateData.discountPct = disc;
      updateData.finalPrice = originalPrice - (originalPrice * disc / 100);
    }

    if (updateData.expiryDate) updateData.expiryDate = new Date(updateData.expiryDate);

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
      include: { category: true },
    });

    await prisma.auditLog.create({
      data: { tenantId: req.tenantId, userId: req.user.id, action: 'UPDATE_PRODUCT', entity: 'product', entityId: product.id },
    });

    res.json({ success: true, data: product });
  } catch (err) {
    console.error('Update product error:', err);
    if (err.code === 'P2002') {
      const fields = err.meta?.target || [];
      return res.status(409).json({ success: false, message: `Duplicate value for: ${fields.join(', ')}` });
    }
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    // Verify product belongs to this tenant
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    await prisma.product.delete({ where: { id: req.params.id } });

    await prisma.auditLog.create({
      data: { tenantId: req.tenantId, userId: req.user.id, action: 'DELETE_PRODUCT', entity: 'product', entityId: req.params.id },
    });

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/products/:id/toggle-featured
const toggleFeatured = async (req, res) => {
  try {
    const product = await prisma.product.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { isFeatured: !product.isFeatured },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/products/expiring - items expiring within 48h
const getExpiringProducts = async (req, res) => {
  try {
    const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const products = await prisma.product.findMany({
      where: {
        tenantId: req.tenantId,
        expiryDate: { gte: new Date(), lte: in48h },
        status: 'ACTIVE',
      },
      include: { category: true },
      orderBy: { expiryDate: 'asc' },
    });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, toggleFeatured, getExpiringProducts };
