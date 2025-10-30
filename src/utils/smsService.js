const axios = require('axios');

/**
 * SMS Service - Reusable utility for sending SMS via Bulk SMS BD API
 */

const SMS_CONFIG = {
  apiUrl: 'http://bulksmsbd.net/api/smsapi',
  senderId: '8809648904634', // Approved Sender ID
};

/**
 * API Response Error Code Mappings
 */
const ERROR_CODES = {
  1001: 'Invalid Number',
  1002: 'Sender ID not correct or sender ID is disabled',
  1003: 'Please provide all required fields or contact your system administrator',
  1005: 'Internal Error',
  1006: 'Balance Validity Not Available',
  1007: 'Balance Insufficient',
  1011: 'User ID not found',
  1012: 'Masking SMS must be sent in Bengali',
  1013: 'Sender ID has not found Gateway by API key',
  1014: 'Sender Type Name not found using this sender by API key',
  1015: 'Sender ID has not found Any Valid Gateway by API key',
  1016: 'Sender Type Name Active Price Info not found by this sender ID',
  1017: 'Sender Type Name Price Info not found by this sender ID',
  1018: 'The Owner of this (username) Account is disabled',
  1019: 'The (sender type name) Price of this (username) Account is disabled',
  1020: 'The parent of this account is not found',
  1021: 'The parent active (sender type name) price of this account is not found',
  1031: 'Your Account Not Verified, Please Contact Administrator',
  1032: 'IP Not whitelisted',
};

/**
 * Parse API response to extract status code
 * @param {any} responseData - API response data (could be string, number, or object)
 * @returns {number|null} Status code or null if not found
 */
const parseStatusCode = (responseData) => {
  // If response is already a number
  if (typeof responseData === 'number') {
    return responseData;
  }

  // If response is a string, try to extract number
  if (typeof responseData === 'string') {
    // Try to find number in the string (e.g., "202", "Error: 1001", etc.)
    const match = responseData.match(/\b(\d{3,4})\b/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // If response is an object, check for common status fields
  if (typeof responseData === 'object' && responseData !== null) {
    // Check for response_code (with underscore) first, as that's what Bulk SMS BD API uses
    // Then check other common field names
    return responseData.response_code || responseData.code || responseData.status || responseData.statusCode || null;
  }

  return null;
};

/**
 * Format phone number to include Bangladesh country code (880) if missing
 * @param {string} phone - Phone number (can be with or without country code)
 * @returns {string} Formatted phone number with 880 prefix
 */
const formatPhoneNumber = (phone) => {
  // Remove any spaces, dashes, or special characters
  let cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // If phone doesn't start with 880, add it
  if (!cleanPhone.startsWith('880')) {
    // Remove leading 0 if present (e.g., 01712345678 -> 8801712345678)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '880' + cleanPhone.substring(1);
    } else {
      cleanPhone = '880' + cleanPhone;
    }
  }
  
  return cleanPhone;
};

/**
 * Send SMS to a phone number
 * @param {string} phone - Phone number (receiver) - Format: 88017XXXXXXXX, 88018XXXXXXXX, 88019XXXXXXXX
 * @param {string} message - SMS message content (will be URL encoded automatically)
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
const sendSMS = async (phone, message) => {
  try {
    // Validate phone number
    if (!phone || typeof phone !== 'string') {
      return {
        success: false,
        error: 'Phone number is required and must be a string',
      };
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return {
        success: false,
        error: 'Message is required and cannot be empty',
      };
    }

    // Get API key from environment
    const apiKey = process.env.SMS_API_KEY;
    if (!apiKey) {
      console.error('SMS_API_KEY is not set in environment variables');
      return {
        success: false,
        error: 'SMS API configuration is missing',
      };
    }

    // Format phone number to include 880 prefix if missing
    const formattedPhone = formatPhoneNumber(phone);

    // Validate phone number format (should be 880 followed by 10-13 digits)
    const phoneRegex = /^880(17|18|19|13|14|15|16)[0-9]{8,9}$/;
    if (!phoneRegex.test(formattedPhone)) {
      return {
        success: false,
        error: 'Invalid phone number format. Must be Bangladesh number (88017XXXXXXXX, 88018XXXXXXXX, 88019XXXXXXXX, etc.)',
      };
    }

    // Build API URL with query parameters
    // Parameters: api_key, senderid, number, message (all required)
    // Note: message is URL encoded to handle special characters like &, $, @ etc.
    const url = `${SMS_CONFIG.apiUrl}?api_key=${apiKey}&senderid=${SMS_CONFIG.senderId}&number=${formattedPhone}&message=${encodeURIComponent(message)}`;

    // Send SMS via GET request
    // Increased timeout to 20 seconds as SMS API might take longer
    const response = await axios.get(url, {
      timeout: 20000, // 20 seconds timeout
    });

    // Parse the response to get status code
    const statusCode = parseStatusCode(response.data);

    // Log response for debugging
    console.log('SMS API Response:', response.data, 'Status Code:', statusCode);

    // Check if SMS was sent successfully (202 = SMS Submitted Successfully)
    if (statusCode === 202) {
      return {
        success: true,
        message: 'SMS sent successfully',
      };
    }

    // Handle error codes
    if (statusCode && ERROR_CODES[statusCode]) {
      return {
        success: false,
        error: ERROR_CODES[statusCode],
        code: statusCode,
      };
    }

    // Unknown error code or unexpected response format
    return {
      success: false,
      error: statusCode 
        ? `SMS API returned error code: ${statusCode}`
        : 'Failed to send SMS - Unexpected response format',
      code: statusCode || null,
    };
  } catch (error) {
    console.error('SMS sending error:', error.message);
    
    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'SMS API request timed out',
      };
    }

    // If API returned a response with error status
    if (error.response && error.response.data) {
      const statusCode = parseStatusCode(error.response.data);
      
      if (statusCode === 202) {
        // Sometimes 202 might come as error response, but it's actually success
        return {
          success: true,
          message: 'SMS sent successfully',
        };
      }
      
      if (statusCode && ERROR_CODES[statusCode]) {
        return {
          success: false,
          error: ERROR_CODES[statusCode],
          code: statusCode,
        };
      }
      
      return {
        success: false,
        error: `SMS API error: ${error.response.status} - ${error.response.statusText}`,
        code: statusCode || null,
      };
    }

    // Network or other errors
    return {
      success: false,
      error: error.message || 'Failed to send SMS - Network error',
    };
  }
};

/**
 * Send OTP SMS with formatted message
 * @param {string} phone - Phone number (receiver)
 * @param {string} otp - OTP code (usually 6 digits)
 * @param {string} brandName - Brand/Company name (optional, defaults to 'forping')
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
const sendOTPSMS = async (phone, otp, brandName = null) => {
  try {
    // Get brand name from parameter, env variable, or use default
    const brand = (brandName || process.env.BRAND_NAME || 'Forping').toLowerCase();
    
    // Format message as per requirement
    const message = `Your ${brand} login OTP is ${otp}. This OTP will expire in 2 minutes. Please do NOT share your OTP with others.`;

    return await sendSMS(phone, message);
  } catch (error) {
    console.error('OTP SMS sending error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to send OTP SMS',
    };
  }
};

/**
 * Send custom SMS message
 * @param {string} phone - Phone number (receiver)
 * @param {string} message - Custom message content
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
const sendCustomSMS = async (phone, message) => {
  return await sendSMS(phone, message);
};

module.exports = {
  sendSMS,
  sendOTPSMS,
  sendCustomSMS,
  formatPhoneNumber, // Export for testing or external use
};

