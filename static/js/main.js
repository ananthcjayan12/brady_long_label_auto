// Main JavaScript functionality

// CSRF token helper
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Setup CSRF token for AJAX requests
const csrftoken = getCookie('csrftoken') || window.csrfToken;

// Make csrftoken available globally
window.csrftoken = csrftoken;

// Default AJAX setup
if (typeof $ !== 'undefined') {
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!this.crossDomain && csrftoken) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
        }
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `message message-${type}`;
    notification.textContent = message;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(notification, container.firstChild);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

// Loading state management
function setLoading(element, isLoading) {
    if (isLoading) {
        element.disabled = true;
        element.classList.add('loading');
    } else {
        element.disabled = false;
        element.classList.remove('loading');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Auto-hide messages after 5 seconds
    const messages = document.querySelectorAll('.message');
    messages.forEach(message => {
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 5000);
    });
    
    // Help button functionality
    const helpBtn = document.querySelector('.help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', function() {
            alert('PDF Barcode Label Printing System\n\n1. Upload your PDF document\n2. Enter a barcode number to search\n3. Configure print settings and print the page');
        });
    }
});
