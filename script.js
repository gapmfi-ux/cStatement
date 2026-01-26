/**
 * Main Application Script
 */

// Application State
let currentCustomer = null;
let autocompleteResults = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    console.log('App initialized');
    setupEventListeners();
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
        alert('Please enter a value to search.');
        return;
    }
    
    const dd = document.getElementById('autocompleteDropdown');
    if (dd) dd.classList.add('autocomplete-hidden');
    
    UIUtils.showLoading();
    
    try {
        const gas = getGASClient();
        if (!gas) {
            UIUtils.showToast('GAS client not configured', 'error');
            return;
        }
        
        const result = await gas.searchCustomer(type, value);
        
        if (result) {
            displayCustomer(result);
            currentCustomer = result;
        } else {
            clearInputs();
            alert('No matching record found.');
        }
    } catch (error) {
        console.error('Search error:', error);
        alert('Error searching: ' + (error.message || error));
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
}

// Open statement modal
function openCustomerStatementModal(data) {
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
            const html = await gas.request('getModalHtml', 'GET');
            document.getElementById('modalContainer').innerHTML = html;
        }
    } catch (error) {
        console.log('Could not load modal from GAS:', error);
    }
    
    if (data) {
        fillAndShowCustomerStatementModal(data);
    } else {
        fillAndShowCustomerStatementModal();
    }
}

// Fill and show modal
function fillAndShowCustomerStatementModal(data) {
    if (data) {
        const modalName = document.getElementById('modalCustomerName');
        const modalNumber = document.getElementById('modalAccountNumber');
        
        if (modalName) modalName.innerText = data.accountName || '';
        if (modalNumber) modalNumber.value = data.accountNumber || '';
    } else {
        var name = document.getElementById('accountName').value || '';
        var number = document.getElementById('accountNumber').value || '';

        const modalName = document.getElementById('modalCustomerName');
        const modalNumber = document.getElementById('modalAccountNumber');
        
        if (modalName) modalName.innerText = name;
        if (modalNumber) modalNumber.value = number;
    }

    // Reset period/date and table
    const fromInput = document.getElementById('modalPeriodFromInput');
    const toInput = document.getElementById('modalPeriodToInput');
    const tbody = document.getElementById('statementTableBody');
    
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
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
        alert('Account number is required!');
        if (accountNumberInput) accountNumberInput.focus();
        return;
    }

    const accountNumberRegex = /^\d{6,13}$/;
    if (!accountNumberRegex.test(accountNumber)) {
        alert('Please enter a valid account number (6-13 digits)');
        if (accountNumberInput) accountNumberInput.focus();
        return;
    }

    const dateFrom = document.getElementById('modalPeriodFromInput')?.value;
    const dateTo = document.getElementById('modalPeriodToInput')?.value;
    
    if (dateFrom && dateTo && dateFrom > dateTo) {
        alert('From date cannot be after To date.');
        return;
    }

    const tbody = document.getElementById('statementTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-message">Loading transactions...</td></tr>';
    }

    UIUtils.showLoading();
    
    try {
        const gas = getGASClient();
        if (!gas) {
            throw new Error('GAS client not configured');
        }
        
        const results = await gas.generateStatement(accountNumber, dateFrom, dateTo);
        displayStatementResults(results);
    } catch (error) {
        console.error('Statement Error:', error);
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
