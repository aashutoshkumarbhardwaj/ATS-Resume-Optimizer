/**
 * Database Initialization Script
 * Creates tables and schema for PostgreSQL
 * 
 * Run with: node scripts/initDatabase.js
 */

require('dotenv').config();
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const OptimizationHistory = require('../src/models/OptimizationHistory');

async function initializeDatabase() {
    try {
        console.log('🔄 Initializing database...');
        
        // Sync all models with database (create tables if they don't exist)
        await sequelize.sync({ alter: false });
        
        console.log('✅ Database tables created successfully');
        console.log('✅ User table created');
        console.log('✅ OptimizationHistory table created');
        
        // Check if tables exist
        const queryInterface = sequelize.getQueryInterface();
        const tables = await queryInterface.showAllTables();
        
        console.log('\n📊 Database Tables:');
        tables.forEach(table => {
            console.log(`  ✓ ${table}`);
        });
        
        console.log('\n✅ Database initialization complete!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

initializeDatabase();
