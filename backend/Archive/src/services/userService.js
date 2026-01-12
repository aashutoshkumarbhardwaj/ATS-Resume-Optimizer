/**
 * User Service
 * Business logic for user operations
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Mock user storage - replace with database
let users = [];

class UserService {
    /**
     * Register a new user
     */
    static async registerUser(email, password, name) {
        // Check if user exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            throw new Error('User already exists');
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            email,
            password: hashedPassword,
            name
        });
        
        users.push(user);
        return user.toJSON();
    }

    /**
     * Login user
     */
    static async loginUser(email, password) {
        const user = users.find(u => u.email === email);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            throw new Error('Invalid password');
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        return {
            user: user.toJSON(),
            token
        };
    }

    /**
     * Get user by ID
     */
    static async getUserById(userId) {
        const user = users.find(u => u.id === userId);
        return user ? user.toJSON() : null;
    }

    /**
     * Update user
     */
    static async updateUser(userId, updates) {
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            throw new Error('User not found');
        }
        
        users[userIndex] = { ...users[userIndex], ...updates };
        return users[userIndex].toJSON();
    }
}

module.exports = UserService;
