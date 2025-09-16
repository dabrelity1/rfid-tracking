const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const rfidReadingSchema = Joi.object({
  rfidTag: Joi.string().min(1).max(50).required(),
  readerId: Joi.string().uuid().required(),
  signalStrength: Joi.number().integer().min(-100).max(0).optional(),
  timestamp: Joi.date().optional()
});

const readerSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  location: Joi.string().min(2).max(255).required(),
  zoneId: Joi.string().uuid().optional(),
  readerType: Joi.string().valid('fixed', 'portable').default('fixed'),
  ipAddress: Joi.string().ip().optional()
});

// Process RFID reading (called by RFID readers)
router.post('/reading', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { error } = rfidReadingSchema.validate(req.body);
    if (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { rfidTag, readerId, signalStrength, timestamp = new Date() } = req.body;

    // Verify reader exists and is active
    const readerResult = await client.query(
      'SELECT id, zone_id FROM rfid_readers WHERE id = $1 AND is_active = true',
      [readerId]
    );

    if (readerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'RFID reader not found or inactive'
      });
    }

    const reader = readerResult.rows[0];

    // Find asset by RFID tag
    const assetResult = await client.query(
      'SELECT id, current_zone_id, status FROM assets WHERE rfid_tag = $1',
      [rfidTag]
    );

    if (assetResult.rows.length === 0) {
      // Unknown RFID tag - create alert
      await client.query(`
        INSERT INTO alerts (alert_type, severity, message, created_at)
        VALUES ($1, $2, $3, $4)
      `, ['unknown_rfid', 'medium', `Unknown RFID tag detected: ${rfidTag}`, timestamp]);

      await client.query('COMMIT');
      
      return res.json({
        success: true,
        message: 'Unknown RFID tag recorded',
        data: { action: 'alert_created' }
      });
    }

    const asset = assetResult.rows[0];

    // Record the RFID reading
    await client.query(`
      INSERT INTO rfid_readings (asset_id, reader_id, rfid_tag, signal_strength, read_timestamp)
      VALUES ($1, $2, $3, $4, $5)
    `, [asset.id, readerId, rfidTag, signalStrength, timestamp]);

    // Update asset's last seen location and time
    const previousZoneId = asset.current_zone_id;
    
    await client.query(`
      UPDATE assets 
      SET current_zone_id = $1, last_seen_at = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [reader.zone_id, timestamp, asset.id]);

    // If asset moved to a different zone, record the movement
    if (reader.zone_id && (previousZoneId !== reader.zone_id)) {
      await client.query(`
        INSERT INTO asset_movements (asset_id, from_zone_id, to_zone_id, movement_type, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `, [asset.id, previousZoneId, reader.zone_id, 'automatic', timestamp]);

      // Check for unauthorized movement alerts
      if (previousZoneId) {
        const fromZoneResult = await client.query(
          'SELECT is_restricted FROM zones WHERE id = $1',
          [previousZoneId]
        );
        
        if (fromZoneResult.rows.length > 0 && fromZoneResult.rows[0].is_restricted) {
          await client.query(`
            INSERT INTO alerts (asset_id, alert_type, severity, message, created_at)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            asset.id, 
            'unauthorized_movement', 
            'high', 
            `Asset moved from restricted zone without authorization`, 
            timestamp
          ]);
        }
      }
    }

    // Update reader heartbeat
    await client.query(`
      UPDATE rfid_readers 
      SET last_heartbeat = $1 
      WHERE id = $2
    `, [timestamp, readerId]);

    await client.query('COMMIT');

    // Emit real-time update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('asset_update', {
        assetId: asset.id,
        rfidTag,
        currentZoneId: reader.zone_id,
        lastSeenAt: timestamp,
        readerId
      });
    }

    logger.info(`RFID reading processed: ${rfidTag} at reader ${readerId}`);

    res.json({
      success: true,
      message: 'RFID reading processed successfully',
      data: {
        assetId: asset.id,
        previousZone: previousZoneId,
        currentZone: reader.zone_id,
        action: reader.zone_id !== previousZoneId ? 'moved' : 'updated'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('RFID reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Get RFID readers
router.get('/readers', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, z.name as zone_name,
             COUNT(rr.id) as total_readings,
             r.last_heartbeat > NOW() - INTERVAL '5 minutes' as is_online
      FROM rfid_readers r
      LEFT JOIN zones z ON r.zone_id = z.id
      LEFT JOIN rfid_readings rr ON r.id = rr.reader_id AND rr.read_timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY r.id, z.name
      ORDER BY r.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        readers: result.rows.map(reader => ({
          id: reader.id,
          name: reader.name,
          location: reader.location,
          zoneId: reader.zone_id,
          zoneName: reader.zone_name,
          readerType: reader.reader_type,
          ipAddress: reader.ip_address,
          isActive: reader.is_active,
          isOnline: reader.is_online,
          lastHeartbeat: reader.last_heartbeat,
          totalReadings: parseInt(reader.total_readings),
          createdAt: reader.created_at
        }))
      }
    });
  } catch (error) {
    logger.error('Get RFID readers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create RFID reader
router.post('/readers', auth, authorize('admin'), async (req, res) => {
  try {
    const { error } = readerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, location, zoneId, readerType, ipAddress } = req.body;

    const result = await pool.query(`
      INSERT INTO rfid_readers (name, location, zone_id, reader_type, ip_address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, location, zoneId, readerType, ipAddress]);

    const reader = result.rows[0];

    logger.info(`RFID reader created: ${reader.name} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'RFID reader created successfully',
      data: {
        reader: {
          id: reader.id,
          name: reader.name,
          location: reader.location,
          zoneId: reader.zone_id,
          readerType: reader.reader_type,
          ipAddress: reader.ip_address,
          isActive: reader.is_active,
          createdAt: reader.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Create RFID reader error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update RFID reader
router.put('/readers/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = readerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, location, zoneId, readerType, ipAddress } = req.body;

    const result = await pool.query(`
      UPDATE rfid_readers 
      SET name = $1, location = $2, zone_id = $3, reader_type = $4, ip_address = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [name, location, zoneId, readerType, ipAddress, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RFID reader not found'
      });
    }

    const reader = result.rows[0];

    logger.info(`RFID reader updated: ${reader.name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'RFID reader updated successfully',
      data: {
        reader: {
          id: reader.id,
          name: reader.name,
          location: reader.location,
          zoneId: reader.zone_id,
          readerType: reader.reader_type,
          ipAddress: reader.ip_address,
          isActive: reader.is_active,
          updatedAt: reader.updated_at
        }
      }
    });
  } catch (error) {
    logger.error('Update RFID reader error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get recent RFID readings
router.get('/readings', auth, async (req, res) => {
  try {
    const { limit = 50, assetId, readerId, since } = req.query;
    
    let query = `
      SELECT rr.*, a.name as asset_name, a.rfid_tag, r.name as reader_name, r.location as reader_location
      FROM rfid_readings rr
      JOIN assets a ON rr.asset_id = a.id
      JOIN rfid_readers r ON rr.reader_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (assetId) {
      paramCount++;
      query += ` AND rr.asset_id = $${paramCount}`;
      params.push(assetId);
    }

    if (readerId) {
      paramCount++;
      query += ` AND rr.reader_id = $${paramCount}`;
      params.push(readerId);
    }

    if (since) {
      paramCount++;
      query += ` AND rr.read_timestamp >= $${paramCount}`;
      params.push(since);
    }

    query += ` ORDER BY rr.read_timestamp DESC LIMIT $${paramCount + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        readings: result.rows.map(reading => ({
          id: reading.id,
          assetId: reading.asset_id,
          assetName: reading.asset_name,
          rfidTag: reading.rfid_tag,
          readerId: reading.reader_id,
          readerName: reading.reader_name,
          readerLocation: reading.reader_location,
          signalStrength: reading.signal_strength,
          readTimestamp: reading.read_timestamp,
          createdAt: reading.created_at
        }))
      }
    });
  } catch (error) {
    logger.error('Get RFID readings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Simulate RFID reading (for testing)
router.post('/simulate', auth, authorize('admin'), async (req, res) => {
  try {
    const { rfidTag, readerId } = req.body;

    if (!rfidTag || !readerId) {
      return res.status(400).json({
        success: false,
        message: 'rfidTag and readerId are required'
      });
    }

    // Simulate the reading by calling the reading endpoint
    const simulatedReading = {
      rfidTag,
      readerId,
      signalStrength: Math.floor(Math.random() * 30) - 80, // Random signal between -80 and -50
      timestamp: new Date()
    };

    // Process the simulated reading
    req.body = simulatedReading;
    
    // Call the reading handler
    const readingResult = await new Promise((resolve, reject) => {
      const mockRes = {
        status: (code) => ({
          json: (data) => resolve({ statusCode: code, data })
        }),
        json: (data) => resolve({ statusCode: 200, data })
      };
      
      // Re-call the reading endpoint logic
      router.stack.find(layer => layer.route && layer.route.path === '/reading')
        .route.stack[0].handle(req, mockRes, reject);
    });

    res.json({
      success: true,
      message: 'RFID reading simulated successfully',
      data: readingResult.data
    });

  } catch (error) {
    logger.error('Simulate RFID reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;