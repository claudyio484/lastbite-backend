const router = require('express').Router();
const { login, register, refresh, logout, me } = require('../controllers/auth.controller');
const { sendOtp, verifyOtp, forgotPassword, resetPassword } = require('../controllers/otp.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);

// OTP - Mobile verification
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// Password reset
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
