const express = require('express');
const {
  getAllUsers,
  getUsersByRole,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Superadmin only routes
router.get('/', authorize('superadmin'), getAllUsers);
router.put('/:id', authorize('superadmin'), updateUser);
router.delete('/:id', authorize('superadmin'), deleteUser);

// Superadmin and teacher routes
router.get('/role/:role', authorize('superadmin', 'teacher'), getUsersByRole);
router.get('/:id', authorize('superadmin', 'teacher'), getUserById);

module.exports = router; 