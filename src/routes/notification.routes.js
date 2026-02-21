// notification.routes.js
const router = require('express').Router();
const { getNotifications, getPreview, markAsRead, markAllRead } = require('../controllers/notification.controller');
const { authenticate, isMerchant } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);
router.get('/', getNotifications);
router.get('/preview', getPreview);
router.post('/mark-all-read', markAllRead);
router.patch('/:id/read', markAsRead);

module.exports = router;
