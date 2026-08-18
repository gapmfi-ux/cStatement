class ApiService {
  constructor(baseUrl) {
    this.BASE_URL = baseUrl;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.pendingRequests = new Map(); // Deduplicate concurrent requests
    this.debug = (typeof GAS_CONFIG !== 'undefined' && GAS_CONFIG.ENABLE_DEBUG) || false;
  }

  log(...args) {
    if (this.debug) {
      console.log('[API]', ...args);
    }
  }
 
  error(...args) {
    console.error('[API]', ...args);
  }

  async request(action, data = {}, options = {}) {
    const timeout = options.timeout || (GAS_CONFIG && GAS_CONFIG.TIMEOUT) || 30000;
    const useCache = options.useCache !== false;
    const cacheKey = `${action}_${JSON.stringify(data)}`;

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

    // Deduplicate concurrent requests for the same action+params
    if (this.pendingRequests.has(cacheKey)) {
      this.log(`Deduplicating request for ${action}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Create the request promise
    const requestPromise = this._fetchRequest(action, data, timeout);

    // Store pending request for deduplication
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache successful response
      if (result && result.success !== false) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }
      
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Execute the actual fetch request
   * @private
   */
  async _fetchRequest(action, data, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Build FormData body
      const body = new FormData();
      body.append('action', action);
      
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
          body.append(key, String(value));
        }
      }

      this.log(`Fetching ${action} with timeout ${timeout}ms from ${this.BASE_URL}`);

      // Make POST request with Fetch API
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        body: body,
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      this.log(`Response status: ${response.status} ${response.statusText}`);

      // Parse response
      let responseData;
      try {
        const text = await response.text();
        this.log(`Response text: ${text.substring(0, 200)}`);
        responseData = text ? JSON.parse(text) : {};
      } catch (parseError) {
        throw new ApiError(
          'Invalid JSON response from server',
          'PARSE_ERROR',
          { status: response.status, statusText: response.statusText }
        );
      }

      // Check HTTP status
      if (!response.ok) {
        throw new ApiError(
          responseData.message || `HTTP ${response.status}`,
          response.status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR',
          responseData
        );
      }

      // Check for application errors
      if (responseData.error) {
        throw new ApiError(
          responseData.message || 'Server error',
          responseData.errorCode || 'SERVER_ERROR',
          responseData
        );
      }

      this.log(`Response received for ${action}:`, responseData);
      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        this.error(`API Error in ${action}:`, error.message);
        throw error;
      }

      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        const timeoutError = new ApiError(
          `Request timeout after ${timeout}ms`,
          'TIMEOUT',
          { action, timeout }
        );
        this.error(`Timeout in ${action}`);
        throw timeoutError;
      }

      // Handle CORS errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const corsError = new ApiError(
          'CORS Error: The GAS deployment may not be configured for your domain. ' +
          'Ensure the GAS is deployed with "Execute as: Me" and "Who has access: Anyone"',
          'CORS_ERROR',
          { action, originalError: error.message }
        );
        this.error(`CORS Error in ${action}:`, corsError.message);
        throw corsError;
      }

      // Generic network error
      const networkError = new ApiError(
        error.message || 'Network error',
        'NETWORK_ERROR',
        { action, originalError: error.toString() }
      );
      this.error(`Network Error in ${action}:`, networkError.message);
      throw networkError;

    }
  }

  /**
   * Batch load multiple requests concurrently
   */
  async batchRequest(requests) {
    const results = {};
    const promises = [];

    for (const [key, { action, data }] of Object.entries(requests)) {
      promises.push(
        this.request(action, data, { useCache: false })
          .then(result => { results[key] = result; })
          .catch(err => { results[key] = { error: err.message, code: err.code }; })
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Clear cache for specific action or all
   */
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

  /**
   * Test connection to backend
   */
  async testConnection() {
    try {
      const response = await this.request('test', {}, { useCache: false });
      return {
        connected: response && response.success !== false,
        message: response && response.message || 'Connected to server',
        timestamp: response && response.timestamp
      };
    } catch (error) {
      return {
        connected: false,
        message: `Connection failed: ${error.message}`,
        errorCode: error.code
      };
    }
  }

  // ============================================
  // CUSTOMER STATEMENT API
  // ============================================

  async searchCustomer(type, value, options = {}) {
    if (!type || !value) {
      throw new ApiError('Search type and value are required', 'INVALID_PARAMS');
    }

    const result = await this.request('search', { type, value }, options);
    
    if (!result.data) {
      throw new ApiError('Customer not found', 'NOT_FOUND');
    }
    
    return result.data;
  }

  async autocompleteNames(value, options = {}) {
    if (!value || value.length < 1) {
      return [];
    }

    const result = await this.request('autocomplete', { value }, { ...options, useCache: false });
    return result.data || [];
  }

  async generateStatement(accountNumber, dateFrom, dateTo, options = {}) {
    if (!accountNumber) {
      throw new ApiError('Account number is required', 'INVALID_PARAMS');
    }

    const timeout = (GAS_CONFIG && GAS_CONFIG.STATEMENT_TIMEOUT) || 45000;
    const result = await this.request('generateStatement', {
      accountNumber,
      dateFrom,
      dateTo
    }, { ...options, timeout });

    return result.data || [];
  }

  /**
   * Get detailed metrics (for debugging)
   */
  getMetrics() {
    return {
      baseUrl: this.BASE_URL,
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, code = 'UNKNOWN', metadata = {}) {
    super(message);
    this.name = 'ApiError';
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

function initApiService() {
  if (typeof GAS_CONFIG === 'undefined') {
    console.error('GAS_CONFIG not defined in config.js');
    return null;
  }

  const baseUrl = GAS_CONFIG.BASE_URL;
  if (!baseUrl || baseUrl.includes('SCRIPT_ID')) {
    console.error('Please set your Google Apps Script URL in config.js');
    return null;
  }

  const apiService = new ApiService(baseUrl);
  console.log('ApiService initialized:', apiService.getMetrics());
  return apiService;
}

function getApiService() {
  if (!window.apiService) {
    window.apiService = initApiService();
  }
  return window.apiService;
}

// Make globally available
window.ApiService = ApiService;
window.ApiError = ApiError;
window.initApiService = initApiService;
window.getApiService = getApiService;
