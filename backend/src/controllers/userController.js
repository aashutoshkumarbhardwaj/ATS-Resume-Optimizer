/**
 * User Controller
 * Handles user-related operations
 */

const UserService = require('../services/userService');

class UserController {
    /**
     * Register a new user
     */
    static async register(req, res) {
        try {
            const { email, password, name } = req.body;

            if (!email || !password || !name) {
                return res.status(400).json({
                    error: 'Missing required fields: email, password, name'
                });
            }

            const user = await UserService.registerUser(email, password, name);
            res.status(201).json({ 
                success: true,
                user, 
                message: 'User registered successfully' 
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ 
                success: false,
                error: error.message 
            });
        }
    }

    /**
     * Login user
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: 'Missing required fields: email, password'
                });
            }

            const result = await UserService.loginUser(email, password);
            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(401).json({ 
                success: false,
                error: error.message 
            });
        }
    }

    /**
     * Get user profile
     */
    static async getProfile(req, res) {
        try {
            const userId = req.user.id;
            const user = await UserService.getUserById(userId);

            if (!user) {
                return res.status(404).json({ 
                    success: false,
                    error: 'User not found' 
                });
            }

            res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ 
                success: false,
                error: error.message 
            });
        }
    }

    /**
     * Update user profile
     */
    static async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const updates = req.body;

            const user = await UserService.updateUser(userId, updates);
            res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ 
                success: false,
                error: error.message 
            });
        }
    }
}

module.exports = UserController;