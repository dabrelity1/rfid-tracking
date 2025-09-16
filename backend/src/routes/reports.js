const express = require('express');
const { pool } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Asset statistics
    const assetStats = await pool.query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_assets,
        COUNT(CASE WHEN status = 'missing' THEN 1 END) as missing_assets,
        COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance_assets,
        COUNT(CASE WHEN current_zone_id IS NOT NULL THEN 1 END) as tracked_assets
      FROM assets
    `);

    // Recent alerts
    const recentAlerts = await pool.query(`
      SELECT a.*, ast.name as asset_name
      FROM alerts a
      LEFT JOIN assets ast ON a.asset_id = ast.id
      WHERE a.is_acknowledged = false
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    // Assets by department
    const assetsByDept = await pool.query(`
      SELECT department, COUNT(*) as count
      FROM assets
      WHERE department IS NOT NULL
      GROUP BY department
      ORDER BY count DESC
    `);

    // Recent movements
    const recentMovements = await pool.query(`
      SELECT am.*, a.name as asset_name, zf.name as from_zone_name, zt.name as to_zone_name
      FROM asset_movements am
      JOIN assets a ON am.asset_id = a.id
      LEFT JOIN zones zf ON am.from_zone_id = zf.id
      LEFT JOIN zones zt ON am.to_zone_id = zt.id
      ORDER BY am.timestamp DESC
      LIMIT 10
    `);

    // RFID reader status
    const readerStats = await pool.query(`
      SELECT 
        COUNT(*) as total_readers,
        COUNT(CASE WHEN is_active THEN 1 END) as active_readers,
        COUNT(CASE WHEN last_heartbeat > NOW() - INTERVAL '5 minutes' THEN 1 END) as online_readers
      FROM rfid_readers
    `);

    res.json({
      success: true,
      data: {
        assetStats: assetStats.rows[0],
        readerStats: readerStats.rows[0],
        recentAlerts: recentAlerts.rows,
        assetsByDepartment: assetsByDept.rows,
        recentMovements: recentMovements.rows.map(movement => ({
          id: movement.id,
          assetName: movement.asset_name,
          fromZone: movement.from_zone_name,
          toZone: movement.to_zone_name,
          movementType: movement.movement_type,
          timestamp: movement.timestamp
        }))
      }
    });
  } catch (error) {
    logger.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get inventory report
router.get('/inventory', auth, async (req, res) => {
  try {
    const { department, status, zone } = req.query;
    
    let query = `
      SELECT a.*, z.name as zone_name, 
             CASE WHEN ac.status = 'active' THEN true ELSE false END as is_checked_out
      FROM assets a
      LEFT JOIN zones z ON a.current_zone_id = z.id
      LEFT JOIN asset_checkouts ac ON a.id = ac.asset_id AND ac.status = 'active'
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

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

    query += ` ORDER BY a.name`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        assets: result.rows.map(asset => ({
          id: asset.id,
          name: asset.name,
          rfidTag: asset.rfid_tag,
          assetType: asset.asset_type,
          department: asset.department,
          status: asset.status,
          value: asset.value,
          acquisitionDate: asset.acquisition_date,
          zoneName: asset.zone_name,
          isCheckedOut: asset.is_checked_out,
          lastSeenAt: asset.last_seen_at
        }))
      }
    });
  } catch (error) {
    logger.error('Get inventory report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get movement history report
router.get('/movements', auth, async (req, res) => {
  try {
    const { assetId, startDate, endDate, limit = 100 } = req.query;
    
    let query = `
      SELECT am.*, a.name as asset_name, a.rfid_tag,
             zf.name as from_zone_name, zt.name as to_zone_name,
             u.full_name as moved_by_name
      FROM asset_movements am
      JOIN assets a ON am.asset_id = a.id
      LEFT JOIN zones zf ON am.from_zone_id = zf.id
      LEFT JOIN zones zt ON am.to_zone_id = zt.id
      LEFT JOIN users u ON am.moved_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (assetId) {
      paramCount++;
      query += ` AND am.asset_id = $${paramCount}`;
      params.push(assetId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND am.timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND am.timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY am.timestamp DESC LIMIT $${paramCount + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        movements: result.rows.map(movement => ({
          id: movement.id,
          assetId: movement.asset_id,
          assetName: movement.asset_name,
          rfidTag: movement.rfid_tag,
          fromZone: movement.from_zone_name,
          toZone: movement.to_zone_name,
          movementType: movement.movement_type,
          movedBy: movement.moved_by_name,
          notes: movement.notes,
          timestamp: movement.timestamp
        }))
      }
    });
  } catch (error) {
    logger.error('Get movements report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get alerts report
router.get('/alerts', auth, async (req, res) => {
  try {
    const { severity, acknowledged, limit = 50 } = req.query;
    
    let query = `
      SELECT a.*, ast.name as asset_name, ast.rfid_tag,
             u.full_name as acknowledged_by_name
      FROM alerts a
      LEFT JOIN assets ast ON a.asset_id = ast.id
      LEFT JOIN users u ON a.acknowledged_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (severity) {
      paramCount++;
      query += ` AND a.severity = $${paramCount}`;
      params.push(severity);
    }

    if (acknowledged !== undefined) {
      paramCount++;
      query += ` AND a.is_acknowledged = $${paramCount}`;
      params.push(acknowledged === 'true');
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramCount + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        alerts: result.rows.map(alert => ({
          id: alert.id,
          assetId: alert.asset_id,
          assetName: alert.asset_name,
          rfidTag: alert.rfid_tag,
          alertType: alert.alert_type,
          severity: alert.severity,
          message: alert.message,
          isAcknowledged: alert.is_acknowledged,
          acknowledgedBy: alert.acknowledged_by_name,
          acknowledgedAt: alert.acknowledged_at,
          createdAt: alert.created_at
        }))
      }
    });
  } catch (error) {
    logger.error('Get alerts report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Acknowledge alert
router.post('/alerts/:id/acknowledge', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE alerts 
      SET is_acknowledged = true, acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND is_acknowledged = false
      RETURNING *
    `, [req.user.id, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found or already acknowledged'
      });
    }

    logger.info(`Alert acknowledged: ${id} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    logger.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;