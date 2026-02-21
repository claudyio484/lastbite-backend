// analytics.routes.js
const router = require('express').Router();
const { getOverview } = require('../controllers/analytics.controller');
const { authenticate, isMerchant } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);
router.get('/overview', getOverview);

module.exports = router;
