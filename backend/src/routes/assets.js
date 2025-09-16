const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const assetSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  rfidTag: Joi.string().min(1).max(50).required(),
  assetType: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(1000).optional(),
  acquisitionDate: Joi.date().optional(),
  value: Joi.number().min(0).optional(),
  department: Joi.string().max(100).optional()
});

// Get all assets
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, department, status, zone } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT a.*, z.name as zone_name, u.full_name as created_by_name,
             COUNT(*) OVER() as total_count
      FROM assets a
      LEFT JOIN zones z ON a.current_zone_id = z.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (a.name ILIKE $${paramCount} OR a.rfid_tag ILIKE $${paramCount} OR a.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (department) {
      paramCount++;
      query += ` AND a.department = $${paramCount}`;
      params.push(department);
    }

    if (status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
    }

    if (zone) {
      paramCount++;
      query += ` AND a.current_zone_id = $${paramCount}`;
      params.push(zone);
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const assets = result.rows;
    const totalCount = assets.length > 0 ? parseInt(assets[0].total_count) : 0;

    res.json({
      success: true,
      data: {
        assets: assets.map(asset => ({
          id: asset.id,
          name: asset.name,
          rfidTag: asset.rfid_tag,
          assetType: asset.asset_type,
          description: asset.description,
          acquisitionDate: asset.acquisition_date,
          value: asset.value,
          department: asset.department,
          status: asset.status,
          currentZoneId: asset.current_zone_id,
          zoneName: asset.zone_name,
          lastSeenAt: asset.last_seen_at,
          createdBy: asset.created_by_name,
          createdAt: asset.created_at,
          updatedAt: asset.updated_at
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: offset + limit < totalCount,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Get assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single asset
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT a.*, z.name as zone_name, u.full_name as created_by_name
      FROM assets a
      LEFT JOIN zones z ON a.current_zone_id = z.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const asset = result.rows[0];

    // Get recent movements
    const movementsResult = await pool.query(`
      SELECT am.*, zf.name as from_zone_name, zt.name as to_zone_name, u.full_name as moved_by_name
      FROM asset_movements am
      LEFT JOIN zones zf ON am.from_zone_id = zf.id
      LEFT JOIN zones zt ON am.to_zone_id = zt.id
      LEFT JOIN users u ON am.moved_by = u.id
      WHERE am.asset_id = $1
      ORDER BY am.timestamp DESC
      LIMIT 10
    `, [id]);

    res.json({
      success: true,
      data: {
        asset: {
          id: asset.id,
          name: asset.name,
          rfidTag: asset.rfid_tag,
          assetType: asset.asset_type,
          description: asset.description,
          acquisitionDate: asset.acquisition_date,
          value: asset.value,
          department: asset.department,
          status: asset.status,
          currentZoneId: asset.current_zone_id,
          zoneName: asset.zone_name,
          lastSeenAt: asset.last_seen_at,
          createdBy: asset.created_by_name,
          createdAt: asset.created_at,
          updatedAt: asset.updated_at
        },
        recentMovements: movementsResult.rows.map(movement => ({
          id: movement.id,
          fromZoneId: movement.from_zone_id,
          fromZoneName: movement.from_zone_name,
          toZoneId: movement.to_zone_id,
          toZoneName: movement.to_zone_name,
          movementType: movement.movement_type,
          movedBy: movement.moved_by_name,
          notes: movement.notes,
          timestamp: movement.timestamp
        }))
      }
    });
  } catch (error) {
    logger.error('Get asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create asset
router.post('/', auth, authorize('admin', 'user'), async (req, res) => {
  try {
    const { error } = assetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, rfidTag, assetType, description, acquisitionDate, value, department } = req.body;

    // Check if RFID tag already exists
    const existingAsset = await pool.query('SELECT id FROM assets WHERE rfid_tag = $1', [rfidTag]);
    if (existingAsset.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'RFID tag already exists'
      });
    }

    const result = await pool.query(`
      INSERT INTO assets (name, rfid_tag, asset_type, description, acquisition_date, value, department, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, rfidTag, assetType, description, acquisitionDate, value, department, req.user.id]);

    const asset = result.rows[0];

    // Log the creation
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.user.id, 'CREATE', 'asset', asset.id, JSON.stringify(asset)]);

    logger.info(`Asset created: ${asset.name} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Asset created successfully',
      data: {
        asset: {
          id: asset.id,
          name: asset.name,
          rfidTag: asset.rfid_tag,
          assetType: asset.asset_type,
          description: asset.description,
          acquisitionDate: asset.acquisition_date,
          value: asset.value,
          department: asset.department,
          status: asset.status,
          createdAt: asset.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Create asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update asset
router.put('/:id', auth, authorize('admin', 'user'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = assetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Get current asset
    const currentAsset = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (currentAsset.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const { name, rfidTag, assetType, description, acquisitionDate, value, department } = req.body;

    // Check if RFID tag already exists for another asset
    const existingAsset = await pool.query('SELECT id FROM assets WHERE rfid_tag = $1 AND id != $2', [rfidTag, id]);
    if (existingAsset.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'RFID tag already exists'
      });
    }

    const result = await pool.query(`
      UPDATE assets 
      SET name = $1, rfid_tag = $2, asset_type = $3, description = $4, 
          acquisition_date = $5, value = $6, department = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [name, rfidTag, assetType, description, acquisitionDate, value, department, id]);

    const updatedAsset = result.rows[0];

    // Log the update
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [req.user.id, 'UPDATE', 'asset', id, JSON.stringify(currentAsset.rows[0]), JSON.stringify(updatedAsset)]);

    logger.info(`Asset updated: ${updatedAsset.name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Asset updated successfully',
      data: {
        asset: {
          id: updatedAsset.id,
          name: updatedAsset.name,
          rfidTag: updatedAsset.rfid_tag,
          assetType: updatedAsset.asset_type,
          description: updatedAsset.description,
          acquisitionDate: updatedAsset.acquisition_date,
          value: updatedAsset.value,
          department: updatedAsset.department,
          status: updatedAsset.status,
          updatedAt: updatedAsset.updated_at
        }
      }
    });
  } catch (error) {
    logger.error('Update asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete asset
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (asset.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    await pool.query('DELETE FROM assets WHERE id = $1', [id]);

    // Log the deletion
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.user.id, 'DELETE', 'asset', id, JSON.stringify(asset.rows[0])]);

    logger.info(`Asset deleted: ${asset.rows[0].name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    logger.error('Delete asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get asset statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_assets,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_assets,
        COUNT(CASE WHEN status = 'missing' THEN 1 END) as missing_assets,
        COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance_assets,
        COUNT(CASE WHEN current_zone_id IS NOT NULL THEN 1 END) as tracked_assets
      FROM assets
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        totalAssets: parseInt(stats.total_assets),
        activeAssets: parseInt(stats.active_assets),
        missingAssets: parseInt(stats.missing_assets),
        maintenanceAssets: parseInt(stats.maintenance_assets),
        trackedAssets: parseInt(stats.tracked_assets)
      }
    });
  } catch (error) {
    logger.error('Get asset stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;