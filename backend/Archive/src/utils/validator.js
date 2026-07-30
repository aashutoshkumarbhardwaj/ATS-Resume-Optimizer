/**
 * Validation Utilities
 */

class Validator {
    /**
     * Validate email
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate password strength
     */
    static isStrongPassword(password) {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return regex.test(password);
    }

    /**
     * Validate resume content
     */
    static isValidResume(resumeText) {
        if (!resumeText || typeof resumeText !== 'string') return false;
        if (resumeText.trim().length < 50) return false;
        return true;
    }

    /**
     * Validate job description
     */
    static isValidJobDescription(description) {
        if (!description || typeof description !== 'string') return false;
        if (description.trim().length < 50) return false;
        return true;
    }
}

module.exports = Validator;
