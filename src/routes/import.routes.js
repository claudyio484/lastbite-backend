'use strict';

const router = require('express').Router();
const { authenticate, isMerchantManager } = require('../middleware/auth.middleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
  parseFile,
  validateImport,
  confirmImport,
  getRules,
  upsertRules,
} = require('../controllers/import.controller');

// All routes require authentication + OWNER or ADMIN role
router.use(authenticate, isMerchantManager);

// POST /parse — Upload CSV/XLSX and get column names + preview
router.post('/parse', uploadSingle, parseFile);

// POST /validate — Run full pipeline preview (no DB write)
router.post('/validate', validateImport);

// POST /confirm — Execute import and persist deals
router.post('/confirm', confirmImport);

// GET /rules — Retrieve saved discount rules for this store
router.get('/rules', getRules);

// PUT /rules — Create or update discount rules
router.put('/rules', upsertRules);

module.exports = router;
