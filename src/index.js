require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// Trust proxy (required for Vercel / reverse-proxy environments)
app.set('trust proxy', 1);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin === o || origin.endsWith('.vercel.app'))) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/dashboard',     require('./routes/dashboard.routes'));
app.use('/api/products',      require('./routes/product.routes'));
app.use('/api/categories',    require('./routes/category.routes'));
app.use('/api/orders',        require('./routes/order.routes'));
app.use('/api/payments',      require('./routes/payment.routes'));
app.use('/api/users',         require('./routes/user.routes'));
app.use('/api/messages',      require('./routes/message.routes'));
app.use('/api/settings',      require('./routes/settings.routes'));
app.use('/api/analytics',     require('./routes/analytics.routes'));
app.use('/api/notifications',  require('./routes/notification.routes'));
app.use('/api/kyc',            require('./routes/kyc.routes'));
app.use('/api/admin',          require('./routes/admin.routes'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;
