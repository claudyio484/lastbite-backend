const router = require('express').Router();
const {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, toggleFeatured, getExpiringProducts,
} = require('../controllers/product.controller');
const { authenticate, isMerchant, isMerchantManager } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);

router.get('/', getProducts);
router.get('/expiring', getExpiringProducts);
router.get('/:id', getProduct);
router.post('/', isMerchantManager, createProduct);
router.put('/:id', isMerchantManager, updateProduct);
router.delete('/:id', isMerchantManager, deleteProduct);
router.patch('/:id/toggle-featured', isMerchantManager, toggleFeatured);

module.exports = router;
