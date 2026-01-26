/**
 * Simple Google Apps Script Client
 * Uses fetch with form data
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
        const url = this.baseUrl;
        
        // Create form data
        const formData = new URLSearchParams();
        formData.append('action', action);
        
        // Add data parameters
        for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== undefined) {
                formData.append(key, value.toString());
            }
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                mode: 'no-cors', // Use no-cors to avoid CORS issues
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            });
            
            // With no-cors mode, we can't read the response
            // So we need to handle this differently
            console.log('Request sent to GAS:', action, data);
            
            // Since we can't read the response in no-cors mode,
            // we'll use a different approach
            return this.makeJSONPRequest(action, data);
            
        } catch (error) {
            console.error('GAS Request failed:', error);
            throw error;
        }
    }
    
    // Alternative: JSONP request
    makeJSONPRequest(action, data = {}) {
        return new Promise((resolve, reject) => {
            // Create unique callback name
            const callbackName = 'gasCallback_' + Date.now();
            
            // Build URL
            const params = new URLSearchParams();
            params.append('action', action);
            params.append('callback', callbackName);
            
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    params.append(key, value.toString());
                }
            }
            
            const url = `${this.baseUrl}?${params.toString()}`;
            
            // Create script element
            const script = document.createElement('script');
            script.src = url;
            
            // Set timeout
            const timeout = setTimeout(() => {
                window[callbackName] = null;
                document.head.removeChild(script);
                reject(new Error('Request timeout'));
            }, 10000);
            
            // Define callback
            window[callbackName] = (response) => {
                clearTimeout(timeout);
                window[callbackName] = null;
                document.head.removeChild(script);
                resolve(response);
            };
            
            // Handle error
            script.onerror = () => {
                clearTimeout(timeout);
                window[callbackName] = null;
                document.head.removeChild(script);
                reject(new Error('Failed to load script'));
            };
            
            // Add script to document
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
