const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all users (admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, full_name, role, department, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: {
        users: result.rows.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          department: user.department,
          isActive: user.is_active,
          createdAt: user.created_at
        }))
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user
router.put('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, department, isActive } = req.body;

    const result = await pool.query(`
      UPDATE users 
      SET role = COALESCE($1, role), 
          department = COALESCE($2, department), 
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, username, email, full_name, role, department, is_active
    `, [role, department, isActive, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    logger.info(`User updated: ${user.username} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;