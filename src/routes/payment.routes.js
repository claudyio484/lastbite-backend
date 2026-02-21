// payment.routes.js
const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate, isMerchant } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);

router.get('/', async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { tenantId: req.tenantId },
    include: { order: { select: { orderNumber: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: payments });
});

// Webhook for UAE payment gateway (NoonPay, Talabat, Zina)
router.post('/webhook', async (req, res) => {
  try {
    const { orderId, gatewayRef, status, amount } = req.body;
    const payment = await prisma.payment.update({
      where: { orderId },
      data: {
        status: status === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
        gatewayRef,
        gatewayResponse: req.body,
        paidAt: status === 'SUCCESS' ? new Date() : null,
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
