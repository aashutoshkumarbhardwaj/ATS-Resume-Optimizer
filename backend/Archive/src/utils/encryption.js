/**
 * Encryption Utility
 * Handles data encryption and decryption using AES-256
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

class EncryptionUtil {
    /**
     * Encrypt text
     */
    static encrypt(text) {
        if (!text) return null;
        
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt text
     */
    static decrypt(encryptedText) {
        if (!encryptedText) return null;
        
        try {
            const parts = encryptedText.split(':');
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
            
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Hash data (one-way)
     */
    static hash(text) {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    /**
     * Generate random token
     */
    static generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
}

module.exports = EncryptionUtil;
