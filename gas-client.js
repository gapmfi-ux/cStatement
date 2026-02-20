/**
 * Simple Google Apps Script Client
 * Uses JSONP for cross-domain communication
 */
class GASClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.isInitialized = false;
    }
    
    async init() {
        try {
            // Test connection
            const testResult = await this.request('test', {});
            console.log('GAS Client initialized:', testResult);
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('GAS Client initialization failed:', error);
            return false;
        }
    }
    
    async request(action, data = {}) {
        // Use JSONP directly for all requests
        return this.makeJSONPRequest(action, data);
    }
    
    // JSONP request - FIXED: Define callback BEFORE adding script to DOM
    makeJSONPRequest(action, data = {}) {
        return new Promise((resolve, reject) => {
            // Create unique callback name with timestamp and random suffix
            const callbackName = 'gasCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Create script element FIRST
            const script = document.createElement('script');
            
            // **DEFINE CALLBACK IMMEDIATELY** - before the script is added to DOM
            window[callbackName] = (response) => {
                clearTimeout(timeout);
                
                // Clean up
                if (window[callbackName]) {
                    delete window[callbackName];
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                
                // Check for GAS errors
                if (response && response.error) {
                    reject(new Error(response.message || 'GAS error'));
                } else {
                    resolve(response);
                }
            };
            
            // Build URL with query parameters
            const params = new URLSearchParams();
            params.append('action', action);
            params.append('callback', callbackName);
            
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    params.append(key, value.toString());
                }
            }
            
            const url = `${this.baseUrl}?${params.toString()}`;
            script.src = url;
            
            // Determine timeout based on action
            const isStatementRequest = action === 'generateStatement';
            const timeoutDuration = isStatementRequest ? 30000 : 10000; // 30 seconds for statements, 10 for others
            
            // Set timeout
            const timeout = setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error(`Request timeout (${timeoutDuration/1000}s)`));
            }, timeoutDuration);
            
            // Handle script load error
            script.onerror = () => {
                clearTimeout(timeout);
                if (window[callbackName]) {
                    delete window[callbackName];
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error('Failed to load script'));
            };
            
            // **ADD SCRIPT TO DOCUMENT LAST** - after callback is defined
            document.head.appendChild(script);
        });
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
            const result = await this.request('test', {});
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

// Global GAS Client instance
let gasClient = null;

function initGASClient() {
    const baseUrl = GAS_CONFIG.BASE_URL;
    
    // Check if URL is set
    if (!baseUrl || baseUrl.includes('SCRIPT_ID')) {
        console.error('Please set your Google Apps Script URL in config.js');
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
window.initGASClient = initGASClient;
window.getGASClient = getGASClient;
