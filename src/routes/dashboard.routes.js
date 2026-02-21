// dashboard.routes.js
const router = require('express').Router();
const { getStats, getActionNeeded } = require('../controllers/dashboard.controller');
const { authenticate, isMerchant } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);
router.get('/stats', getStats);
router.get('/action-needed', getActionNeeded);

module.exports = router;
