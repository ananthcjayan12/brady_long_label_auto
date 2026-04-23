import { useRef, useEffect, useState } from 'react';

function BarcodeInput({ value, onChange, onLookup, isLoading }) {
    const inputRef = useRef(null);
    const debounceTimerRef = useRef(null);

    useEffect(() => {
        // Auto-focus input on mount and updates
        const focusInput = () => {
            if (inputRef.current && !isLoading) {
                // Prevent scrolling when focusing
                inputRef.current.focus({ preventScroll: true });
            }
        };

        focusInput();

        // Refocus loop for reliable continuous scanning
        const interval = setInterval(() => {
            if (document.activeElement !== inputRef.current && !isLoading) {
                focusInput();
            }
        }, 2000); // Check every 2s if we lost focus (e.g. user clicked away)

        return () => clearInterval(interval);
    }, [isLoading, value]); // Re-run when loading finishes or value is cleared

    // Keep focus on input (optional, good for dedicated scanning station)
    useEffect(() => {
        const handleBlur = () => {
            // setTimeout(() => inputRef.current?.focus(), 100);
        };
        const input = inputRef.current;
        if (input) input.addEventListener('blur', handleBlur);
        return () => input?.removeEventListener('blur', handleBlur);
    }, []);

    // Debounced Auto-Submit logic
    useEffect(() => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        if (value && value.trim().length >= 5) {
            debounceTimerRef.current = setTimeout(() => {
                onLookup(value);
            }, 500); // 500ms delay for snappier feel
        }
        return () => clearTimeout(debounceTimerRef.current);
    }, [value]);

    // Global Filter for Scanner Noise (prevents redirects/shortcuts)
    // Ported from legacy static/js/search.js
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Block standalone Shift key (keyCode 16) - barcode scanners often send this
            if (e.keyCode === 16 || e.key === 'Shift') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block standalone Alt key (keyCode 18) - barcode scanners often send this
            if (e.keyCode === 18 || e.key === 'Alt') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block standalone Control key (keyCode 17) - might also be sent by scanners
            if (e.keyCode === 17 || e.key === 'Control') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Insert key (keyCode 45) - especially when combined with Alt
            if (e.keyCode === 45 || e.key === 'Insert') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Alt+ArrowLeft (browser back navigation) - THIS IS THE MAIN CULPRIT
            if (e.altKey && (e.keyCode === 37 || e.key === 'ArrowLeft')) {
                console.log('Blocked Alt+ArrowLeft (browser back)');
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Alt+ArrowRight (browser forward navigation)
            if (e.altKey && (e.keyCode === 39 || e.key === 'ArrowRight')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Alt+ArrowDown
            if (e.altKey && (e.keyCode === 40 || e.key === 'ArrowDown')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Alt+ArrowUp
            if (e.altKey && (e.keyCode === 38 || e.key === 'ArrowUp')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block PageDown key (keyCode 34) - especially with Alt
            if (e.keyCode === 34 || e.key === 'PageDown') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block PageUp key (keyCode 33) - especially with Alt
            if (e.keyCode === 33 || e.key === 'PageUp') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Home key (often triggers browser home page navigation)
            if (e.keyCode === 36 || e.key === 'Home') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block End key
            if (e.keyCode === 35 || e.key === 'End') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Alt+Home (browser home page)
            if (e.altKey && (e.keyCode === 36 || e.key === 'Home')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Cmd+H (Mac hide window / browser home)
            if (e.metaKey && (e.keyCode === 72 || e.key === 'H' || e.key === 'h')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block F12 (DevTools)
            if (e.keyCode === 123 || e.key === 'F12') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Ctrl+Shift+I (Inspect Element)
            if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.key === 'I')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Ctrl+Shift+C (Inspect Element)
            if (e.ctrlKey && e.shiftKey && (e.keyCode === 67 || e.key === 'C')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && (e.keyCode === 74 || e.key === 'J')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Cmd+Option+I (Mac Inspect Element)
            if (e.metaKey && e.altKey && (e.keyCode === 73 || e.key === 'I' || e.key === 'i')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Cmd+Option+C (Mac Inspect Element)
            if (e.metaKey && e.altKey && (e.keyCode === 67 || e.key === 'C' || e.key === 'c')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            // Block Cmd+Option+J (Mac Console)
            if (e.metaKey && e.altKey && (e.keyCode === 74 || e.key === 'J' || e.key === 'j')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown, true); // true = capture phase (intervene early)
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown, true);
        };
    }, []);

    const handleKeyDown = (e) => {
        // --- SUBMISSION LOGIC ---
        if (e.key === 'Enter') {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            onLookup(value);
        }
    };

    return (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ marginBottom: '20px', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                Scan Barcode to Print
            </div>

            <input
                ref={inputRef}
                type="text"
                className="input"
                style={{
                    fontSize: '2rem',
                    textAlign: 'center',
                    letterSpacing: '2px',
                    height: '80px',
                    marginBottom: '20px'
                }}
                placeholder="Scan or Type..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
            />

            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {isLoading ? 'Searching...' : 'Ready to scan'}
            </div>
        </div>
    );
}

export default BarcodeInput;
