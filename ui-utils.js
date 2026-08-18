/**
 * UI Utility Functions
 */
class UIUtils {
    static showLoading(message = 'Loading...') {
        const spinner = document.getElementById('globalSpinner');
        if (spinner) {
            spinner.style.display = 'flex';
            // Add a message if needed
            const messageEl = spinner.querySelector('.spinner-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
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
        // Ensure toast element exists
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        
        // Clear any existing timeout
        if (toast._hideTimeout) {
            clearTimeout(toast._hideTimeout);
        }
        
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'flex';
        toast.style.opacity = '1';
        
        // Auto-hide after 3 seconds
        toast._hideTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
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
