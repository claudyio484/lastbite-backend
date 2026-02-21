const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

// GET /api/users - list team members
const getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const where = {
      tenantId: req.tenantId,
      role: { not: 'CUSTOMER' },
    };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, role: true, isActive: true, avatar: true,
        jobTitle: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/users/:id
const getUser = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, role: true, isActive: true, avatar: true,
        jobTitle: true, lastLoginAt: true, createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Get recent activity from audit logs
    const recentActivity = await prisma.auditLog.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({ success: true, data: { ...user, recentActivity } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/users - Add team member (BUSINESS plan only for multi-user)
const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role = 'MERCHANT_STAFF', jobTitle } = req.body;
    const tenantId = req.tenantId;

    // Check plan allows multi-user
    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription || subscription.plan === 'FREE') {
      return res.status(403).json({
        success: false,
        message: 'Multi-user access requires the Enterprise plan',
        upgrade: true,
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    // Generate temp password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: { tenantId, email, password: hashedPassword, firstName, lastName, phone, role, jobTitle },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, role: true, isActive: true, jobTitle: true, createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: req.user.id,
        action: 'ADDED_USER',
        entity: 'user',
        entityId: user.id,
        details: { email, role },
      },
    });

    res.status(201).json({ success: true, data: user, tempPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const { firstName, lastName, phone, role, jobTitle, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { firstName, lastName, phone, role, jobTitle, isActive },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, role: true, isActive: true, jobTitle: true,
      },
    });

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    // Don't allow deleting yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };
