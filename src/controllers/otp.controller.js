const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Generate 4-digit OTP
const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

// POST /api/auth/send-otp
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number required' });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate old OTPs for this phone
    await prisma.otpCode.updateMany({
      where: { phone, used: false },
      data: { used: true },
    });

    await prisma.otpCode.create({
      data: { phone, code, expiresAt },
    });

    // TODO: Integrate UAE SMS provider (e.g. Twilio, Unifonic, or Etisalat SMS)
    // For now, return code in dev mode only
    console.log(`📱 OTP for ${phone}: ${code}`);

    res.json({
      success: true,
      message: `Verification code sent to ${phone}`,
      ...(process.env.NODE_ENV === 'development' && { code }), // Only in dev
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;

    const otp = await prisma.otpCode.findFirst({
      where: { phone, code, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    }

    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });

    // Mark user phone as verified
    await prisma.user.updateMany({
      where: { phone },
      data: { isVerified: true },
    });

    res.json({ success: true, message: 'Phone verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    // TODO: Send email via nodemailer / SendGrid / Gmail API
    console.log(`📧 Password reset link for ${email}: ${resetUrl}`);

    res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    });

    res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendOtp, verifyOtp, forgotPassword, resetPassword };
