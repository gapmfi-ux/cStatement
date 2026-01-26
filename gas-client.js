/**
 * Google Apps Script API Client
 */
class GASClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    
    async request(action, data = null) {
        const url = this.baseUrl;
        
        // Create URL with parameters for GET, or use POST
        let options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            mode: 'cors', // Important for CORS
            cache: 'no-cache'
        };
        
        // Create form data
        const formData = new URLSearchParams();
        formData.append('action', action);
        
        if (data && typeof data === 'object') {
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    formData.append(key, value.toString());
                }
            }
        }
        
        options.body = formData.toString();
        
        try {
            const response = await fetch(url, options);
            
            // Check if response is OK
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            
            // Try to parse as JSON
            try {
                return JSON.parse(text);
            } catch (jsonError) {
                // If not JSON, check if it's an error message from GAS
                if (text.includes('Exception') || text.includes('Error')) {
                    throw new Error('Google Apps Script error');
                }
                return text;
            }
        } catch (error) {
            console.error('GAS Request failed:', error);
            
            // More specific error messages
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to Google Apps Script. Check deployment and CORS settings.');
            }
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                throw new Error('Access denied. Please ensure GAS is deployed with "Anyone" access.');
            }
            if (error.message.includes('403')) {
                throw new Error('Forbidden. Check GAS deployment permissions.');
            }
            
            throw error;
        }
    }
    
    async searchCustomer(type, value) {
        return this.request('search', { type, value });
    }
    
    async autocompleteNames(value) {
        return this.request('autocomplete', { value });
    }
    
    async generateStatement(accountNumber, dateFrom, dateTo) {
        return this.request('generateStatement', {
            accountNumber,
            dateFrom,
            dateTo
        });
    }
    
    async testConnection() {
        try {
            const result = await this.request('test');
            return {
                success: true,
                message: 'Connected to Google Apps Script',
                data: result
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
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
        console.error('Please set your Google Apps Script URL in config.js');
        return null;
    }
    
    // Validate URL format
    if (!baseUrl.includes('https://script.google.com/macros/s/')) {
        console.error('Invalid GAS URL format. Should start with: https://script.google.com/macros/s/');
        return null;
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
window.getGASClient = getGASClient;
window.initGASClient = initGASClient;
