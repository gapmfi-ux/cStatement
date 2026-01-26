/**
 * UI Utility Functions
 */
class UIUtils {
    static showLoading(message = 'Loading...') {
        const spinner = document.getElementById('globalSpinner');
        if (spinner) {
            spinner.style.display = 'flex';
        }
        document.body.classList.add('loading');
    }

    static hideLoading() {
        const spinner = document.getElementById('globalSpinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
        document.body.classList.remove('loading');
    }

    static showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) {
            // Create toast if it doesn't exist
            const toastEl = document.createElement('div');
            toastEl.id = 'toast';
            toastEl.className = 'toast';
            document.body.appendChild(toastEl);
        }
        
        const toastElement = document.getElementById('toast');
        toastElement.textContent = message;
        toastElement.className = `toast ${type}`;
        toastElement.style.display = 'flex';
        
        setTimeout(() => {
            toastElement.style.display = 'none';
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

    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Make it globally available
window.UIUtils = UIUtils;
