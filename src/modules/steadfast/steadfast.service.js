const axios = require('axios');
const Settings = require('../settings/settings.model');

const BASE_URL = 'https://portal.packzy.com/api/v1';

/**
 * Get steadfast credentials from settings
 */
const getSteadfastCredentials = async () => {
    try {
        let settings = await Settings.findOne();
        if (!settings || !settings.steadfastSettings || !settings.steadfastSettings.apiKey || !settings.steadfastSettings.apiSecret) {
            throw new Error('Steadfast Courier API credentials are not configured. Please go to Settings > Steadfast Configuration and add your API Key and Secret Key to enable order delivery integration.');
        }
        return {
            apiKey: settings.steadfastSettings.apiKey,
            apiSecret: settings.steadfastSettings.apiSecret
        };
    } catch (error) {
        // If it's already our custom message, throw it as is
        if (error.message.includes('Steadfast Courier API credentials')) {
            throw error;
        }
        throw new Error('Unable to retrieve Steadfast Courier API credentials. Please check your configuration in Settings > Steadfast Configuration.');
    }
};

/**
 * Create order in Steadfast
 * @param {Object} orderData - Order data to send to Steadfast
 * @returns {Promise<Object>} Response from Steadfast API
 */
const createOrder = async (orderData) => {
    try {
        const credentials = await getSteadfastCredentials();
        
        const response = await axios.post(
            `${BASE_URL}/create_order`,
            orderData,
            {
                headers: {
                    'Api-Key': credentials.apiKey,
                    'Secret-Key': credentials.apiSecret,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Steadfast API Error:', error.response?.data || error.message);
        
        // If it's a credentials error, pass the friendly message through
        let errorMessage = error.message;
        if (errorMessage.includes('Steadfast Courier API credentials')) {
            return {
                success: false,
                error: { message: errorMessage },
                statusCode: 400
            };
        }
        
        // For other errors, provide generic message
        return {
            success: false,
            error: error.response?.data || { message: errorMessage },
            statusCode: error.response?.status || 500
        };
    }
};

/**
 * Create bulk orders in Steadfast
 * @param {Array} ordersData - Array of order data to send to Steadfast
 * @returns {Promise<Object>} Response from Steadfast API
 */
const createBulkOrders = async (ordersData) => {
    try {
        const credentials = await getSteadfastCredentials();
        
        // Steadfast expects the data as JSON string in 'data' field
        const response = await axios.post(
            `${BASE_URL}/create_order/bulk-order`,
            {
                data: JSON.stringify(ordersData)
            },
            {
                headers: {
                    'Api-Key': credentials.apiKey,
                    'Secret-Key': credentials.apiSecret,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Steadfast Bulk Order API Error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || { message: error.message },
            statusCode: error.response?.status || 500
        };
    }
};

/**
 * Get delivery status by consignment ID
 * @param {String|Number} consignmentId - Consignment ID
 * @returns {Promise<Object>} Status response from Steadfast
 */
const getStatusByConsignmentId = async (consignmentId) => {
    try {
        const credentials = await getSteadfastCredentials();
        
        const response = await axios.get(
            `${BASE_URL}/status_by_cid/${consignmentId}`,
            {
                headers: {
                    'Api-Key': credentials.apiKey,
                    'Secret-Key': credentials.apiSecret,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Steadfast Status API Error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || { message: error.message },
            statusCode: error.response?.status || 500
        };
    }
};

/**
 * Get delivery status by invoice
 * @param {String} invoice - Invoice ID
 * @returns {Promise<Object>} Status response from Steadfast
 */
const getStatusByInvoice = async (invoice) => {
    try {
        const credentials = await getSteadfastCredentials();
        
        const response = await axios.get(
            `${BASE_URL}/status_by_invoice/${invoice}`,
            {
                headers: {
                    'Api-Key': credentials.apiKey,
                    'Secret-Key': credentials.apiSecret,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Steadfast Status API Error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || { message: error.message },
            statusCode: error.response?.status || 500
        };
    }
};

/**
 * Get delivery status by tracking code
 * @param {String} trackingCode - Tracking code
 * @returns {Promise<Object>} Status response from Steadfast
 */
const getStatusByTrackingCode = async (trackingCode) => {
    try {
        const credentials = await getSteadfastCredentials();
        
        const response = await axios.get(
            `${BASE_URL}/status_by_trackingcode/${trackingCode}`,
            {
                headers: {
                    'Api-Key': credentials.apiKey,
                    'Secret-Key': credentials.apiSecret,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Steadfast Status API Error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || { message: error.message },
            statusCode: error.response?.status || 500
        };
    }
};

/**
 * Get current balance
 * @returns {Promise<Object>} Balance response from Steadfast
 */
const getBalance = async () => {
    try {
        const credentials = await getSteadfastCredentials();
        
        const response = await axios.get(
            `${BASE_URL}/get_balance`,
            {
                headers: {
                    'Api-Key': credentials.apiKey,
                    'Secret-Key': credentials.apiSecret,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Steadfast Balance API Error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || { message: error.message },
            statusCode: error.response?.status || 500
        };
    }
};

module.exports = {
    createOrder,
    createBulkOrders,
    getStatusByConsignmentId,
    getStatusByInvoice,
    getStatusByTrackingCode,
    getBalance,
    getSteadfastCredentials
};

