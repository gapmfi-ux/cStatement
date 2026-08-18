// Google Apps Script Configuration
const GAS_CONFIG = {
    // Your deployed GAS web app URL
    // Replace with your actual URL from "Deploy > New deployment" in Google Apps Script
    BASE_URL: 'https://script.google.com/macros/s/AKfycbzmjPEYq5F9FvV9mFPy91ahKtkkIIsnRoPctEZW7yfeQozYM5JjcVVMBfZOI6GX1VXrHQ/exec'
};

// Validate URL on load
if (typeof GAS_CONFIG !== 'undefined' && GAS_CONFIG.BASE_URL) {
    if (GAS_CONFIG.BASE_URL.includes('your-script-id') || GAS_CONFIG.BASE_URL.includes('SCRIPT_ID')) {
        console.warn('⚠️ Please update GAS_CONFIG.BASE_URL with your actual Google Apps Script URL');
    }
}
