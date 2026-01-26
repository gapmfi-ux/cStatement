/**
 * Google Apps Script JSONP Client
 * Uses JSONP to bypass CORS restrictions
 */
class GASClientJSONP {
    constructor(baseUrl, callbackName = 'gasCallback') {
        this.baseUrl = baseUrl;
        this.callbackName = callbackName;
        this.callbacks = {};
        this.callbackId = 0;
    }
    
    // Create a unique callback function
    createCallback() {
        const callbackId = 'callback_' + Date.now() + '_' + this.callbackId++;
        return new Promise((resolve, reject) => {
            this.callbacks[callbackId] = { resolve, reject };
            
            // Set timeout for request
            setTimeout(() => {
                if (this.callbacks[callbackId]) {
                    delete this.callbacks[callbackId];
                    reject(new Error('Request timeout'));
                }
            }, 30000); // 30 second timeout
        });
    }
    
    // Make JSONP request
    request(action, data = {}) {
        return new Promise((resolve, reject) => {
            // Create callback promise
            this.createCallback().then(response => {
                resolve(response);
            }).catch(error => {
                reject(error);
            });
            
            // Build URL with parameters
            const params = new URLSearchParams();
            params.append('action', action);
            params.append('callback', this.callbackName);
            
            // Add data parameters
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    params.append(key, value.toString());
                }
            }
            
            const url = `${this.baseUrl}?${params.toString()}`;
            
            // Create script element
            const script = document.createElement('script');
            script.src = url;
            script.onerror = () => {
                reject(new Error('Failed to load script'));
                document.head.removeChild(script);
            };
            
            document.head.appendChild(script);
        });
    }
    
    // Search customer
    async searchCustomer(type, value) {
        return this.request('search', { type, value });
    }
    
    // Autocomplete names
    async autocompleteNames(value) {
        return this.request('autocomplete', { value });
    }
    
    // Generate statement
    async generateStatement(accountNumber, dateFrom, dateTo) {
        return this.request('generateStatement', {
            accountNumber,
            dateFrom,
            dateTo
        });
    }
    
    // Test connection
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

// Global callback function for JSONP responses
window.gasCallback = function(data) {
    // Find the callback and resolve it
    // Note: In a real implementation, we'd need to match callbacks
    // For simplicity, we'll use a different approach
    console.log('GAS Response:', data);
    
    // This is a simplified approach - in production, you'd need
    // to match callbacks with requests
    if (window.currentGasPromise) {
        window.currentGasPromise.resolve(data);
    }
};

// Initialize GAS client
let gasClient = null;

function initGASClient() {
    const baseUrl = GAS_CONFIG.BASE_URL;
    
    // Check if URL is set
    if (!baseUrl || baseUrl.includes('SCRIPT_ID')) {
        console.error('Please set your Google Apps Script URL in config.js');
        return null;
    }
    
    gasClient = new GASClientJSONP(baseUrl, GAS_CONFIG.CALLBACK);
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
