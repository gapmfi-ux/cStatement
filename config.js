// Google Apps Script Configuration
const GAS_CONFIG = {
    // Replace with your deployed GAS web app URL
    BASE_URL: 'https://script.google.com/macros/s/AKfycbzmjPEYq5F9FvV9mFPy91ahKtkkIIsnRoPctEZW7yfeQozYM5JjcVVMBfZOI6GX1VXrHQ/exec',
    
    // GAS endpoints
    ENDPOINTS: {
        SEARCH: '',
        AUTOCOMPLETE: '',
        GENERATE_STATEMENT: ''
    }
};

// Error messages
const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network error. Please check your connection.',
    GAS_ERROR: 'Google Apps Script error. Please try again.',
    INVALID_INPUT: 'Please check your input values.',
    NO_DATA: 'No data found.',
    NO_CUSTOMER: 'Please select a customer first.'
};
