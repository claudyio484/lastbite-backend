// admin.routes.js - Super Admin panel
const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate, isSuperAdmin } = require('../middleware/auth.middleware');
const { listKycApplications, reviewKyc } = require('../controllers/kyc.controller');

router.use(authenticate, isSuperAdmin);

// GET all merchants
router.get('/merchants', async (req, res) => {
  try {
    const { search, plan, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: { subscription: true, _count: { select: { orders: true, products: true, users: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({ success: true, data: tenants, pagination: { total, page: parseInt(page) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET merchant detail
router.get('/merchants/:id', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        subscription: true,
        users: { select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true } },
        _count: { select: { orders: true, products: true } },
      },
    });
    if (!tenant) return res.status(404).json({ success: false, message: 'Merchant not found' });
    res.json({ success: true, data: tenant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH merchant status (activate/deactivate)
router.patch('/merchants/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { isActive },
    });
    res.json({ success: true, data: tenant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH subscription plan (manual override by admin)
router.patch('/merchants/:id/subscription', async (req, res) => {
  try {
    const { plan, status, commissionRate } = req.body;
    const priceMap = { FREE: 0, PROFESSIONAL: 99, ENTERPRISE: 299 };
    const subscription = await prisma.subscription.update({
      where: { tenantId: req.params.id },
      data: {
        plan,
        status,
        commissionRate: commissionRate ?? (plan === 'FREE' ? 0.05 : 0),
        priceAed: priceMap[plan] ?? 0,
      },
    });
    res.json({ success: true, data: subscription });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET global stats
router.get('/stats', async (req, res) => {
  try {
    const [totalMerchants, activeMerchants, totalRevenue, planBreakdown] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { commissionAmount: true } }),
      prisma.subscription.groupBy({ by: ['plan'], _count: { plan: true } }),
    ]);

    res.json({
      success: true,
      data: {
        totalMerchants,
        activeMerchants,
        totalCommissionRevenue: totalRevenue._sum.commissionAmount || 0,
        planBreakdown,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { tenantId, userId, page = 1, limit = 50 } = req.query;
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// KYC Review (Super Admin)
router.get('/kyc', listKycApplications);
router.patch('/kyc/:tenantId/review', reviewKyc);

module.exports = router;
