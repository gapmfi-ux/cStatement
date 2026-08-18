/**
 * Simple Google Apps Script Client
 * Uses JSONP for cross-domain communication
 */
class GASClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.isInitialized = false;
        this.pendingRequests = new Map();
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
        return this.makeJSONPRequest(action, data);
    }
    
    // JSONP request - Fixed callback execution order
    makeJSONPRequest(action, data = {}) {
        return new Promise((resolve, reject) => {
            // Create unique callback name
            const callbackName = 'gasCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Create script element
            const script = document.createElement('script');
            let isCompleted = false;
            
            // Define callback on window BEFORE adding script to DOM
            window[callbackName] = (response) => {
                if (isCompleted) return;
                isCompleted = true;
                
                // Clean up
                clearTimeout(timeout);
                
                // Remove script
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                
                // Delete callback
                if (window[callbackName]) {
                    delete window[callbackName];
                }
                
                // Check for GAS errors
                if (response && response.error) {
                    reject(new Error(response.message || 'GAS error'));
                } else {
                    resolve(response);
                }
            };
            
            // Build URL
            const params = new URLSearchParams();
            params.append('action', action);
            params.append('callback', callbackName);
            
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined && value !== '') {
                    params.append(key, value.toString());
                }
            }
            
            const url = `${this.baseUrl}?${params.toString()}`;
            script.src = url;
            
            // Determine timeout based on action
            const isStatementRequest = action === 'generateStatement';
            const timeoutDuration = isStatementRequest ? 30000 : 10000;
            
            const timeout = setTimeout(() => {
                if (isCompleted) return;
                isCompleted = true;
                
                // Clean up
                if (window[callbackName]) {
                    delete window[callbackName];
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error(`Request timeout (${timeoutDuration/1000}s)`));
            }, timeoutDuration);
            
            // Handle error
            script.onerror = () => {
                if (isCompleted) return;
                isCompleted = true;
                
                clearTimeout(timeout);
                if (window[callbackName]) {
                    delete window[callbackName];
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error('Failed to load script'));
            };
            
            // ADD SCRIPT TO DOCUMENT - callback is already defined
            document.head.appendChild(script);
        });
    }
    
    async searchCustomer(type, value) {
        if (!value || !value.trim()) {
            return null;
        }
        return this.request('search', { type, value: value.trim() });
    }
    
    async autocompleteNames(value) {
        if (!value || !value.trim()) {
            return [];
        }
        const result = await this.request('autocomplete', { value: value.trim() });
        
        // If the result is not an array, return an empty array
        if (!result || !Array.isArray(result)) {
            console.warn('Autocomplete result is not an array:', result);
            return [];
        }
        
        return result;
    }
    
    async generateStatement(accountNumber, dateFrom, dateTo) {
        if (!accountNumber || !accountNumber.trim()) {
            throw new Error('Account number is required');
        }
        return this.request('generateStatement', {
            accountNumber: accountNumber.trim(),
            dateFrom: dateFrom || '',
            dateTo: dateTo || ''
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

// Ensure GAS_CONFIG is defined before initializing client
function initGASClient() {
    // Verify config exists
    if (typeof GAS_CONFIG === 'undefined') {
        console.error('GAS_CONFIG is not defined. Please check config.js is loaded first.');
        return null;
    }
    
    const baseUrl = GAS_CONFIG.BASE_URL;
    
    // Check if URL is set
    if (!baseUrl || baseUrl.includes('SCRIPT_ID') || baseUrl.includes('your-script-id')) {
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
window.GASClient = GASClient;
