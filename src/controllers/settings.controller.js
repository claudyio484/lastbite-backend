const prisma = require('../config/prisma');

// GET /api/settings/profile
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, avatar: true, jobTitle: true, createdAt: true,
        tenant: { select: { name: true } },
      },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/settings/profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, jobTitle, emiratesIdExpiry } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { firstName, lastName, phone, jobTitle },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true },
    });

    if (emiratesIdExpiry) {
      await prisma.tenant.update({
        where: { id: req.tenantId },
        data: { emiratesIdExpiry: new Date(emiratesIdExpiry) },
      });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/settings/store
const getStore = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true, name: true, slug: true, email: true, phone: true,
        logo: true, description: true, address: true, city: true, country: true,
        isActive: true, storeStatus: true, tradeLicence: true,
        tradeLicenceExpiry: true, emiratesIdExpiry: true,
      },
    });
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/settings/store
const updateStore = async (req, res) => {
  try {
    const { name, description, phone, address, city, storeStatus, tradeLicenceExpiry } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { name, description, phone, address, city, storeStatus, tradeLicenceExpiry: tradeLicenceExpiry ? new Date(tradeLicenceExpiry) : undefined },
    });
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/settings/language
const updateLanguage = async (req, res) => {
  try {
    const { language } = req.body; // 'en' or 'ar'
    await prisma.tenant.update({ where: { id: req.tenantId }, data: { language } });
    res.json({ success: true, message: 'Language updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/settings/appearance
const updateAppearance = async (req, res) => {
  try {
    const { darkMode } = req.body;
    await prisma.tenant.update({ where: { id: req.tenantId }, data: { darkMode } });
    res.json({ success: true, message: 'Appearance updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/settings/notifications
const updateNotifications = async (req, res) => {
  try {
    const { emailNotifications, pushNotifications, marketingUpdates } = req.body;
    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { emailNotifications, pushNotifications, marketingUpdates },
    });
    res.json({ success: true, message: 'Notifications updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/settings/billing
const getBilling = async (req, res) => {
  try {
    const [subscription, invoices] = await Promise.all([
      prisma.subscription.findUnique({ where: { tenantId: req.tenantId } }),
      prisma.invoice.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    res.json({ success: true, data: { subscription, invoices } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/settings/billing/upgrade
const upgradePlan = async (req, res) => {
  try {
    const { plan } = req.body; // 'PROFESSIONAL' or 'ENTERPRISE'
    const priceMap = { PROFESSIONAL: 99, ENTERPRISE: 299 };
    const price = priceMap[plan];
    if (!price) return res.status(400).json({ success: false, message: 'Invalid plan' });

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const subscription = await prisma.subscription.update({
      where: { tenantId: req.tenantId },
      data: {
        plan,
        status: 'ACTIVE',
        priceAed: price,
        commissionRate: 0,
        nextBillingDate,
        startDate: new Date(),
      },
    });

    res.json({ success: true, data: subscription, message: `Upgraded to ${plan} plan` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getProfile, updateProfile, getStore, updateStore,
  updateLanguage, updateAppearance, updateNotifications,
  getBilling, upgradePlan,
};
