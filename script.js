/**
 * Main Application Script
 */

// Application State
let currentCustomer = null;
let autocompleteResults = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initApp();
});

function initApp() {
    console.log('App initialized');
    
    // Initialize GAS client
    const gasClient = initGASClient();
    if (!gasClient) {
        UIUtils.showToast('Please configure GAS URL in config.js', 'error');
        return;
    }
    
    setupEventListeners();
    
    // Test connection on startup
    testConnectionOnStartup();
}

async function testConnectionOnStartup() {
    const gas = getGASClient();
    if (!gas) return;
    
    try {
        const result = await gas.testConnection();
        if (result.success) {
            console.log('GAS connection test successful');
        } else {
            console.warn('GAS connection test failed:', result.message);
        }
    } catch (error) {
        console.error('Connection test error:', error);
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearchInput, 300));
        
        searchInput.addEventListener('blur', function() {
            setTimeout(() => {
                const dd = document.getElementById('autocompleteDropdown');
                if (dd) dd.classList.add('autocomplete-hidden');
            }, 200);
        });
        
        // Enter key support
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                search();
            }
        });
    }

    const radios = document.getElementsByName('searchType');
    for (let radio of radios) {
        radio.addEventListener('change', function() {
            const dd = document.getElementById('autocompleteDropdown');
            if (dd) dd.classList.add('autocomplete-hidden');
        });
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

// Search function
async function search() {
    const type = getSelectedSearchType();
    const value = document.getElementById('searchInput').value.trim();
    
    if (!value) {
        UIUtils.showToast('Please enter a value to search.', 'warning');
        return;
    }
    
    const dd = document.getElementById('autocompleteDropdown');
    if (dd) dd.classList.add('autocomplete-hidden');
    
    UIUtils.showLoading('Searching customer...');
    
    try {
        const gas = getGASClient();
        if (!gas) {
            UIUtils.showToast('GAS client not configured. Check config.js', 'error');
            return;
        }
        
        const result = await gas.searchCustomer(type, value);
        
        if (result) {
            displayCustomer(result);
            currentCustomer = result;
            UIUtils.showToast('Customer found successfully!', 'success');
        } else {
            clearInputs();
            UIUtils.showToast('No matching record found.', 'warning');
        }
    } catch (error) {
        console.error('Search error:', error);
        UIUtils.showToast(`Search failed: ${error.message}`, 'error');
        
        // More specific error handling
        if (error.message.includes('Access denied') || error.message.includes('Unauthorized')) {
            UIUtils.showToast('Please redeploy GAS with "Anyone" access permission', 'error');
        }
    } finally {
        UIUtils.hideLoading();
    }
}

// Display customer
function displayCustomer(customer) {
    document.getElementById('accountName').value = customer.accountName || '';
    document.getElementById('accountNumber').value = customer.accountNumber || '';
    document.getElementById('customerNumber').value = customer.customerId || '';
    document.getElementById('clearBalance').value = customer.clearBalance || '';
}

// Clear inputs
function clearInputs() {
    document.getElementById('accountName').value = '';
    document.getElementById('accountNumber').value = '';
    document.getElementById('customerNumber').value = '';
    document.getElementById('clearBalance').value = '';
}

// Clear all
function clearAll() {
    document.getElementById('searchInput').value = '';
    clearInputs();
    const dd = document.getElementById('autocompleteDropdown');
    if (dd) dd.classList.add('autocomplete-hidden');
    currentCustomer = null;
    UIUtils.showToast('All fields cleared', 'info');
}

// Handle search input for autocomplete
async function handleSearchInput() {
    const type = getSelectedSearchType();
    const value = document.getElementById('searchInput').value.trim();
    const dropdown = document.getElementById('autocompleteDropdown');
    
    if (type !== 'accountName' || !value) {
        if (dropdown) dropdown.classList.add('autocomplete-hidden');
        return;
    }
    
    try {
        const gas = getGASClient();
        if (!gas) return;
        
        const results = await gas.autocompleteNames(value);
        autocompleteResults = results || [];
        
        if (dropdown) {
            dropdown.innerHTML = '';
            
            if (autocompleteResults.length === 0) {
                dropdown.classList.add('autocomplete-hidden');
                return;
            }
            
            autocompleteResults.forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = item.accountName || '(no name)';
                div.addEventListener('click', function() { 
                    selectAutocomplete(idx); 
                });
                dropdown.appendChild(div);
            });
            
            dropdown.classList.remove('autocomplete-hidden');
        }
    } catch (error) {
        console.error('Autocomplete error:', error);
        if (dropdown) dropdown.classList.add('autocomplete-hidden');
    }
}

// Select autocomplete item
function selectAutocomplete(idx) {
    const selected = autocompleteResults[idx];
    if (!selected) return;
    
    document.getElementById('searchInput').value = selected.accountName || '';
    const dd = document.getElementById('autocompleteDropdown');
    if (dd) dd.classList.add('autocomplete-hidden');
    displayCustomer(selected);
    currentCustomer = selected;
    UIUtils.showToast('Customer selected from suggestions', 'success');
}

// Open statement modal
function openCustomerStatementModal(data) {
    if (!currentCustomer && !data) {
        UIUtils.showToast('Please select a customer first', 'warning');
        return;
    }

    if (data) {
        if (!document.getElementById('customerStatementModal')) {
            loadCustomerStatementModal(data);
        } else {
            fillAndShowCustomerStatementModal(data);
        }
        return;
    }

    if (!document.getElementById('customerStatementModal')) {
        loadCustomerStatementModal();
    } else {
        fillAndShowCustomerStatementModal();
    }
}

// Load modal HTML
async function loadCustomerStatementModal(data) {
    try {
        const gas = getGASClient();
        if (gas) {
            // Try to get modal HTML from GAS
            const html = await gas.request('getModalHtml');
            if (html && typeof html === 'string') {
                document.getElementById('modalContainer').innerHTML = html;
            }
        }
    } catch (error) {
        console.log('Could not load modal from GAS:', error);
        // Use default modal
        document.getElementById('modalContainer').innerHTML = getDefaultModalHTML();
    }
    
    if (data) {
        fillAndShowCustomerStatementModal(data);
    } else {
        fillAndShowCustomerStatementModal();
    }
}

// Default modal HTML (fallback)
function getDefaultModalHTML() {
    return `
    <div id="customerStatementModal" class="modal-overlay" style="display:none;">
      <div class="modal-content">
        <button class="close-btn" onclick="closeCustomerStatementModal()" aria-label="Close">&times;</button>
        <div class="statement-container">
          <div class="statement-header">
            <h2>CUSTOMER STATEMENT</h2>
            <div class="statement-info">
              <div>
                <span class="label">ACCOUNT NAME</span>:
                <span id="modalCustomerName"></span>
              </div>
              <div>
                <span class="label">ACCOUNT NUMBER</span>:
                <input id="modalAccountNumber" type="text" readonly class="modal-account-input">
              </div>
              <div class="period-row-box">
                <div class="period-row-inner">
                  <span class="label">PERIOD:</span>
                  <span class="label">FROM</span>
                  <input type="date" id="modalPeriodFromInput" value="" class="date-input">
                  <span class="label">TO</span>
                  <input type="date" id="modalPeriodToInput" value="" class="date-input">
                  <button class="generate-btn" onclick="generateStatement();return false;">GENERATE</button>
                </div>
              </div>
            </div>
          </div>
          <table class="statement-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>DESCRIPTION</th>
                <th>DEBIT</th>
                <th>CREDIT</th>
                <th>BALANCE</th>
              </tr>
            </thead>
            <tbody id="statementTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
    `;
}

// Fill and show modal
function fillAndShowCustomerStatementModal(data) {
    let name, number;
    
    if (data) {
        name = data.accountName || '';
        number = data.accountNumber || '';
    } else {
        name = document.getElementById('accountName').value || '';
        number = document.getElementById('accountNumber').value || '';
    }

    const modalName = document.getElementById('modalCustomerName');
    const modalNumber = document.getElementById('modalAccountNumber');
    
    if (modalName) modalName.innerText = name;
    if (modalNumber) modalNumber.value = number;

    // Reset period/date and table
    const fromInput = document.getElementById('modalPeriodFromInput');
    const toInput = document.getElementById('modalPeriodToInput');
    const tbody = document.getElementById('statementTableBody');
    
    if (fromInput) {
        fromInput.value = '';
        fromInput.max = new Date().toISOString().split('T')[0];
    }
    if (toInput) {
        toInput.value = '';
        toInput.max = new Date().toISOString().split('T')[0];
    }
    if (tbody) tbody.innerHTML = '';
    
    const modal = document.getElementById('customerStatementModal');
    if (modal) modal.style.display = 'flex';
}

// Close modal
function closeCustomerStatementModal() {
    const modal = document.getElementById('customerStatementModal');
    if (modal) modal.style.display = 'none';
}

// Generate statement
async function generateStatement() {
    const accountNumberInput = document.getElementById('modalAccountNumber');
    const accountNumber = accountNumberInput ? accountNumberInput.value.trim() : '';
    
    if (!accountNumber) {
        UIUtils.showToast('Account number is required!', 'warning');
        if (accountNumberInput) accountNumberInput.focus();
        return;
    }

    const accountNumberRegex = /^\d{6,13}$/;
    if (!accountNumberRegex.test(accountNumber)) {
        UIUtils.showToast('Please enter a valid account number (6-13 digits)', 'warning');
        if (accountNumberInput) accountNumberInput.focus();
        return;
    }

    const dateFrom = document.getElementById('modalPeriodFromInput')?.value;
    const dateTo = document.getElementById('modalPeriodToInput')?.value;
    
    if (dateFrom && dateTo && dateFrom > dateTo) {
        UIUtils.showToast('From date cannot be after To date.', 'warning');
        return;
    }

    const tbody = document.getElementById('statementTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading transactions...</td></tr>';
    }

    UIUtils.showLoading('Generating statement...');
    
    try {
        const gas = getGASClient();
        if (!gas) {
            throw new Error('GAS client not configured');
        }
        
        const results = await gas.generateStatement(accountNumber, dateFrom, dateTo);
        displayStatementResults(results);
        UIUtils.showToast('Statement generated successfully!', 'success');
    } catch (error) {
        console.error('Statement Error:', error);
        handleStatementError(error);
        UIUtils.showToast(`Statement generation failed: ${error.message}`, 'error');
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

        // Check for opening balance
        const hasOpeningBalance = transactions[0] && transactions[0].desc === 'OPENING BALANCE';
        let openingBalance = 0;

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
                <td class="balance">${UIUtils.formatCurrency(openingBalance)}</td>
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
                <td class="debit">${txn.type === 'DEBIT' ? UIUtils.formatCurrency(amount) : ''}</td>
                <td class="credit">${txn.type === 'CREDIT' ? UIUtils.formatCurrency(amount) : ''}</td>
                <td class="balance">${UIUtils.formatCurrency(txn.balance)}</td>
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
                <td class="debit">${UIUtils.formatCurrency(totalDebits)}</td>
                <td class="credit">${UIUtils.formatCurrency(totalCredits)}</td>
                <td class="balance">${UIUtils.formatCurrency(closingBalance)}</td>
            `;
            tbody.appendChild(totalRow);
        }

    } catch (error) {
        console.error('Error displaying statement results:', error);
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

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions globally available
window.getSelectedSearchType = getSelectedSearchType;
window.search = search;
window.clearAll = clearAll;
window.openCustomerStatementModal = openCustomerStatementModal;
window.closeCustomerStatementModal = closeCustomerStatementModal;
window.generateStatement = generateStatement;
