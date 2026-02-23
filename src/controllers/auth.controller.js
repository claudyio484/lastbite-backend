const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = uuidv4();
  return { accessToken, refreshToken };
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: { include: { subscription: true } } },
    });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    if (user.tenantId) {
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'LOGIN',
          details: { email },
          ip: req.ip,
        },
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/register (merchant registration)
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, storeName, storeSlug } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          slug: storeSlug || storeName.toLowerCase().replace(/\s+/g, '-'),
          email,
          phone,
        },
      });

      // Create subscription (FREE trial)
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'FREE',
          status: 'TRIAL',
          commissionRate: 0.05,
          trialEndsAt,
        },
      });

      // Create owner user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: 'MERCHANT_OWNER',
        },
      });

      // Default categories
      const defaultCategories = ['Produce', 'Dairy', 'Bakery', 'Meat', 'Pantry'];
      await tx.category.createMany({
        data: defaultCategories.map(name => ({
          tenantId: tenant.id,
          name,
          slug: name.toLowerCase(),
        })),
      });

      return { tenant, user };
    });

    const { accessToken, refreshToken } = generateTokens(result.user.id);

    await prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Send verification OTP email
    try {
      const { sendEmail } = require('../config/mailer');
      const { verificationOtpEmail } = require('../utils/emailTemplates');
      const code = Math.floor(1000 + Math.random() * 9000).toString();

      await prisma.otpCode.create({
        data: {
          email: result.user.email,
          code,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const template = verificationOtpEmail(code, firstName);
      await sendEmail({ to: email, subject: template.subject, html: template.html });
      console.log(`Verification OTP for ${email}: ${code}`);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        tenant: result.tenant,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/refresh
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(stored.userId);

    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    await prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const { password: _, ...user } = req.user;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { login, register, refresh, logout, me };
