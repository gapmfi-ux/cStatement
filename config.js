// Google Apps Script Deployment Configuration
const GAS_CONFIG = {
    // Replace with your deployed GAS web app URL
    // Format: https://script.google.com/macros/s/SCRIPT_ID/exec
    BASE_URL: 'https://script.google.com/macros/s/AKfycbzmjPEYq5F9FvV9mFPy91ahKtkkIIsnRoPctEZW7yfeQozYM5JjcVVMBfZOI6GX1VXrHQ/exec',
    
    // GAS endpoints (these match the doPost/doGet functions in GAS)
    ENDPOINTS: {
        // GET endpoints
        GET_CUSTOMERS: '/getCustomers',
        AUTOCOMPLETE: '/autocomplete',
        
        // POST endpoints (use doPost in GAS)
        SEARCH: '/search',
        GENERATE_STATEMENT: '/generateStatement'
    },
    
    // Headers for GAS requests (important for CORS)
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
};

// Validation patterns
const VALIDATION = {
    ACCOUNT_NUMBER: /^\d{6,13}$/,
    DATE: /^\d{4}-\d{2}-\d{2}$/
};

// Error messages
const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network error. Please check your connection.',
    GAS_ERROR: 'Google Apps Script error. Please try again.',
    INVALID_INPUT: 'Please check your input values.',
    NO_DATA: 'No data found.'
};
