const jwt = require('jsonwebtoken');

/**
 * JWT Service - Centralized JWT token management
 * Handles token generation, verification, and refresh
 */

class JWTService {
    constructor() {
        this.secret = process.env.JWT_SECRET || 'your-secret-key';
        this.defaultExpiry = '7d';
        this.refreshExpiry = '30d';
    }

    /**
     * Generate JWT token
     * @param {Object} payload - Token payload (usually contains userId)
     * @param {String} expiresIn - Token expiry time (default: 7d)
     * @returns {String} JWT token
     */
    generateToken(payload, expiresIn = this.defaultExpiry) {
        try {
            return jwt.sign(payload, this.secret, { expiresIn });
        } catch (error) {
            console.error('JWT Generation Error:', error);
            throw new Error('Failed to generate token');
        }
    }

    /**
     * Generate access token (short-lived)
     * @param {String} userId - User ID
     * @returns {String} Access token
     */
    generateAccessToken(userId) {
        return this.generateToken({ userId }, this.defaultExpiry);
    }

    /**
     * Generate refresh token (long-lived)
     * @param {String} userId - User ID
     * @returns {String} Refresh token
     */
    generateRefreshToken(userId) {
        return this.generateToken({ userId, type: 'refresh' }, this.refreshExpiry);
    }

    /**
     * Generate both access and refresh tokens
     * @param {String} userId - User ID
     * @returns {Object} Object containing accessToken and refreshToken
     */
    generateTokenPair(userId) {
        return {
            accessToken: this.generateAccessToken(userId),
            refreshToken: this.generateRefreshToken(userId)
        };
    }

    /**
     * Verify JWT token
     * @param {String} token - JWT token to verify
     * @returns {Object} Decoded token payload
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.secret);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            } else {
                throw new Error('Token verification failed');
            }
        }
    }

    /**
     * Decode token without verification (for debugging)
     * @param {String} token - JWT token to decode
     * @returns {Object} Decoded token payload
     */
    decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (error) {
            console.error('JWT Decode Error:', error);
            return null;
        }
    }

    /**
     * Check if token is expired
     * @param {String} token - JWT token to check
     * @returns {Boolean} True if expired, false otherwise
     */
    isTokenExpired(token) {
        try {
            const decoded = this.decodeToken(token);
            if (!decoded || !decoded.exp) return true;
            
            const currentTime = Math.floor(Date.now() / 1000);
            return decoded.exp < currentTime;
        } catch (error) {
            return true;
        }
    }

    /**
     * Get token expiry time
     * @param {String} token - JWT token
     * @returns {Date|null} Expiry date or null if invalid
     */
    getTokenExpiry(token) {
        try {
            const decoded = this.decodeToken(token);
            if (!decoded || !decoded.exp) return null;
            
            return new Date(decoded.exp * 1000);
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract token from Authorization header
     * @param {String} authHeader - Authorization header value
     * @returns {String|null} Extracted token or null
     */
    extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }

    /**
     * Generate admin token with additional permissions
     * @param {String} userId - User ID
     * @param {String} role - User role
     * @param {Array} permissions - Array of permissions
     * @returns {String} Admin JWT token
     */
    generateAdminToken(userId, role = 'admin', permissions = []) {
        const payload = {
            userId,
            role,
            permissions,
            isAdmin: true
        };
        return this.generateToken(payload, this.defaultExpiry);
    }

    /**
     * Verify admin token
     * @param {String} token - JWT token to verify
     * @returns {Object} Decoded admin token payload
     */
    verifyAdminToken(token) {

        const decoded = this.verifyToken(token);
        
        
        return decoded;
    }
}

// Create singleton instance
const jwtService = new JWTService();

module.exports = jwtService;
