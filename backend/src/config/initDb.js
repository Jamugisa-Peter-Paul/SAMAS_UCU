/**
 * Database Initialization Script
 * 
 * Reads and executes the schema.sql file to create all database tables.
 * Should be run once during initial setup.
 * 
 * @module config/initDb
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const initializeDatabase = async () => {
  try {
    console.log('[DB] Initializing database schema...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schema);
    
    console.log('[DB] Database schema initialized successfully');
    
    // Seed default admin user
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, department)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@ucu.ac.ug', adminPassword, 'System Administrator', 'admin', 'ICT']);

    // Seed sample lecturer
    const lecturerPassword = await bcrypt.hash('lecturer123', 10);
    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, department)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['lecturer@ucu.ac.ug', lecturerPassword, 'Dr. John Mukasa', 'lecturer', 'Computer Science']);

    // Seed sample student
    const studentPassword = await bcrypt.hash('student123', 10);
    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, department)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['student@ucu.ac.ug', studentPassword, 'Jane Nakato', 'student', 'Computer Science']);

    console.log('[DB] Default users seeded successfully');
    console.log('[DB] Admin: admin@ucu.ac.ug / admin123');
    console.log('[DB] Lecturer: lecturer@ucu.ac.ug / lecturer123');
    console.log('[DB] Student: student@ucu.ac.ug / student123');
    
  } catch (error) {
    console.error('[DB] Error initializing database:', error.message);
    throw error;
  }
};

module.exports = { initializeDatabase };
