/**
 * Customer Statement API Client
 * Uses JSONP for cross-domain communication with Google Apps Script
 * Adopted from the api.js pattern
 */
class GASClient {
  constructor(baseUrl) {
    this.BASE_URL = baseUrl || 'https://script.google.com/macros/s/AKfycbzmjPEYq5F9FvV9mFPy91ahKtkkIIsnRoPctEZW7yfeQozYM5JjcVVMBfZOI6GX1VXrHQ/exec';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    this.pendingRequests = new Map(); // Deduplicate concurrent requests
    this.debug = false; // Set to true for debugging
    this.isInitialized = false;
  }

  log(...args) {
    if (this.debug) {
      console.log('[GAS Client]', ...args);
    }
  }

  error(...args) {
    console.error('[GAS Client]', ...args);
  }

  // Generic request method with caching and deduplication
  async request(action, data = {}, options = {}) {
    const cacheKey = `${action}_${JSON.stringify(data)}`;
    const useCache = options.useCache !== false;
    
    // Check cache first
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.log(`Cache hit for ${action}`);
        return cached.data;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    // Deduplicate concurrent requests for the same action
    if (this.pendingRequests.has(cacheKey)) {
      this.log(`Deduplicating request for ${action}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Create the request promise
    const requestPromise = new Promise((resolve, reject) => {
      try {
        // Generate a unique callback name
        const callbackName = 'gas_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Build the URL with parameters
        const url = new URL(this.BASE_URL);
        url.searchParams.append('action', action);
        url.searchParams.append('callback', callbackName);
        
        // Add data parameters
        for (const [key, value] of Object.entries(data)) {
          if (value !== null && value !== undefined && value !== '') {
            url.searchParams.append(key, value.toString());
          }
        }
        
        const fullUrl = url.toString();
        this.log(`Requesting: ${action}`, data);
        
        // Determine timeout based on action
        const isStatementRequest = action === 'generateStatement';
        const timeoutDuration = isStatementRequest ? 30000 : 10000;
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          if (window[callbackName]) {
            delete window[callbackName];
            this.error(`Request timeout for ${action}`);
            reject(new Error(`Request timeout after ${timeoutDuration/1000} seconds`));
          }
        }, timeoutDuration);
        
        // Create the callback function
        window[callbackName] = (response) => {
          clearTimeout(timeoutId);
          delete window[callbackName];
          
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          
          this.log(`Response for ${action}:`, response);
          
          // Check for errors
          if (response && response.error) {
            reject(new Error(response.message || 'GAS error'));
            return;
          }
          
          // Check for success
          if (response && response.success === false) {
            reject(new Error(response.message || 'API request failed'));
            return;
          }
          
          // Cache the response
          this.cache.set(cacheKey, {
            data: response,
            timestamp: Date.now()
          });
          resolve(response);
        };
        
        // Create and add the script tag
        const script = document.createElement('script');
        script.src = fullUrl;
        script.onerror = () => {
          clearTimeout(timeoutId);
          delete window[callbackName];
          if (script.parentNode) script.parentNode.removeChild(script);
          this.error(`Script error for ${action}`);
          reject(new Error('Network error - failed to connect to server'));
        };
        
        document.head.appendChild(script);
        this.log(`Script tag added for ${action}`);
        
      } catch (error) {
        this.error(`Request error for ${action}:`, error);
        reject(error);
      }
    });

    // Store the pending request
    this.pendingRequests.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  // Batch load multiple requests
  async batchRequest(requests) {
    const results = {};
    const promises = [];
    
    for (const [key, { action, data }] of Object.entries(requests)) {
      promises.push(
        this.request(action, data, { showLoading: false })
          .then(result => { results[key] = result; })
          .catch(err => { results[key] = { error: err.message }; })
      );
    }
    
    await Promise.all(promises);
    return results;
  }

  // Clear cache for specific action or all
  clearCache(action = null) {
    if (action) {
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(action)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
      this.log(`Cleared cache for action: ${action}`);
    } else {
      this.cache.clear();
      this.log('Cleared all cache');
    }
  }

  // Initialize/Test connection
  async init(options = {}) {
    try {
      const result = await this.testConnection(options);
      console.log('GAS Client initialized:', result);
      this.isInitialized = true;
      return result.success;
    } catch (error) {
      console.error('GAS Client initialization failed:', error);
      return false;
    }
  }

  // ============================================
  // CUSTOMER STATEMENT API
  // ============================================
  
  async searchCustomer(type, value, options = {}) {
    if (!value || !value.trim()) {
      return null;
    }
    return this.request('search', { type, value: value.trim() }, options);
  }
  
  async autocompleteNames(value, options = {}) {
    if (!value || !value.trim() || value.trim().length < 2) {
      return [];
    }
    const result = await this.request('autocomplete', { value: value.trim() }, options);
    
    // Ensure we always return an array
    if (!result || !Array.isArray(result)) {
      this.log('Autocomplete result is not an array:', result);
      return [];
    }
    
    return result;
  }
  
  async generateStatement(accountNumber, dateFrom, dateTo, options = {}) {
    if (!accountNumber || !accountNumber.trim()) {
      throw new Error('Account number is required');
    }
    
    const result = await this.request('generateStatement', {
      accountNumber: accountNumber.trim(),
      dateFrom: dateFrom || '',
      dateTo: dateTo || ''
    }, { useCache: false, ...options });
    
    // Ensure we always return an array
    if (!result || !Array.isArray(result)) {
      this.log('Statement result is not an array:', result);
      return [];
    }
    
    return result;
  }

  // ============================================
  // TEST CONNECTION
  // ============================================
  
  async testConnection(options = {}) {
    try {
      const response = await this.request('test', {}, { useCache: false, ...options });
      return {
        success: true,
        message: 'Connected to Google Apps Script',
        data: response
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection failed: ' + error.message
      };
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  
  // Get customer details by account number
  async getCustomerByAccount(accountNumber, options = {}) {
    if (!accountNumber || !accountNumber.trim()) {
      return null;
    }
    return this.request('search', { type: 'accountNumber', value: accountNumber.trim() }, options);
  }
  
  // Get customer details by customer ID
  async getCustomerById(customerId, options = {}) {
    if (!customerId || !customerId.trim()) {
      return null;
    }
    return this.request('search', { type: 'customerId', value: customerId.trim() }, options);
  }
  
  // Get customer details by account name
  async getCustomerByName(accountName, options = {}) {
    if (!accountName || !accountName.trim()) {
      return null;
    }
    return this.request('search', { type: 'accountName', value: accountName.trim() }, options);
  }
}

// Global GAS Client instance
let gasClient = null;

// Initialize the GAS client
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

// For backward compatibility with existing code
window.GASClient = GASClient;
window.initGASClient = initGASClient;
window.getGASClient = getGASClient;
