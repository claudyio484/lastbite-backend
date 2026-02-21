const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// ─── Verify JWT ───────────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: { include: { subscription: true } } },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ─── Role Guards ──────────────────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

const isMerchant = requireRole('MERCHANT_OWNER', 'MERCHANT_ADMIN', 'MERCHANT_STAFF');
const isMerchantOwner = requireRole('MERCHANT_OWNER');
const isMerchantManager = requireRole('MERCHANT_OWNER', 'MERCHANT_ADMIN');
const isSuperAdmin = requireRole('SUPER_ADMIN');

// ─── Subscription Plan Guards ─────────────────────────────────────────────────
const requirePlan = (...plans) => (req, res, next) => {
  const sub = req.user.tenant?.subscription;
  if (!sub || !plans.includes(sub.plan)) {
    return res.status(403).json({
      success: false,
      message: `This feature requires one of the following plans: ${plans.join(', ')}`,
      upgrade: true,
    });
  }
  next();
};

// Middleware to attach plan info to all merchant requests
const attachPlanInfo = (req, res, next) => {
  const sub = req.user.tenant?.subscription;
  req.plan = sub?.plan || 'FREE';
  req.commissionRate = sub?.commissionRate || 0.05;
  next();
};

module.exports = {
  authenticate,
  requireRole,
  isMerchant,
  isMerchantOwner,
  isMerchantManager,
  isSuperAdmin,
  requirePlan,
  attachPlanInfo,
};
