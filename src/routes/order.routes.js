const router = require('express').Router();
const { getOrders, getOrder, getOrderHistory, updateStatus, createOrder } = require('../controllers/order.controller');
const { authenticate, isMerchant } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);

router.get('/', getOrders);
router.get('/history', getOrderHistory);
router.get('/:id', getOrder);
router.post('/', createOrder);
router.patch('/:id/status', updateStatus);

module.exports = router;
