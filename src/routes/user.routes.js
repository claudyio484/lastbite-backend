// user.routes.js
const express = require('express');
const router = express.Router();
const { getUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/user.controller');
const { authenticate, isMerchant, isMerchantOwner, isMerchantManager } = require('../middleware/auth.middleware');

router.use(authenticate, isMerchant);
router.get('/', getUsers);
router.get('/:id', getUser);
router.post('/', isMerchantOwner, createUser);
router.put('/:id', isMerchantManager, updateUser);
router.delete('/:id', isMerchantOwner, deleteUser);

module.exports = router;
