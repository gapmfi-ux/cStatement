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
        if (!toast) return;
        
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
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('en-US');
        } catch {
            return dateString;
        }
    }
}

// Make it globally available
window.UIUtils = UIUtils;
