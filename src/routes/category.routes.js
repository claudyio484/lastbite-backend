// category.routes.js
const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate, isMerchant, isMerchantManager } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);

router.get('/', async (req, res) => {
  const categories = await prisma.category.findMany({ where: { tenantId: req.tenantId } });
  res.json({ success: true, data: categories });
});

router.post('/', isMerchantManager, async (req, res) => {
  const { name } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const category = await prisma.category.create({
    data: { tenantId: req.tenantId, name, slug },
  });
  res.status(201).json({ success: true, data: category });
});

router.delete('/:id', isMerchantManager, async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = router;
