const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const { pool } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'image/svg+xml') {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation schemas
const floorPlanSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).optional()
});

const zoneSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).optional(),
  zoneType: Joi.string().max(50).default('room'),
  coordinates: Joi.object().optional(),
  isRestricted: Joi.boolean().default(false)
});

// Get all floor plans
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT fp.*, u.full_name as created_by_name,
             COUNT(z.id) as zones_count
      FROM floor_plans fp
      LEFT JOIN users u ON fp.created_by = u.id
      LEFT JOIN zones z ON fp.id = z.floor_plan_id
      WHERE fp.is_active = true
      GROUP BY fp.id, u.full_name
      ORDER BY fp.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        floorPlans: result.rows.map(plan => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          imageUrl: plan.image_url,
          zonesCount: parseInt(plan.zones_count),
          createdBy: plan.created_by_name,
          createdAt: plan.created_at,
          updatedAt: plan.updated_at
        }))
      }
    });
  } catch (error) {
    logger.error('Get floor plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single floor plan with zones and assets
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get floor plan
    const planResult = await pool.query(`
      SELECT fp.*, u.full_name as created_by_name
      FROM floor_plans fp
      LEFT JOIN users u ON fp.created_by = u.id
      WHERE fp.id = $1 AND fp.is_active = true
    `, [id]);

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Floor plan not found'
      });
    }

    const floorPlan = planResult.rows[0];

    // Get zones
    const zonesResult = await pool.query(`
      SELECT z.*, COUNT(a.id) as assets_count
      FROM zones z
      LEFT JOIN assets a ON z.id = a.current_zone_id AND a.status = 'active'
      WHERE z.floor_plan_id = $1
      GROUP BY z.id
      ORDER BY z.created_at
    `, [id]);

    // Get assets in this floor plan's zones
    const assetsResult = await pool.query(`
      SELECT a.*, z.name as zone_name
      FROM assets a
      JOIN zones z ON a.current_zone_id = z.id
      WHERE z.floor_plan_id = $1 AND a.status = 'active'
      ORDER BY a.name
    `, [id]);

    res.json({
      success: true,
      data: {
        floorPlan: {
          id: floorPlan.id,
          name: floorPlan.name,
          description: floorPlan.description,
          svgData: floorPlan.svg_data,
          imageUrl: floorPlan.image_url,
          createdBy: floorPlan.created_by_name,
          createdAt: floorPlan.created_at,
          updatedAt: floorPlan.updated_at
        },
        zones: zonesResult.rows.map(zone => ({
          id: zone.id,
          name: zone.name,
          description: zone.description,
          zoneType: zone.zone_type,
          coordinates: zone.coordinates,
          isRestricted: zone.is_restricted,
          assetsCount: parseInt(zone.assets_count),
          createdAt: zone.created_at
        })),
        assets: assetsResult.rows.map(asset => ({
          id: asset.id,
          name: asset.name,
          rfidTag: asset.rfid_tag,
          assetType: asset.asset_type,
          zoneName: asset.zone_name,
          zoneId: asset.current_zone_id,
          lastSeenAt: asset.last_seen_at
        }))
      }
    });
  } catch (error) {
    logger.error('Get floor plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create floor plan
router.post('/', auth, authorize('admin', 'user'), upload.single('image'), async (req, res) => {
  try {
    const { error } = floorPlanSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, description } = req.body;
    let imageUrl = null;

    // Handle file upload (in a real app, you'd upload to cloud storage)
    if (req.file) {
      // For demo purposes, we'll store as base64 or implement a simple file server
      imageUrl = `/uploads/${Date.now()}-${req.file.originalname}`;
      // TODO: Implement actual file storage
    }

    const result = await pool.query(`
      INSERT INTO floor_plans (name, description, image_url, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, description, imageUrl, req.user.id]);

    const floorPlan = result.rows[0];

    logger.info(`Floor plan created: ${floorPlan.name} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Floor plan created successfully',
      data: {
        floorPlan: {
          id: floorPlan.id,
          name: floorPlan.name,
          description: floorPlan.description,
          imageUrl: floorPlan.image_url,
          createdAt: floorPlan.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Create floor plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create zone
router.post('/:floorPlanId/zones', auth, authorize('admin', 'user'), async (req, res) => {
  try {
    const { floorPlanId } = req.params;
    const { error } = zoneSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Verify floor plan exists
    const floorPlanResult = await pool.query(
      'SELECT id FROM floor_plans WHERE id = $1 AND is_active = true',
      [floorPlanId]
    );

    if (floorPlanResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Floor plan not found'
      });
    }

    const { name, description, zoneType, coordinates, isRestricted } = req.body;

    const result = await pool.query(`
      INSERT INTO zones (floor_plan_id, name, description, zone_type, coordinates, is_restricted)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [floorPlanId, name, description, zoneType, JSON.stringify(coordinates), isRestricted]);

    const zone = result.rows[0];

    logger.info(`Zone created: ${zone.name} in floor plan ${floorPlanId} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Zone created successfully',
      data: {
        zone: {
          id: zone.id,
          floorPlanId: zone.floor_plan_id,
          name: zone.name,
          description: zone.description,
          zoneType: zone.zone_type,
          coordinates: zone.coordinates,
          isRestricted: zone.is_restricted,
          createdAt: zone.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Create zone error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update zone
router.put('/zones/:zoneId', auth, authorize('admin', 'user'), async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { name, description, zoneType, coordinates, isRestricted } = req.body;

    const result = await pool.query(`
      UPDATE zones 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          zone_type = COALESCE($3, zone_type),
          coordinates = COALESCE($4, coordinates),
          is_restricted = COALESCE($5, is_restricted),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [name, description, zoneType, coordinates ? JSON.stringify(coordinates) : null, isRestricted, zoneId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    const zone = result.rows[0];

    logger.info(`Zone updated: ${zone.name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Zone updated successfully',
      data: {
        zone: {
          id: zone.id,
          name: zone.name,
          description: zone.description,
          zoneType: zone.zone_type,
          coordinates: zone.coordinates,
          isRestricted: zone.is_restricted,
          updatedAt: zone.updated_at
        }
      }
    });
  } catch (error) {
    logger.error('Update zone error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete zone
router.delete('/zones/:zoneId', auth, authorize('admin'), async (req, res) => {
  try {
    const { zoneId } = req.params;

    // Check if zone has assets
    const assetsResult = await pool.query(
      'SELECT COUNT(*) as count FROM assets WHERE current_zone_id = $1',
      [zoneId]
    );

    if (parseInt(assetsResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete zone with assets. Move assets first.'
      });
    }

    const result = await pool.query('DELETE FROM zones WHERE id = $1 RETURNING name', [zoneId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    logger.info(`Zone deleted: ${result.rows[0].name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    logger.error('Delete zone error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;