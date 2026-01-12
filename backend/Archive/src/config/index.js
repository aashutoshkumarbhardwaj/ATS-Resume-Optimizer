/**
 * Backend Configuration
 */

module.exports = {
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 27017,
        name: process.env.DB_NAME || 'resume_fixer'
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: '7d'
    },
    server: {
        port: process.env.PORT || 5000,
        env: process.env.NODE_ENV || 'development'
    }
};
