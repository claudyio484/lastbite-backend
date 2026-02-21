// message.routes.js
const router = require('express').Router();
const { getConversations, getMessages, sendMessage, getUnreadCount } = require('../controllers/message.controller');
const { authenticate, isMerchant } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);
router.get('/unread-count', getUnreadCount);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getMessages);
router.post('/conversations/:id/send', sendMessage);

module.exports = router;
