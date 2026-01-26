/**
 * Google Apps Script API Client
 */
class GASClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    
    async request(action, method = 'POST', data = null) {
        const url = this.baseUrl;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        if (data) {
            const params = new URLSearchParams();
            params.append('action', action);
            
            if (typeof data === 'object') {
                for (const [key, value] of Object.entries(data)) {
                    if (value !== null && value !== undefined) {
                        params.append(key, value);
                    }
                }
            }
            
            options.body = params.toString();
        } else if (method === 'POST') {
            const params = new URLSearchParams();
            params.append('action', action);
            options.body = params.toString();
        }
        
        try {
            const response = await fetch(url, options);
            const text = await response.text();
            
            // Try to parse as JSON
            try {
                return JSON.parse(text);
            } catch {
                // If not JSON, return as is
                return text;
            }
        } catch (error) {
            console.error('GAS Request failed:', error);
            throw error;
        }
    }
    
    async searchCustomer(type, value) {
        return this.request('search', 'POST', { type, value });
    }
    
    async autocompleteNames(value) {
        return this.request('autocomplete', 'POST', { value });
    }
    
    async generateStatement(accountNumber, dateFrom, dateTo) {
        return this.request('generateStatement', 'POST', {
            accountNumber,
            dateFrom,
            dateTo
        });
    }
    
    async testConnection() {
        try {
            const response = await this.request('test', 'GET');
            return {
                success: true,
                message: 'Connected to Google Apps Script',
                data: response
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Connection failed'
            };
        }
    }
}

// Initialize GAS client
let gasClient = null;

function initGASClient() {
    const baseUrl = GAS_CONFIG.BASE_URL;
    
    // Check if URL is set
    if (!baseUrl || baseUrl.includes('SCRIPT_ID')) {
        throw new Error('Please set your Google Apps Script URL in config.js');
    }
    
    gasClient = new GASClient(baseUrl);
    return gasClient;
}

function getGASClient() {
    if (!gasClient) {
        gasClient = initGASClient();
    }
    return gasClient;
}

// Make globally available
window.initGASClient = initGASClient;
window.getGASClient = getGASClient;
