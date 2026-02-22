const prisma = require('../config/prisma');

const generateOrderNumber = () => {
  return `#${Math.floor(1000 + Math.random() * 9000)}`;
};

// GET /api/orders
const getOrders = async (req, res) => {
  try {
    const { status, search, type, page = 1, limit = 20 } = req.query;
    const tenantId = req.tenantId;
    const where = { tenantId };
    if (status && status !== 'All') where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, avatar: true, phone: true } },
          items: { include: { product: { select: { name: true } } } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success: true, data: orders, pagination: { total, page: parseInt(page) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/orders/history
const getOrderHistory = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId,
        status: { in: ['DELIVERED', 'RETURNED', 'CANCELLED'] },
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/orders/:id
const getOrder = async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
        payment: true,
      },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/orders/:id/status - Accept, Preparing, Ready, Deliver
const updateStatus = async (req, res) => {
  try {
    const { status, cancellationReason } = req.body;

    const validTransitions = {
      NEW: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
    };

    const order = await prisma.order.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Cannot transition from ${order.status} to ${status}` });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status,
        cancellationReason: cancellationReason || null,
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        items: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: `ORDER_STATUS_${status}`,
        entity: 'order',
        entityId: order.id,
        details: { from: order.status, to: status, cancellationReason },
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/orders (create order - used by client app)
const createOrder = async (req, res) => {
  try {
    const { customerId, items, type = 'DELIVERY', shippingAddress, notes, lat, lng } = req.body;
    const tenantId = req.tenantId;

    // Get products and check stock
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, status: 'ACTIVE' },
    });

    if (products.length !== items.length) {
      return res.status(400).json({ success: false, message: 'Some products are unavailable' });
    }

    let subtotal = 0;
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const total = product.finalPrice * item.quantity;
      subtotal += total;
      return {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.finalPrice,
        totalPrice: total,
      };
    });

    // Get commission rate
    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    const commissionRate = subscription?.plan === 'FREE' ? (subscription?.commissionRate || 0.05) : 0;
    const commissionAmount = subtotal * commissionRate;

    const order = await prisma.order.create({
      data: {
        tenantId,
        customerId,
        orderNumber: generateOrderNumber(),
        type,
        subtotal,
        totalAmount: subtotal,
        commissionAmount,
        shippingAddress,
        lat: lat || null,
        lng: lng || null,
        notes,
        items: { create: orderItems },
      },
      include: { items: true, customer: { select: { firstName: true, lastName: true } } },
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getOrders, getOrder, getOrderHistory, updateStatus, createOrder };
