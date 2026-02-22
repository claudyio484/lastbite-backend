// category.routes.js
const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate, isMerchant, isMerchantManager } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);

router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ where: { tenantId: req.tenantId } });
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', isMerchantManager, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const category = await prisma.category.create({
      data: { tenantId: req.tenantId, name, slug },
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', isMerchantManager, async (req, res) => {
  try {
    // Verify category belongs to this tenant
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
