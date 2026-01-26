/**
 * Main Application Script for Google Apps Script Backend
 */
 
// Application State
let appState = {
    currentCustomer: null,
    currentStatement: null,
    connectionStatus: 'disconnected',
    isLoading: false,
    autocompleteResults: [],
    lastUpdated: null
};

// Initialize application
async function initApp() {
    try {
        UIUtils.showLoading('Initializing Google Apps Script connection...');
        updateConnectionStatus('connecting');
        
        // Initialize GAS client
        await initGASClient();
        
        // Test connection
        const connection = await getGASClient().testConnection();
        
        if (connection.success) {
            updateConnectionStatus('connected');
            UIUtils.showToast('Connected to Google Apps Script successfully!', 'success');
            setupEventListeners();
            setupDefaultDates();
            
            // Load initial data if needed
            setTimeout(() => {
                checkForStoredData();
            }, 500);
        } else {
            updateConnectionStatus('error');
            UIUtils.showToast(`Connection failed: ${connection.message}`, 'error');
        }
        
    } catch (error) {
        console.error('App initialization failed:', error);
        updateConnectionStatus('error');
        UIUtils.showToast(`Initialization failed: ${error.message}`, 'error');
    } finally {
        UIUtils.hideLoading();
    }
}

// Update connection status UI
function updateConnectionStatus(status) {
    appState.connectionStatus = status;
    const statusElement = document.getElementById('connectionStatus');
    
    if (statusElement) {
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        switch(status) {
            case 'connected':
                icon.className = 'fas fa-circle';
                icon.style.color = '#4CAF50';
                text.textContent = 'Connected to GAS';
                break;
            case 'connecting':
                icon.className = 'fas fa-circle-notch fa-spin';
                icon.style.color = '#FFC107';
                text.textContent = 'Connecting...';
                break;
            case 'error':
                icon.className = 'fas fa-circle';
                icon.style.color = '#F44336';
                text.textContent = 'Connection Error';
                break;
            default:
                icon.className = 'fas fa-circle';
                icon.style.color = '#9E9E9E';
                text.textContent = 'Disconnected';
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search input events
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearchInput, 300));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchCustomer();
        });
        
        searchInput.addEventListener('focus', () => {
            if (getSelectedSearchType() === 'accountName' && searchInput.value.trim()) {
                handleSearchInput();
            }
        });
    }
    
    // Date input events
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate && endDate) {
        startDate.addEventListener('change', validateDateRange);
        endDate.addEventListener('change', validateDateRange);
    }
    
    // Search type change
    const searchTypeRadios = document.querySelectorAll('input[name="searchType"]');
    searchTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            hideAutocompleteDropdown();
            const searchInput = document.getElementById('searchInput');
            searchInput.placeholder = getSearchPlaceholder();
            searchInput.focus();
        });
    });
    
    // Click outside autocomplete
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('autocompleteDropdown');
        const searchInput = document.getElementById('searchInput');
        
        if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
            hideAutocompleteDropdown();
        }
    });
    
    // Window resize
    window.addEventListener('resize', debounce(handleResize, 250));
}

// Get search placeholder based on selected type
function getSearchPlaceholder() {
    const type = getSelectedSearchType();
    switch(type) {
        case 'accountName': return 'Enter account name (e.g., John Doe)...';
        case 'accountNumber': return 'Enter account number (e.g., 801310452158)...';
        case 'customerId': return 'Enter customer ID (e.g., CUST001)...';
        default: return 'Enter search value...';
    }
}

// Handle search input with autocomplete
async function handleSearchInput() {
    const type = getSelectedSearchType();
    const value = document.getElementById('searchInput').value.trim();
    const dropdown = document.getElementById('autocompleteDropdown');
    
    if (type !== 'accountName' || !value) {
        hideAutocompleteDropdown();
        return;
    }
    
    try {
        const results = await getGASClient().autocompleteNames(value);
        appState.autocompleteResults = results || [];
        
        if (appState.autocompleteResults.length === 0) {
            hideAutocompleteDropdown();
            return;
        }
        
        renderAutocompleteResults();
        
    } catch (error) {
        console.error('Autocomplete failed:', error);
        hideAutocompleteDropdown();
    }
}

// Render autocomplete results
function renderAutocompleteResults() {
    const dropdown = document.getElementById('autocompleteDropdown');
    dropdown.innerHTML = '';
    
    appState.autocompleteResults.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = `
            <i class="fas fa-user-circle"></i>
            <div class="autocomplete-content">
                <div class="autocomplete-name">${escapeHtml(item.accountName || 'Unknown')}</div>
                <div class="autocomplete-details">
                    <span class="account-number">${item.accountNumber || ''}</span>
                    <span class="customer-id">${item.customerId || ''}</span>
                </div>
            </div>
        `;
        div.onclick = () => selectAutocompleteResult(index);
        dropdown.appendChild(div);
    });
    
    dropdown.classList.remove('autocomplete-hidden');
}

// Select autocomplete result
function selectAutocompleteResult(index) {
    const selected = appState.autocompleteResults[index];
    if (!selected) return;
    
    document.getElementById('searchInput').value = selected.accountName || '';
    hideAutocompleteDropdown();
    loadCustomerDetails(selected);
}

// Hide autocomplete dropdown
function hideAutocompleteDropdown() {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (dropdown) {
        dropdown.classList.add('autocomplete-hidden');
    }
}

// Main search function
async function searchCustomer() {
    const type = getSelectedSearchType();
    const value = document.getElementById('searchInput').value.trim();
    
    if (!value) {
        UIUtils.showToast('Please enter a search value', 'warning');
        return;
    }
    
    UIUtils.showLoading('Searching customer...');
    
    try {
        const customer = await getGASClient().searchCustomer(type, value);
        
        if (customer) {
            loadCustomerDetails(customer);
            UIUtils.showToast('Customer found successfully!', 'success');
        } else {
            clearCustomerDetails();
            UIUtils.showToast('No customer found with the provided details', 'warning');
        }
        
    } catch (error) {
        console.error('Search failed:', error);
        UIUtils.showToast(`Search failed: ${error.message}`, 'error');
    } finally {
        UIUtils.hideLoading();
    }
}

// Load customer details
function loadCustomerDetails(customer) {
    appState.currentCustomer = customer;
    appState.lastUpdated = new Date();
    
    // Update UI
    document.getElementById('accountName').textContent = customer.accountName || '-';
    document.getElementById('accountNumber').textContent = customer.accountNumber || '-';
    document.getElementById('customerId').textContent = customer.customerId || '-';
    document.getElementById('clearBalance').textContent = 
        UIUtils.formatCurrency(customer.clearBalance);
    document.getElementById('lastUpdated').textContent = 
        UIUtils.formatDateTime(appState.lastUpdated);
    
    // Show sections
    UIUtils.showSection('detailsSection');
    UIUtils.showSection('statementSection');
    
    // Store in localStorage for persistence
    storeCustomerData(customer);
}

// Clear search and details
function clearSearch() {
    document.getElementById('searchInput').value = '';
    clearCustomerDetails();
    hideAutocompleteDropdown();
    clearStatement();
    UIUtils.showToast('Search cleared', 'info');
}

// Clear customer details
function clearCustomerDetails() {
    appState.currentCustomer = null;
    appState.currentStatement = null;
    
    document.getElementById('accountName').textContent = '-';
    document.getElementById('accountNumber').textContent = '-';
    document.getElementById('customerId').textContent = '-';
    document.getElementById('clearBalance').textContent = '-';
    document.getElementById('lastUpdated').textContent = '-';
    
    UIUtils.hideSection('detailsSection');
    UIUtils.hideSection('statementSection');
    
    // Clear localStorage
    localStorage.removeItem('lastCustomer');
}

// Setup default dates
function setupDefaultDates() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate && endDate) {
        startDate.valueAsDate = firstDayOfMonth;
        endDate.valueAsDate = today;
        startDate.max = today.toISOString().split('T')[0];
        endDate.max = today.toISOString().split('T')[0];
    }
}

// Set date range quick buttons
function setDateRange(range) {
    const today = new Date();
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (!startDate || !endDate) return;
    
    let start = new Date();
    
    switch(range) {
        case 'week':
            start.setDate(today.getDate() - 7);
            break;
        case 'month':
            start.setMonth(today.getMonth() - 1);
            break;
        case 'quarter':
            start.setMonth(today.getMonth() - 3);
            break;
        case 'year':
            start.setFullYear(today.getFullYear() - 1);
            break;
        default:
            start.setMonth(today.getMonth() - 1);
    }
    
    startDate.valueAsDate = start;
    endDate.valueAsDate = today;
}

// Validate date range
function validateDateRange() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate.value && endDate.value && startDate.value > endDate.value) {
        UIUtils.showToast('Start date cannot be after end date', 'warning');
        endDate.value = startDate.value;
    }
}

// Update date range
function updateDateRange() {
    validateDateRange();
}

// Generate statement
async function generateStatement() {
    if (!appState.currentCustomer || !appState.currentCustomer.accountNumber) {
        UIUtils.showToast('Please select a customer first', 'warning');
        return;
    }
    
    const accountNumber = appState.currentCustomer.accountNumber;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Validate dates
    if (startDate && endDate && startDate > endDate) {
        UIUtils.showToast('Start date cannot be after end date', 'warning');
        return;
    }
    
    UIUtils.showLoading('Generating statement from Google Sheets...');
    
    try {
        const statement = await getGASClient().generateStatement(
            accountNumber, 
            startDate, 
            endDate
        );
        
        appState.currentStatement = statement;
        displayStatement(statement);
        UIUtils.showToast('Statement generated successfully!', 'success');
        
        // Store in localStorage
        localStorage.setItem('lastStatement', JSON.stringify({
            timestamp: new Date().toISOString(),
            accountNumber,
            startDate,
            endDate,
            data: statement
        }));
        
    } catch (error) {
        console.error('Statement generation failed:', error);
        UIUtils.showToast(`Failed to generate statement: ${error.message}`, 'error');
        clearStatement();
    } finally {
        UIUtils.hideLoading();
    }
}

// Display statement
function displayStatement(statementData) {
    const container = document.getElementById('statementResults');
    const summaryContainer = document.getElementById('statementSummary');
    
    if (!statementData || !Array.isArray(statementData)) {
        container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>No Statement Data</h3>
                <p>No transactions found for the selected period</p>
            </div>
        `;
        summaryContainer.style.display = 'none';
        return;
    }
    
    // Calculate summary
    let totalDebits = 0;
    let totalCredits = 0;
    let openingBalance = 0;
    let closingBalance = 0;
    
    // Filter out opening balance row if present
    const transactions = statementData.filter(row => row.desc !== 'OPENING BALANCE');
    const openingRow = statementData.find(row => row.desc === 'OPENING BALANCE');
    
    if (openingRow) {
        openingBalance = parseFloat(openingRow.balance) || 0;
    }
    
    // Build table HTML
    let tableHTML = `
        <div class="statement-table-container">
            <table class="statement-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add opening balance row if exists
    if (openingRow) {
        tableHTML += `
            <tr class="opening-balance-row">
                <td>${UIUtils.formatDate(openingRow.date)}</td>
                <td colspan="2"><strong>OPENING BALANCE</strong></td>
                <td></td>
                <td></td>
                <td class="balance">${UIUtils.formatCurrency(openingBalance)}</td>
            </tr>
        `;
    }
    
    // Add transaction rows
    let runningBalance = openingBalance;
    
    transactions.forEach((transaction, index) => {
        const amount = parseFloat(transaction.amount) || 0;
        const isDebit = transaction.type === 'DEBIT';
        
        if (isDebit) {
            totalDebits += amount;
            runningBalance -= amount;
        } else {
            totalCredits += amount;
            runningBalance += amount;
        }
        
        tableHTML += `
            <tr class="transaction-row ${index % 2 === 0 ? 'even' : 'odd'}">
                <td class="date">${UIUtils.formatDate(transaction.date)}</td>
                <td class="description">${escapeHtml(transaction.desc || '')}</td>
                <td class="type ${isDebit ? 'debit' : 'credit'}">${transaction.type}</td>
                <td class="debit">${isDebit ? UIUtils.formatCurrency(amount) : ''}</td>
                <td class="credit">${!isDebit ? UIUtils.formatCurrency(amount) : ''}</td>
                <td class="balance">${UIUtils.formatCurrency(runningBalance)}</td>
            </tr>
        `;
    });
    
    closingBalance = runningBalance;
    
    // Add closing balance row
    tableHTML += `
            <tr class="closing-balance-row">
                <td colspan="3"><strong>CLOSING BALANCE</strong></td>
                <td class="debit-total">${UIUtils.formatCurrency(totalDebits)}</td>
                <td class="credit-total">${UIUtils.formatCurrency(totalCredits)}</td>
                <td class="balance total">${UIUtils.formatCurrency(closingBalance)}</td>
            </tr>
        </tbody>
    </table>
    </div>
    `;
    
    container.innerHTML = tableHTML;
    
    // Update summary
    summaryContainer.innerHTML = `
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-label">Period</div>
                <div class="summary-value">${getDateRangeText()}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Opening Balance</div>
                <div class="summary-value">${UIUtils.formatCurrency(openingBalance)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Total Debits</div>
                <div class="summary-value debit">${UIUtils.formatCurrency(totalDebits)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Total Credits</div>
                <div class="summary-value credit">${UIUtils.formatCurrency(totalCredits)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Closing Balance</div>
                <div class="summary-value">${UIUtils.formatCurrency(closingBalance)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Net Change</div>
                <div class="summary-value ${totalCredits - totalDebits >= 0 ? 'credit' : 'debit'}">
                    ${UIUtils.formatCurrency(totalCredits - totalDebits)}
                </div>
            </div>
        </div>
    `;
    
    summaryContainer.style.display = 'block';
    
    // Add print and export functionality
    addStatementActions();
}

// Get date range text
function getDateRangeText() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (startDate && endDate) {
        const start = UIUtils.formatDate(startDate);
        const end = UIUtils.formatDate(endDate);
        return `${start} to ${end}`;
    }
    
    return 'All dates';
}

// Clear statement
function clearStatement() {
    const container = document.getElementById('statementResults');
    const summaryContainer = document.getElementById('statementSummary');
    
    container.innerHTML = `
        <div class="placeholder-message">
            <i class="fas fa-file-alt"></i>
            <p>Generate a statement to view transaction history</p>
        </div>
    `;
    
    summaryContainer.style.display = 'none';
    appState.currentStatement = null;
    
    // Clear localStorage
    localStorage.removeItem('lastStatement');
}

// Add statement actions (print, export)
function addStatementActions() {
    const container = document.getElementById('statementResults');
    
    // Add print button if not exists
    if (!container.querySelector('.statement-actions')) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'statement-actions';
        actionsDiv.innerHTML = `
            <button class="btn btn-sm" onclick="printStatement()">
                <i class="fas fa-print"></i> Print Statement
            </button>
            <button class="btn btn-sm" onclick="exportToCSV()">
                <i class="fas fa-file-csv"></i> Export CSV
            </button>
            <button class="btn btn-sm" onclick="exportToPDF()">
                <i class="fas fa-file-pdf"></i> Export PDF
            </button>
        `;
        container.insertBefore(actionsDiv, container.firstChild);
    }
}

// Print statement
function printStatement() {
    window.print();
}

// Export to CSV
function exportToCSV() {
    if (!appState.currentStatement) {
        UIUtils.showToast('No statement data to export', 'warning');
        return;
    }
    
    const data = appState.currentStatement;
    let csv = 'Date,Description,Type,Amount,Balance\n';
    
    data.forEach(row => {
        const date = UIUtils.formatDate(row.date);
        const desc = `"${(row.desc || '').replace(/"/g, '""')}"`;
        const type = row.type;
        const amount = row.amount || '';
        const balance = row.balance || '';
        
        csv += `${date},${desc},${type},${amount},${balance}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement_${appState.currentCustomer?.accountNumber || 'unknown'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    UIUtils.showToast('CSV exported successfully!', 'success');
}

// Export to PDF (using browser print)
function exportToPDF() {
    UIUtils.showToast('Use Print function and select "Save as PDF"', 'info');
    setTimeout(() => {
        window.print();
    }, 1000);
}

// Test connection
async function testConnection() {
    UIUtils.showLoading('Testing connection to Google Apps Script...');
    
    try {
        const result = await getGASClient().testConnection();
        
        if (result.success) {
            UIUtils.showToast('Connection test successful!', 'success');
        } else {
            UIUtils.showToast(`Connection test failed: ${result.message}`, 'error');
        }
        
    } catch (error) {
        UIUtils.showToast(`Connection test error: ${error.message}`, 'error');
    } finally {
        UIUtils.hideLoading();
    }
}

// Refresh customer data
async function refreshCustomerData() {
    if (!appState.currentCustomer) {
        UIUtils.showToast('No customer selected', 'warning');
        return;
    }
    
    UIUtils.showLoading('Refreshing customer data...');
    
    try {
        const customer = await getGASClient().searchCustomer(
            'accountNumber', 
            appState.currentCustomer.accountNumber
        );
        
        if (customer) {
            loadCustomerDetails(customer);
            UIUtils.showToast('Customer data refreshed!', 'success');
        } else {
            UIUtils.showToast('Customer not found (may have been deleted)', 'warning');
            clearCustomerDetails();
        }
        
    } catch (error) {
        UIUtils.showToast(`Refresh failed: ${error.message}`, 'error');
    } finally {
        UIUtils.hideLoading();
    }
}

// Store customer data in localStorage
function storeCustomerData(customer) {
    localStorage.setItem('lastCustomer', JSON.stringify({
        customer,
        timestamp: new Date().toISOString()
    }));
}

// Check for stored data on load
function checkForStoredData() {
    try {
        const lastCustomer = localStorage.getItem('lastCustomer');
        const lastStatement = localStorage.getItem('lastStatement');
        
        if (lastCustomer) {
            const data = JSON.parse(lastCustomer);
            const customer = data.customer;
            
            // Check if data is not too old (1 hour)
            const timestamp = new Date(data.timestamp);
            const now = new Date();
            const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
            
            if (hoursDiff < 1) {
                // Load customer
                document.getElementById('searchInput').value = customer.accountName || customer.accountNumber || '';
                loadCustomerDetails(customer);
                
                // Load statement if exists
                if (lastStatement) {
                    const statementData = JSON.parse(lastStatement);
                    if (statementData.accountNumber === customer.accountNumber) {
                        const startDate = document.getElementById('startDate');
                        const endDate = document.getElementById('endDate');
                        
                        if (startDate && endDate) {
                            startDate.value = statementData.startDate || '';
                            endDate.value = statementData.endDate || '';
                        }
                        
                        appState.currentStatement = statementData.data;
                        displayStatement(statementData.data);
                    }
                }
                
                UIUtils.showToast('Loaded previous session data', 'info');
            }
        }
    } catch (error) {
        console.warn('Failed to load stored data:', error);
        // Clear corrupt data
        localStorage.removeItem('lastCustomer');
        localStorage.removeItem('lastStatement');
    }
}

// Handle window resize
function handleResize() {
    // Adjust UI elements for mobile
    if (window.innerWidth < 768) {
        document.body.classList.add('mobile-view');
    } else {
        document.body.classList.remove('mobile-view');
    }
}

// Utility functions
function getSelectedSearchType() {
    const radios = document.getElementsByName('searchType');
    for (let radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'accountName';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI utilities
    if (typeof UIUtils === 'undefined') {
        console.error('UIUtils not found. Make sure script.js loads after UI utils.');
        return;
    }
    
    // Start app initialization
    setTimeout(initApp, 100);
});

// Public API for buttons
window.searchCustomer = searchCustomer;
window.clearSearch = clearSearch;
window.generateStatement = generateStatement;
window.clearStatement = clearStatement;
window.printStatement = printStatement;
window.exportToCSV = exportToCSV;
window.exportToPDF = exportToPDF;
window.testConnection = testConnection;
window.refreshCustomerData = refreshCustomerData;
window.setDateRange = setDateRange;
