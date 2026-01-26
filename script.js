// API Service
class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async searchCustomer(type, value) {
        return this.request(API_CONFIG.ENDPOINTS.SEARCH, {
            method: 'POST',
            body: JSON.stringify({ type, value })
        });
    }

    async autocompleteNames(value) {
        return this.request(API_CONFIG.ENDPOINTS.AUTOCOMPLETE, {
            method: 'POST',
            body: JSON.stringify({ value })
        });
    }

    async generateStatement(accountNumber, dateFrom, dateTo) {
        return this.request(API_CONFIG.ENDPOINTS.STATEMENT, {
            method: 'POST',
            body: JSON.stringify({ accountNumber, dateFrom, dateTo })
        });
    }
}

// Initialize API service
const apiService = new ApiService(API_CONFIG.BASE_URL);

// State Management
let currentCustomer = null;
let autocompleteResults = [];

// UI Utility Functions
class UIUtils {
    static showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    static hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    static showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'flex';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    static formatCurrency(amount) {
        if (amount === undefined || amount === null) return '0.00';
        
        const num = typeof amount === 'string' 
            ? parseFloat(amount.replace(/[^\d.-]/g, '')) 
            : Number(amount);
            
        return isNaN(num) ? '0.00' : num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    static formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    static showSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
        }
    }

    static hideSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
        }
    }
}

// Event Handlers
function getSelectedSearchType() {
    const radios = document.getElementsByName('searchType');
    for (let radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'accountName';
}

async function search() {
    const type = getSelectedSearchType();
    const value = document.getElementById('searchInput').value.trim();
    
    if (!value) {
        UIUtils.showToast('Please enter a search value', 'warning');
        return;
    }

    UIUtils.showLoading();

    try {
        const customer = await apiService.searchCustomer(type, value);
        
        if (customer) {
            displayCustomer(customer);
            currentCustomer = customer;
            UIUtils.showSection('detailsSection');
            UIUtils.showSection('statementsSection');
            UIUtils.showToast('Customer found successfully', 'success');
        } else {
            clearCustomerDetails();
            UIUtils.showToast('No customer found', 'warning');
        }
    } catch (error) {
        console.error('Search error:', error);
        UIUtils.showToast('Error searching customer', 'error');
    } finally {
        UIUtils.hideLoading();
    }
}

function displayCustomer(customer) {
    document.getElementById('accountName').textContent = customer.accountName || '-';
    document.getElementById('accountNumber').textContent = customer.accountNumber || '-';
    document.getElementById('customerId').textContent = customer.customerId || '-';
    document.getElementById('clearBalance').textContent = 
        UIUtils.formatCurrency(customer.clearBalance);
}

function clearCustomerDetails() {
    document.getElementById('accountName').textContent = '-';
    document.getElementById('accountNumber').textContent = '-';
    document.getElementById('customerId').textContent = '-';
    document.getElementById('clearBalance').textContent = '-';
    currentCustomer = null;
}

function clearAll() {
    document.getElementById('searchInput').value = '';
    clearCustomerDetails();
    hideAutocompleteDropdown();
    UIUtils.hideSection('detailsSection');
    UIUtils.hideSection('statementsSection');
    UIUtils.showToast('Search cleared', 'success');
}

// Autocomplete functionality
const showAutocompleteSuggestions = debounce(async function() {
    const type = getSelectedSearchType();
    const value = document.getElementById('searchInput').value.trim();
    const dropdown = document.getElementById('autocompleteDropdown');
    
    if (type !== 'accountName' || !value) {
        hideAutocompleteDropdown();
        return;
    }

    try {
        const results = await apiService.autocompleteNames(value);
        autocompleteResults = results || [];
        
        if (autocompleteResults.length === 0) {
            hideAutocompleteDropdown();
            return;
        }
        
        dropdown.innerHTML = '';
        autocompleteResults.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `
                <i class="fas fa-user-circle"></i>
                <div>
                    <strong>${item.accountName || 'Unknown'}</strong>
                    <small>${item.accountNumber || ''}</small>
                </div>
            `;
            div.onclick = () => selectAutocomplete(index);
            dropdown.appendChild(div);
        });
        
        dropdown.classList.remove('autocomplete-hidden');
    } catch (error) {
        console.error('Autocomplete error:', error);
        hideAutocompleteDropdown();
    }
}, 300);

function selectAutocomplete(index) {
    const selected = autocompleteResults[index];
    if (!selected) return;
    
    document.getElementById('searchInput').value = selected.accountName || '';
    hideAutocompleteDropdown();
    displayCustomer(selected);
    currentCustomer = selected;
    UIUtils.showSection('detailsSection');
    UIUtils.showSection('statementsSection');
}

function hideAutocompleteDropdown() {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (dropdown) {
        dropdown.classList.add('autocomplete-hidden');
    }
}

// Statement Generation
async function generateStatement() {
    if (!currentCustomer || !currentCustomer.accountNumber) {
        UIUtils.showToast('Please select a customer first', 'warning');
        return;
    }

    const accountNumber = currentCustomer.accountNumber;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    // Validate dates
    if (dateFrom && dateTo && dateFrom > dateTo) {
        UIUtils.showToast('From date cannot be after To date', 'warning');
        return;
    }

    UIUtils.showLoading();

    try {
        const statement = await apiService.generateStatement(accountNumber, dateFrom, dateTo);
        displayStatement(statement);
        UIUtils.showToast('Statement generated successfully', 'success');
    } catch (error) {
        console.error('Statement generation error:', error);
        UIUtils.showToast('Error generating statement', 'error');
    } finally {
        UIUtils.hideLoading();
    }
}

function displayStatement(statementData) {
    const container = document.getElementById('statementResults');
    
    if (!statementData || !Array.isArray(statementData.transactions)) {
        container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-triangle"></i>
                <p>No statement data available</p>
            </div>
        `;
        return;
    }

    const { transactions, openingBalance, closingBalance } = statementData;
    
    let tableHTML = `
        <table class="statement-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Add opening balance row
    if (openingBalance !== undefined) {
        tableHTML += `
            <tr class="opening-row">
                <td colspan="2">OPENING BALANCE</td>
                <td></td>
                <td></td>
                <td class="balance">${UIUtils.formatCurrency(openingBalance)}</td>
            </tr>
        `;
    }

    // Add transaction rows
    let runningBalance = openingBalance || 0;
    
    transactions.forEach(transaction => {
        const debit = transaction.type === 'DEBIT' ? transaction.amount : '';
        const credit = transaction.type === 'CREDIT' ? transaction.amount : '';
        
        if (transaction.type === 'DEBIT') {
            runningBalance -= transaction.amount;
        } else if (transaction.type === 'CREDIT') {
            runningBalance += transaction.amount;
        }

        tableHTML += `
            <tr>
                <td>${UIUtils.formatDate(transaction.date)}</td>
                <td>${transaction.description || ''}</td>
                <td class="debit">${debit ? UIUtils.formatCurrency(debit) : ''}</td>
                <td class="credit">${credit ? UIUtils.formatCurrency(credit) : ''}</td>
                <td class="balance">${UIUtils.formatCurrency(runningBalance)}</td>
            </tr>
        `;
    });

    // Add closing balance row
    if (closingBalance !== undefined) {
        tableHTML += `
            <tr class="total-row">
                <td colspan="2">CLOSING BALANCE</td>
                <td></td>
                <td></td>
                <td class="balance">${UIUtils.formatCurrency(closingBalance)}</td>
            </tr>
        `;
    }

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

// Modal Functions
function openStatementModal() {
    if (!currentCustomer) {
        UIUtils.showToast('Please select a customer first', 'warning');
        return;
    }

    // Create modal HTML
    const modalHTML = `
        <div class="modal-overlay" id="statementModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-file-invoice-dollar"></i> Statement Details</h3>
                    <button class="close-btn" onclick="closeStatementModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="modal-customer-info">
                        <div class="info-item">
                            <label>Customer:</label>
                            <span>${currentCustomer.accountName}</span>
                        </div>
                        <div class="info-item">
                            <label>Account Number:</label>
                            <span>${currentCustomer.accountNumber}</span>
                        </div>
                        <div class="info-item">
                            <label>Current Balance:</label>
                            <span>${UIUtils.formatCurrency(currentCustomer.clearBalance)}</span>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="printStatement()">
                            <i class="fas fa-print"></i> Print Statement
                        </button>
                        <button class="btn btn-secondary" onclick="exportStatement()">
                            <i class="fas fa-download"></i> Export as PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;
    document.getElementById('statementModal').style.display = 'flex';
}

function closeStatementModal() {
    const modal = document.getElementById('statementModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function printStatement() {
    window.print();
}

function exportStatement() {
    UIUtils.showToast('Export feature coming soon', 'info');
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Search input events
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', showAutocompleteSuggestions);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                search();
            }
        });
        
        searchInput.addEventListener('blur', function() {
            setTimeout(hideAutocompleteDropdown, 200);
        });
    }

    // Date inputs default values
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('dateFrom').valueAsDate = firstDay;
    document.getElementById('dateTo').valueAsDate = today;

    // Search type change
    const searchTypeRadios = document.querySelectorAll('input[name="searchType"]');
    searchTypeRadios.forEach(radio => {
        radio.addEventListener('change', hideAutocompleteDropdown);
    });

    // Prevent form submission
    document.addEventListener('submit', function(e) {
        e.preventDefault();
    });

    // Click outside autocomplete dropdown
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('autocompleteDropdown');
        if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
            hideAutocompleteDropdown();
        }
    });
});

// Error handling
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', { message, source, lineno, colno, error });
    UIUtils.showToast('An unexpected error occurred', 'error');
};
