// Search page functionality

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const barcodeInput = document.getElementById('barcodeInput');
    const printBtn = document.getElementById('printBtn');
    const searchResults = document.getElementById('searchResults');
    const resultInfo = document.getElementById('resultInfo');
    const pagePreview = document.getElementById('pagePreview');
    const loading = document.getElementById('loading');

    let currentMappingId = null;

    // Persistent keypress logger - stores to localStorage
    function logKeypress(event) {
        const timestamp = new Date().toISOString();
        const keyData = {
            timestamp: timestamp,
            key: event.key,
            keyCode: event.keyCode,
            code: event.code,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey
        };
        
        // Get existing log from localStorage
        let keyLog = JSON.parse(localStorage.getItem('barcodeKeyLog') || '[]');
        keyLog.push(keyData);
        
        // Keep only last 100 keypresses to avoid filling up storage
        if (keyLog.length > 100) {
            keyLog = keyLog.slice(-100);
        }
        
        // Save back to localStorage
        localStorage.setItem('barcodeKeyLog', JSON.stringify(keyLog));
        
        // Also log to console
        console.log('Key pressed:', keyData);
    }

    // Add button to view keypress history
    const debugBtn = document.createElement('button');
    debugBtn.textContent = '🔍 View Keypress Log';
    debugBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:8px 12px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;';
    debugBtn.onclick = function() {
        const keyLog = JSON.parse(localStorage.getItem('barcodeKeyLog') || '[]');
        console.clear();
        console.log('=== COMPLETE KEYPRESS HISTORY ===');
        console.log(`Total keypresses recorded: ${keyLog.length}`);
        console.table(keyLog);
        alert(`Check console for ${keyLog.length} recorded keypresses!\n\nLast 5 keys:\n` + 
              keyLog.slice(-5).map(k => `${k.key} (code: ${k.keyCode})`).join('\n'));
    };
    document.body.appendChild(debugBtn);

    // Add button to clear log
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑️ Clear Log';
    clearBtn.style.cssText = 'position:fixed;top:50px;right:10px;z-index:9999;padding:8px 12px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;';
    clearBtn.onclick = function() {
        localStorage.removeItem('barcodeKeyLog');
        console.log('Keypress log cleared!');
        alert('Keypress log cleared!');
    };
    document.body.appendChild(clearBtn);

    // Block developer tools shortcuts and navigation keys when barcode input is focused
    barcodeInput.addEventListener('keydown', function(event) {
        // Log all key presses with persistent storage
        logKeypress(event);

        // Block standalone Shift key (keyCode 16) - barcode scanners often send this
        if (event.keyCode === 16 || event.key === 'Shift') {
            console.log('Blocked Shift key');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block standalone Alt key (keyCode 18) - barcode scanners often send this
        if (event.keyCode === 18 || event.key === 'Alt') {
            console.log('Blocked Alt key');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block standalone Control key (keyCode 17) - might also be sent by scanners
        if (event.keyCode === 17 || event.key === 'Control') {
            console.log('Blocked Control key');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block Insert key (keyCode 45) - especially when combined with Alt
        if (event.keyCode === 45 || event.key === 'Insert') {
            console.log('Blocked Insert key');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block Alt+ArrowLeft (browser back navigation) - THIS IS THE MAIN CULPRIT
        if (event.altKey && (event.keyCode === 37 || event.key === 'ArrowLeft')) {
            console.log('Blocked Alt+ArrowLeft (browser back)');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block Alt+ArrowRight (browser forward navigation)
        if (event.altKey && (event.keyCode === 39 || event.key === 'ArrowRight')) {
            console.log('Blocked Alt+ArrowRight (browser forward)');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block Alt+ArrowDown
        if (event.altKey && (event.keyCode === 40 || event.key === 'ArrowDown')) {
            console.log('Blocked Alt+ArrowDown');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block Alt+ArrowUp
        if (event.altKey && (event.keyCode === 38 || event.key === 'ArrowUp')) {
            console.log('Blocked Alt+ArrowUp');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block PageDown key (keyCode 34) - especially with Alt
        if (event.keyCode === 34 || event.key === 'PageDown') {
            console.log('Blocked PageDown key');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block PageUp key (keyCode 33) - especially with Alt
        if (event.keyCode === 33 || event.key === 'PageUp') {
            console.log('Blocked PageUp key');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block Home key (often triggers browser home page navigation)
        if (event.keyCode === 36 || event.key === 'Home') {
            console.log('Blocked Home key');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block End key
        if (event.keyCode === 35 || event.key === 'End') {
            console.log('Blocked End key');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block Alt+Home (browser home page)
        if (event.altKey && (event.keyCode === 36 || event.key === 'Home')) {
            console.log('Blocked Alt+Home');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block Cmd+H (Mac hide window / browser home)
        if (event.metaKey && (event.keyCode === 72 || event.key === 'H' || event.key === 'h')) {
            console.log('Blocked Cmd+H');
            event.preventDefault();
            event.stopPropagation();
            return false;
        }

        // Block F12
        if (event.keyCode === 123 || event.key === 'F12') {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        // Block Ctrl+Shift+I (Inspect Element)
        if (event.ctrlKey && event.shiftKey && (event.keyCode === 73 || event.key === 'I')) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        // Block Ctrl+Shift+C (Inspect Element)
        if (event.ctrlKey && event.shiftKey && (event.keyCode === 67 || event.key === 'C')) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        // Block Ctrl+Shift+J (Console)
        if (event.ctrlKey && event.shiftKey && (event.keyCode === 74 || event.key === 'J')) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        // Block Cmd+Option+I (Mac Inspect Element)
        if (event.metaKey && event.altKey && (event.keyCode === 73 || event.key === 'I' || event.key === 'i')) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        // Block Cmd+Option+C (Mac Inspect Element)
        if (event.metaKey && event.altKey && (event.keyCode === 67 || event.key === 'C' || event.key === 'c')) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        // Block Cmd+Option+J (Mac Console)
        if (event.metaKey && event.altKey && (event.keyCode === 74 || event.key === 'J' || event.key === 'j')) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    });

    // Auto-focus on barcode input
    barcodeInput.focus();

    // Real-time search as user types (debounced)
    const debouncedSearch = debounce(function(barcode) {
        if (barcode.length >= 3) {
            searchBarcode(barcode);
        } else {
            hideResults();
        }
    }, 500);

    barcodeInput.addEventListener('input', function(e) {
        const barcode = e.target.value.trim();
        debouncedSearch(barcode);
    });

    // Form submission for printing
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (currentMappingId) {
            printPage();
        } else {
            const barcode = barcodeInput.value.trim();
            if (barcode) {
                searchBarcode(barcode, true);
            }
        }
    });

    function searchBarcode(barcode, shouldPrint = false) {
        showLoading();
        
        fetch('/api/search-barcode/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                barcode: barcode
            })
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.success) {
                showResults(data.mapping);
                currentMappingId = data.mapping.id;
                
                if (shouldPrint) {
                    printPage();
                }
            } else {
                showNoResults(data.error || 'Barcode not found');
                currentMappingId = null;
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Search error:', error);
            showNoResults('Search failed due to network error');
            currentMappingId = null;
        });
    }

    function printPage() {
        if (!currentMappingId) {
            showNotification('Please search for a barcode first', 'error');
            return;
        }

        setLoading(printBtn, true);

        const printData = {
            mapping_id: currentMappingId
        };

        fetch('/api/print-page/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(printData)
        })
        .then(response => response.json())
        .then(data => {
            setLoading(printBtn, false);
            
            if (data.success) {
                showNotification(`Page ready for printing!`, 'success');
                
                // Open the PDF in a new window/tab for printing
                window.open(data.pdf_url, '_blank');
                
                // Reset form after successful print
                setTimeout(() => {
                    barcodeInput.value = '';
                    hideResults();
                    currentMappingId = null;
                    barcodeInput.focus();
                }, 2000);
            } else {
                showNotification(data.error || 'Print preparation failed', 'error');
            }
        })
        .catch(error => {
            setLoading(printBtn, false);
            console.error('Print error:', error);
            showNotification('Print failed due to network error', 'error');
        });
    }

    function showResults(mapping) {
        resultInfo.innerHTML = `
            <h4>✅ Barcode Found!</h4>
            <p><strong>Barcode:</strong> ${mapping.barcode_text}</p>
            <p><strong>Document:</strong> ${mapping.document_name}</p>
            <p><strong>Page:</strong> ${mapping.page_number} of ${mapping.total_pages}</p>
            <p><strong>Type:</strong> ${mapping.barcode_type || 'Unknown'}</p>
        `;

        // Show page preview link
        pagePreview.innerHTML = `
            <p>Click to preview the page:</p>
            <a href="/pdf/page/${mapping.id}/" target="_blank" class="preview-link">
                📄 View Page ${mapping.page_number}
            </a>
        `;

        searchResults.style.display = 'block';
        printBtn.disabled = false;
    }

    function showNoResults(message) {
        hideResults();
        showNotification(message, 'warning');
        printBtn.disabled = true;
    }

    function hideResults() {
        searchResults.style.display = 'none';
        printBtn.disabled = true;
    }

    function showLoading() {
        loading.style.display = 'block';
        hideResults();
    }

    function hideLoading() {
        loading.style.display = 'none';
    }

    // Validate copies input
    copiesInput.addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        if (value < 1) {
            e.target.value = 1;
        } else if (value > 100) {
            e.target.value = 100;
        }
    });

    // Enter key in barcode input should trigger search/print
    barcodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchForm.dispatchEvent(new Event('submit'));
        }
    });
});
