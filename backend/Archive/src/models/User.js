/**
 * User Model
 * Schema for storing user data
 */

class User {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.email = data.email;
        this.password = data.password; // Should be hashed
        this.name = data.name;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.preferences = data.preferences || {};
    }

    toJSON() {
        const { password, ...userWithoutPassword } = this;
        return userWithoutPassword;
    }
}

module.exports = User;
