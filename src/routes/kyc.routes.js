// kyc.routes.js
const router = require('express').Router();
const { getKycStatus, submitStep1, submitStep2, submitStep3 } = require('../controllers/kyc.controller');
const { authenticate, isMerchantOwner } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchantOwner);
router.get('/status', getKycStatus);
router.post('/step1', submitStep1);
router.post('/step2', submitStep2);
router.post('/step3', submitStep3);

module.exports = router;
