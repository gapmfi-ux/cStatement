/**
 * Main Application Script
 */

// Application State
const AppState = {
    currentCustomer: null,
    currentStatement: null,
    autocompleteResults: [],
    isLoading: false
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

// Initialize application
async function initApp() {
    try {
        // Initialize GAS client
        initGASClient();
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup default dates
        setupDefaultDates();
        
        // Load any stored data
        checkStoredData();
        
        UIUtils.showToast('Application initialized', 'success');
        
    } catch (error) {
        console.error('Initialization failed:', error);
        UIUtils.showToast(`Initialization failed: ${error.message}`, 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search input events
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearchInput, 300));
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchCustomer();
        });
    }
    
    // Autocomplete click outside
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('autocompleteDropdown');
        if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
            hideAutocompleteDropdown();
        }
    });
    
    // Date validation
    const dateFrom = document.getElementById('modalPeriodFromInput');
    const dateTo = document.getElementById('modalPeriodToInput');
    
    if (dateFrom && dateTo) {
        dateFrom.addEventListener('change', validateDates);
        dateTo.addEventListener('change', validateDates);
    }
}

// Get selected search type
function getSelectedSearchType() {
    const radios = document.getElementsByName('searchType');
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
            return radios[i].value;
        }
    }
    return 'accountName';
}

// Handle search input
async function handleSearchInput() {
    const type = getSelectedSearchType();
    const value = document.getElementById('searchInput').value.trim();
    
    if (type !== 'accountName' || !value) {
        hideAutocompleteDropdown();
        return;
    }
    
    try {
        const results = await getGASClient().autocompleteNames(value);
        AppState.autocompleteResults = results || [];
        
        if (AppState.autocompleteResults.length === 0) {
            hideAutocompleteDropdown();
            return;
        }
        
        showAutocompleteResults();
        
    } catch (error) {
        console.error('Autocomplete failed:', error);
        hideAutocompleteDropdown();
    }
}

// Show autocomplete results
function showAutocompleteResults() {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    
    AppState.autocompleteResults.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = item.accountName || item.accountNumber || 'Unknown';
        div.onclick = () => selectAutocomplete(index);
        dropdown.appendChild(div);
    });
    
    dropdown.classList.remove('autocomplete-hidden');
}

// Hide autocomplete dropdown
function hideAutocompleteDropdown() {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (dropdown) {
        dropdown.classList.add('autocomplete-hidden');
    }
}

// Select autocomplete item
function selectAutocomplete(index) {
    const selected = AppState.autocompleteResults[index];
    if (!selected) return;
    
    document.getElementById('searchInput').value = selected.accountName || selected.accountNumber || '';
    hideAutocompleteDropdown();
    searchCustomerWithData(selected);
}

// Main search function
async function searchCustomer() {
    const type = getSelectedSearchType();
    const value = document.getElementById('searchInput').value.trim();
    
    if (!value) {
        UIUtils.showToast('Please enter a search value', 'warning');
        return;
    }
    
    UIUtils.showLoading('Searching...');
    hideAutocompleteDropdown();
    
    try {
        const customer = await getGASClient().searchCustomer(type, value);
        
        if (customer) {
            displayCustomer(customer);
            AppState.currentCustomer = customer;
            UIUtils.showToast('Customer found successfully', 'success');
        } else {
            clearCustomerDetails();
            UIUtils.showToast('No matching record found', 'warning');
        }
        
    } catch (error) {
        console.error('Search error:', error);
        UIUtils.showToast(`Search failed: ${error.message}`, 'error');
    } finally {
        UIUtils.hideLoading();
    }
}

// Search with existing data
function searchCustomerWithData(customer) {
    displayCustomer(customer);
    AppState.currentCustomer = customer;
    UIUtils.showToast('Customer selected', 'success');
}

// Display customer details
function displayCustomer(customer) {
    document.getElementById('accountName').value = customer.accountName || '';
    document.getElementById('accountNumber').value = customer.accountNumber || '';
    document.getElementById('customerNumber').value = customer.customerId || '';
    document.getElementById('clearBalance').value = customer.clearBalance || '';
}

// Clear customer details
function clearCustomerDetails() {
    document.getElementById('accountName').value = '';
    document.getElementById('accountNumber').value = '';
    document.getElementById('customerNumber').value = '';
    document.getElementById('clearBalance').value = '';
    AppState.currentCustomer = null;
}

// Clear all
function clearAll() {
    document.getElementById('searchInput').value = '';
    clearCustomerDetails();
    hideAutocompleteDropdown();
    UIUtils.showToast('Cleared all fields', 'info');
}

// Open statement modal
function openCustomerStatementModal(data) {
    if (data) {
        fillAndShowCustomerStatementModal(data);
        return;
    }
    
    // If modal doesn't exist, load it
    if (!document.getElementById('customerStatementModal')) {
        loadCustomerStatementModal();
    } else {
        fillAndShowCustomerStatementModal();
    }
}

// Load customer statement modal
async function loadCustomerStatementModal() {
    try {
        // If using GAS to serve HTML
        const html = await getGASClient().request('getModalHtml', 'GET');
        document.getElementById('modalContainer').innerHTML = html;
        fillAndShowCustomerStatementModal();
    } catch (error) {
        // Fallback to inline modal if GAS fails
        console.log('Using inline modal');
        fillAndShowCustomerStatementModal();
    }
}

// Fill and show modal
function fillAndShowCustomerStatementModal() {
    const name = document.getElementById('accountName').value || '';
    const number = document.getElementById('accountNumber').value || '';
    
    const modalName = document.getElementById('modalCustomerName');
    const modalNumber = document.getElementById('modalAccountNumber');
    
    if (modalName) modalName.textContent = name;
    if (modalNumber) modalNumber.value = number;
    
    // Reset dates
    const dateFrom = document.getElementById('modalPeriodFromInput');
    const dateTo = document.getElementById('modalPeriodToInput');
    
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    
    // Clear table
    const tbody = document.getElementById('statementTableBody');
    if (tbody) tbody.innerHTML = '';
    
    // Show modal
    const modal = document.getElementById('customerStatementModal');
    if (modal) modal.style.display = 'flex';
}

// Close modal
function closeCustomerStatementModal() {
    const modal = document.getElementById('customerStatementModal');
    if (modal) modal.style.display = 'none';
}

// Validate dates
function validateDates() {
    const dateFrom = document.getElementById('modalPeriodFromInput');
    const dateTo = document.getElementById('modalPeriodToInput');
    
    if (dateFrom && dateTo && dateFrom.value && dateTo.value) {
        if (dateFrom.value > dateTo.value) {
            UIUtils.showToast('From date cannot be after To date', 'warning');
            return false;
        }
    }
    
    return true;
}

// Generate statement
async function generateStatement() {
    const accountNumberInput = document.getElementById('modalAccountNumber');
    const accountNumber = accountNumberInput ? accountNumberInput.value.trim() : '';
    
    if (!accountNumber) {
        UIUtils.showToast('Account number is required', 'warning');
        if (accountNumberInput) accountNumberInput.focus();
        return;
    }
    
    const dateFrom = document.getElementById('modalPeriodFromInput');
    const dateTo = document.getElementById('modalPeriodToInput');
    
    const fromDate = dateFrom ? dateFrom.value : '';
    const toDate = dateTo ? dateTo.value : '';
    
    if (!validateDates()) {
        return;
    }
    
    UIUtils.showLoading('Generating statement...');
    
    try {
        const statement = await getGASClient().generateStatement(
            accountNumber,
            fromDate,
            toDate
        );
        
        displayStatementResults(statement);
        UIUtils.showToast('Statement generated successfully', 'success');
        
    } catch (error) {
        console.error('Statement generation error:', error);
        handleStatementError(error);
    } finally {
        UIUtils.hideLoading();
    }
}

// Display statement results
function displayStatementResults(transactions) {
    const tbody = document.getElementById('statementTableBody');
    if (!tbody) return;
    
    try {
        tbody.innerHTML = '';
        
        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-transactions">
                        No transactions found for the selected period
                    </td>
                </tr>
            `;
            return;
        }
        
        let totalDebits = 0;
        let totalCredits = 0;
        let closingBalance = 0;
        let openingBalance = 0;
        
        // Check for opening balance
        const hasOpeningBalance = transactions[0] && transactions[0].desc === 'OPENING BALANCE';
        
        if (hasOpeningBalance) {
            openingBalance = parseFloat(transactions[0].balance) || 0;
            closingBalance = openingBalance;
            
            const openingRow = document.createElement('tr');
            openingRow.className = 'opening-balance-row';
            openingRow.innerHTML = `
                <td>${transactions[0].date || 'Prior'}</td>
                <td>OPENING BALANCE</td>
                <td class="debit"></td>
                <td class="credit"></td>
                <td class="balance">${formatCurrency(openingBalance)}</td>
            `;
            tbody.appendChild(openingRow);
            
            transactions = transactions.slice(1);
        }
        
        // Add transaction rows
        transactions.forEach(txn => {
            const amount = parseFloat(txn.amount) || 0;
            
            if (txn.type === 'DEBIT') {
                totalDebits += amount;
                closingBalance -= amount;
            } else if (txn.type === 'CREDIT') {
                totalCredits += amount;
                closingBalance += amount;
            }
            
            const row = document.createElement('tr');
            row.className = 'transaction-row';
            
            row.innerHTML = `
                <td class="date">${txn.date}</td>
                <td class="description">${txn.desc || ''}</td>
                <td class="debit">${txn.type === 'DEBIT' ? formatCurrency(amount) : ''}</td>
                <td class="credit">${txn.type === 'CREDIT' ? formatCurrency(amount) : ''}</td>
                <td class="balance">${formatCurrency(txn.balance)}</td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Add TOTAL row
        if (transactions.length > 0) {
            const totalRow = document.createElement('tr');
            totalRow.className = 'total-row';
            totalRow.innerHTML = `
                <td></td>
                <td>TOTAL</td>
                <td class="debit">${formatCurrency(totalDebits)}</td>
                <td class="credit">${formatCurrency(totalCredits)}</td>
                <td class="balance">${formatCurrency(closingBalance)}</td>
            `;
            tbody.appendChild(totalRow);
        }
        
    } catch (error) {
        console.error('Error displaying results:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="error-message">
                    Error displaying transactions. Please try again.
                </td>
            </tr>
        `;
    }
}

// Handle statement error
function handleStatementError(error) {
    const tbody = document.getElementById('statementTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="error-message">
                Error: ${error.message || 'Failed to fetch statement'}
            </td>
        </tr>
    `;
}

// Format currency
function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '0.00';
    
    const num = typeof amount === 'string' 
        ? parseFloat(amount.replace(/[^\d.-]/g, '')) 
        : Number(amount);
        
    return isNaN(num) ? '0.00' : num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Test connection
async function testConnection() {
    UIUtils.showLoading('Testing connection...');
    
    try {
        const result = await getGASClient().testConnection();
        
        if (result.success) {
            UIUtils.showToast('Connection test successful!', 'success');
        } else {
            UIUtils.showToast(`Connection test failed: ${result.message}`, 'error');
        }
        
    } catch (error) {
        UIUtils.showToast(`Connection error: ${error.message}`, 'error');
    } finally {
        UIUtils.hideLoading();
    }
}

// Setup default dates
function setupDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const dateFrom = document.getElementById('modalPeriodFromInput');
    const dateTo = document.getElementById('modalPeriodToInput');
    
    if (dateFrom) {
        dateFrom.valueAsDate = firstDay;
        dateFrom.max = today.toISOString().split('T')[0];
    }
    
    if (dateTo) {
        dateTo.valueAsDate = today;
        dateTo.max = today.toISOString().split('T')[0];
    }
}

// Check stored data
function checkStoredData() {
    try {
        const lastSearch = localStorage.getItem('lastSearch');
        if (lastSearch) {
            const data = JSON.parse(lastSearch);
            if (data.customer) {
                displayCustomer(data.customer);
                AppState.currentCustomer = data.customer;
            }
        }
    } catch (error) {
        console.warn('Failed to load stored data:', error);
    }
}

// Store current search
function storeCurrentSearch() {
    if (AppState.currentCustomer) {
        localStorage.setItem('lastSearch', JSON.stringify({
            customer: AppState.currentCustomer,
            timestamp: new Date().toISOString()
        }));
    }
}

// Debounce function
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

// Make functions globally available
window.getSelectedSearchType = getSelectedSearchType;
window.search = searchCustomer;
window.clearAll = clearAll;
window.openCustomerStatementModal = openCustomerStatementModal;
window.closeCustomerStatementModal = closeCustomerStatementModal;
window.generateStatement = generateStatement;
window.testConnection = testConnection;
