/**
 * Refactored Google Apps Script Client
 * Uses Fetch API with proper CORS, error handling, and structured responses
 */
class GASClientV2 {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.timeout = options.timeout || 30000;
        this.isInitialized = false;
        this.requestId = 0;
    }
    
    async init() {
        try {
            console.log('GASClientV2: Initializing...');
            const result = await this.request('test', {}, { timeout: 5000 });
            
            if (!result.success) {
                throw new Error(result.message || 'Server returned error');
            }
            
            this.isInitialized = true;
            console.log('GASClientV2: Initialization successful');
            return true;
        } catch (error) {
            console.error('GASClientV2: Initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Core request method with proper error handling
     * @param {string} action - The GAS function to call
     * @param {object} data - Request parameters
     * @param {object} options - Request options (timeout, etc)
     * @returns {Promise<object>} Response data
     */
    async request(action, data = {}, options = {}) {
        const requestTimeout = options.timeout || this.timeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
        
        try {
            // Build request body
            const body = new FormData();
            body.append('action', action);
            
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    body.append(key, String(value));
                }
            }
            
            // Make request with structured error handling
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                body: body,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            // Parse response
            const responseData = await response.json();
            
            // Check for HTTP errors
            if (!response.ok) {
                throw new APIError(
                    responseData.message || `HTTP ${response.status}`,
                    response.status,
                    responseData
                );
            }
            
            // Check for application errors
            if (responseData.error) {
                throw new APIError(
                    responseData.message || 'Server error',
                    responseData.errorCode || 500,
                    responseData
                );
            }
            
            return responseData;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error instanceof APIError) {
                throw error;
            }
            
            if (error.name === 'AbortError') {
                throw new APIError(
                    `Request timeout after ${requestTimeout}ms`,
                    'TIMEOUT',
                    { timeout: requestTimeout }
                );
            }
            
            throw new APIError(
                error.message || 'Network error',
                'NETWORK_ERROR',
                { originalError: error }
            );
        }
    }
    
    /**
     * Search for a customer
     * @param {string} type - Search type: 'accountName', 'accountNumber', 'customerId'
     * @param {string} value - Search value
     * @returns {Promise<object>} Customer data
     */
    async searchCustomer(type, value) {
        if (!type || !value) {
            throw new APIError('Search type and value are required', 'INVALID_PARAMS');
        }
        
        const result = await this.request('search', { type, value });
        
        if (!result.data) {
            throw new APIError('Customer not found', 'NOT_FOUND');
        }
        
        return result.data;
    }
    
    /**
     * Autocomplete account names
     * @param {string} value - Partial account name
     * @returns {Promise<Array>} Matching accounts
     */
    async autocompleteNames(value) {
        if (!value || value.length < 1) {
            return [];
        }
        
        const result = await this.request('autocomplete', { value });
        return result.data || [];
    }
    
    /**
     * Generate customer statement
     * @param {string} accountNumber - Account number
     * @param {string} dateFrom - Start date (YYYY-MM-DD)
     * @param {string} dateTo - End date (YYYY-MM-DD)
     * @returns {Promise<Array>} Transaction records
     */
    async generateStatement(accountNumber, dateFrom, dateTo) {
        if (!accountNumber) {
            throw new APIError('Account number is required', 'INVALID_PARAMS');
        }
        
        const result = await this.request('generateStatement', {
            accountNumber,
            dateFrom,
            dateTo
        }, { timeout: 45000 }); // Longer timeout for statement generation
        
        return result.data || [];
    }
    
    /**
     * Test connection to GAS backend
     * @returns {Promise<object>} Connection status
     */
    async testConnection() {
        try {
            const result = await this.request('test', {}, { timeout: 5000 });
            return {
                success: true,
                message: 'Connected to Google Apps Script',
                data: result
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                errorCode: error.code
            };
        }
    }
    
    /**
     * Get detailed API metrics (for debugging)
     */
    getMetrics() {
        return {
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            isInitialized: this.isInitialized
        };
    }
}

/**
 * Custom error class for API errors
 */
class APIError extends Error {
    constructor(message, code = 'UNKNOWN', metadata = {}) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.metadata = metadata;
    }
    
    toJSON() {
        return {
            message: this.message,
            code: this.code,
            metadata: this.metadata
        };
    }
}

// Global client instance
let gasClient = null;

/**
 * Initialize the GAS client with the configured base URL
 */
function initGASClient() {
    if (typeof GAS_CONFIG === 'undefined') {
        console.error('GAS_CONFIG is not defined. Please check config.js is loaded first.');
        return null;
    }
    
    const baseUrl = GAS_CONFIG.BASE_URL;
    
    if (!baseUrl || baseUrl.includes('SCRIPT_ID')) {
        console.error('Please set your Google Apps Script URL in config.js');
        return null;
    }
    
    gasClient = new GASClientV2(baseUrl);
    return gasClient;
}

/**
 * Get or create the global GAS client instance
 */
function getGASClient() {
    if (!gasClient) {
        gasClient = initGASClient();
    }
    return gasClient;
}

// Make globally available
window.initGASClient = initGASClient;
window.getGASClient = getGASClient;
window.GASClientV2 = GASClientV2;
window.APIError = APIError;
