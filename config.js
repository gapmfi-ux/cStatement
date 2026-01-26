// API Configuration
const API_CONFIG = {
    BASE_URL: 'https://your-backend-api.com', // Replace with your backend URL
    ENDPOINTS: {
        SEARCH: '/api/search',
        AUTOCOMPLETE: '/api/autocomplete',
        STATEMENT: '/api/statement',
        CUSTOMERS: '/api/customers'
    },
    
    // Headers for API requests
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

// Validation patterns
const VALIDATION = {
    ACCOUNT_NUMBER: /^\d{6,13}$/,
    DATE: /^\d{4}-\d{2}-\d{2}$/
};
