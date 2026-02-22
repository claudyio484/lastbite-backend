// payment.routes.js
const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate, isMerchant } = require('../middleware/auth.middleware');

// Webhook for UAE payment gateway (NoonPay, Talabat, Zina)
// Must be BEFORE auth middleware so the gateway can reach it
router.post('/webhook', async (req, res) => {
  try {
    const { orderId, gatewayRef, status, amount } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, message: 'orderId and status are required' });
    }

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found for this order' });
    }

    await prisma.payment.update({
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
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Protected routes below
router.use(authenticate, isMerchant);

router.get('/', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { tenantId: req.tenantId },
      include: { order: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
