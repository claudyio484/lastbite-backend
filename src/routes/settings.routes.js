const router = require('express').Router();
const {
  getProfile, updateProfile, getStore, updateStore,
  updateLanguage, updateAppearance, updateNotifications,
  getBilling, upgradePlan,
} = require('../controllers/settings.controller');
const { authenticate, isMerchant, isMerchantOwner } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/store', getStore);
router.put('/store', isMerchantOwner, updateStore);
router.put('/language', updateLanguage);
router.put('/appearance', updateAppearance);
router.put('/notifications', updateNotifications);
router.get('/billing', getBilling);
router.post('/billing/upgrade', isMerchantOwner, upgradePlan);

module.exports = router;
