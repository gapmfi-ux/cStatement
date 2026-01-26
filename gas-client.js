/**
 * Google Apps Script API Client
 * Handles communication with GAS backend
 */
class GASClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.scriptId = this.extractScriptId(baseUrl);
        this.isAuthenticated = false;
        this.accessToken = null;
    }
    
    extractScriptId(url) {
        const match = url.match(/\/macros\/s\/([^\/]+)/);
        return match ? match[1] : null;
    }
    
    /**
     * Initialize Google API client
     */
    async init() {
        return new Promise((resolve, reject) => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: '', // Not needed for GAS
                        discoveryDocs: [],
                    });
                    resolve(true);
                } catch (error) {
                    console.warn('Google API client init failed, using fallback:', error);
                    resolve(false); // Fallback to fetch
                }
            });
        });
    }
    
    /**
     * Make a request to GAS endpoint
     */
    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            mode: 'cors', // Important for GAS CORS
            cache: 'no-cache'
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            
            // GAS returns HTML error pages sometimes, handle them
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                if (text.includes('Service invoked too many times')) {
                    throw new Error('Google Apps Script quota exceeded. Please try again later.');
                }
                if (text.includes('error')) {
                    throw new Error('Google Apps Script returned an error.');
                }
                // Try to parse as JSON anyway
                try {
                    return JSON.parse(text);
                } catch {
                    throw new Error('Invalid response from Google Apps Script.');
                }
            }
            
            const result = await response.json();
            
            // Handle GAS errors
            if (result.error) {
                throw new Error(result.error.message || 'Google Apps Script error');
            }
            
            return result;
            
        } catch (error) {
            console.error('GAS Request failed:', error);
            
            // Handle specific GAS errors
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to Google Apps Script. Check deployment and CORS settings.');
            }
            if (error.message.includes('quota')) {
                throw new Error('Google Apps Script quota limit reached. Try again later.');
            }
            
            throw error;
        }
    }
    
    /**
     * Search for customer
     */
    async searchCustomer(type, value) {
        return this.request('/search', 'POST', { type, value });
    }
    
    /**
     * Get autocomplete suggestions
     */
    async autocompleteNames(value) {
        return this.request('/autocomplete', 'POST', { value });
    }
    
    /**
     * Generate statement
     */
    async generateStatement(accountNumber, dateFrom, dateTo) {
        return this.request('/generateStatement', 'POST', {
            accountNumber,
            dateFrom,
            dateTo
        });
    }
    
    /**
     * Get all customers (for debugging)
     */
    async getAllCustomers() {
        return this.request('/getCustomers', 'GET');
    }
    
    /**
     * Test connection to GAS
     */
    async testConnection() {
        try {
            const response = await this.request('/test', 'GET');
            return {
                success: true,
                message: 'Connected to Google Apps Script successfully',
                data: response
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
}

// Singleton instance
let gasClient = null;

/**
 * Initialize GAS client
 */
async function initGASClient() {
    const baseUrl = GAS_CONFIG.BASE_URL;
    
    // Check if URL is set
    if (!baseUrl || baseUrl.includes('YOUR_SCRIPT_ID')) {
        throw new Error('Please set your Google Apps Script deployment URL in config.js');
    }
    
    gasClient = new GASClient(baseUrl);
    await gasClient.init();
    return gasClient;
}

/**
 * Get GAS client instance
 */
function getGASClient() {
    if (!gasClient) {
        throw new Error('GAS client not initialized. Call initGASClient() first.');
    }
    return gasClient;
}
