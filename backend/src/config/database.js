/**
 * Database Configuration
 * Connects to Neon PostgreSQL Database
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env file');
    console.error('Please add your Neon PostgreSQL connection string');
    process.exit(1);
}

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false, // Set to console.log for SQL logging
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Note: Connection is tested during server startup with sequelize.sync()
// This ensures database is ready before routes are loaded

module.exports = sequelize;
