class GASClientV2 {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.timeout = options.timeout || 30000;
        this.isInitialized = false;
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
    
    async request(action, data = {}, options = {}) {
        const requestTimeout = options.timeout || this.timeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
        
        try {
            const body = new FormData();
            body.append('action', action);
            
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    body.append(key, String(value));
                }
            }
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                body: body,
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            const responseData = await response.json();
            
            if (!response.ok) {
                throw new APIError(
                    responseData.message || `HTTP ${response.status}`,
                    response.status,
                    responseData
                );
            }
            
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
            
            if (error instanceof APIError) throw error;
            
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
    
    async searchCustomer(type, value) {
        if (!type || !value) {
            throw new APIError('Search type and value are required', 'INVALID_PARAMS');
        }
        const result = await this.request('search', { type, value });
        if (!result.data) throw new APIError('Customer not found', 'NOT_FOUND');
        return result.data;
    }
    
    async autocompleteNames(value) {
        if (!value || value.length < 1) return [];
        const result = await this.request('autocomplete', { value });
        return result.data || [];
    }
    
    async generateStatement(accountNumber, dateFrom, dateTo) {
        if (!accountNumber) {
            throw new APIError('Account number is required', 'INVALID_PARAMS');
        }
        const result = await this.request('generateStatement', {
            accountNumber, dateFrom, dateTo
        }, { timeout: 45000 });
        return result.data || [];
    }
    
    async testConnection() {
        try {
            const result = await this.request('test', {}, { timeout: 5000 });
            return { success: true, message: 'Connected to Google Apps Script', data: result };
        } catch (error) {
            return { success: false, message: error.message, errorCode: error.code };
        }
    }
}

class APIError extends Error {
    constructor(message, code = 'UNKNOWN', metadata = {}) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.metadata = metadata;
    }
}

let gasClient = null;
function initGASClient() {
    if (typeof GAS_CONFIG === 'undefined') {
        console.error('GAS_CONFIG not defined');
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

function getGASClient() {
    if (!gasClient) gasClient = initGASClient();
    return gasClient;
}

window.initGASClient = initGASClient;
window.getGASClient = getGASClient;
window.GASClientV2 = GASClientV2;
window.APIError = APIError;
