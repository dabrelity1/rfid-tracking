const { pool } = require('../config/database');

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'auditor')),
        department VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Assets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        rfid_tag VARCHAR(50) UNIQUE NOT NULL,
        asset_type VARCHAR(100) NOT NULL,
        description TEXT,
        acquisition_date DATE,
        value DECIMAL(10,2),
        department VARCHAR(100),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive', 'missing')),
        current_zone_id UUID,
        last_seen_at TIMESTAMP,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Floor plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS floor_plans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        svg_data TEXT,
        image_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Zones table
    await client.query(`
      CREATE TABLE IF NOT EXISTS zones (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        zone_type VARCHAR(50) DEFAULT 'room',
        coordinates JSONB,
        is_restricted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // RFID readers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rfid_readers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        zone_id UUID REFERENCES zones(id),
        reader_type VARCHAR(20) DEFAULT 'fixed' CHECK (reader_type IN ('fixed', 'portable')),
        ip_address INET,
        is_active BOOLEAN DEFAULT true,
        last_heartbeat TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // RFID readings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rfid_readings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asset_id UUID REFERENCES assets(id),
        reader_id UUID REFERENCES rfid_readers(id),
        rfid_tag VARCHAR(50) NOT NULL,
        signal_strength INTEGER,
        read_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Asset movements table (for tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_movements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asset_id UUID REFERENCES assets(id),
        from_zone_id UUID REFERENCES zones(id),
        to_zone_id UUID REFERENCES zones(id),
        moved_by UUID REFERENCES users(id),
        movement_type VARCHAR(20) DEFAULT 'automatic' CHECK (movement_type IN ('automatic', 'manual', 'checkout', 'checkin')),
        notes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check-in/Check-out table
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_checkouts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asset_id UUID REFERENCES assets(id),
        user_id UUID REFERENCES users(id),
        checkout_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expected_return_at TIMESTAMP,
        checkin_at TIMESTAMP,
        checkin_by UUID REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
        notes TEXT
      )
    `);

    // Alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asset_id UUID REFERENCES assets(id),
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        message TEXT NOT NULL,
        is_acknowledged BOOLEAN DEFAULT false,
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audit logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_assets_rfid_tag ON assets(rfid_tag)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_assets_current_zone ON assets(current_zone_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_rfid_readings_timestamp ON rfid_readings(read_timestamp DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_asset_movements_timestamp ON asset_movements(timestamp DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)');

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { createTables };