/**
 * Optimization History Model
 * Stores all resume optimizations performed
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OptimizationHistory = sequelize.define('OptimizationHistory', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    user_email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    job_title: {
        type: DataTypes.STRING,
        allowNull: true
    },
    company: {
        type: DataTypes.STRING,
        allowNull: true
    },
    original_score: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    optimized_score: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    score_improvement: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    original_text: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    optimized_text: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    job_description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    changes_made: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    matched_keywords: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    missing_keywords: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    analysis_result: {
        type: DataTypes.JSON,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'optimization_history',
    timestamps: false
});

module.exports = OptimizationHistory;
