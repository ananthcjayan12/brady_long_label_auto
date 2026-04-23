import { useState, useEffect, useRef } from 'react';
import BarcodeInput from '../components/BarcodeInput';
import LabelPreview from '../components/LabelPreview';
import { api } from '../api';
import { AlertTriangle, Copy, Clock, Printer } from 'lucide-react';

function ScanPage() {
    const [barcode, setBarcode] = useState('');
    const [scanResult, setScanResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [error, setError] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState(null);
    const autoPrintTimerRef = useRef(null);

    // Get auto-print delay from settings (default 3 seconds)
    const getAutoPrintDelay = () => {
        const saved = localStorage.getItem('auto_print_delay');
        return saved ? parseInt(saved, 10) : 3;
    };

    // Auto-print effect: triggers print after countdown (only if not a duplicate)
    useEffect(() => {
        if (scanResult && !isPrinting && !showDuplicateModal) {
            const delay = getAutoPrintDelay();
            setCountdown(delay);

            // Start countdown
            const countdownInterval = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            // Auto-print timer
            autoPrintTimerRef.current = setTimeout(() => {
                handlePrint();
            }, delay * 1000);

            return () => {
                clearTimeout(autoPrintTimerRef.current);
                clearInterval(countdownInterval);
            };
        }
    }, [scanResult, showDuplicateModal]);

    const handleLookup = async (code) => {
        if (!code) return;

        // Cancel any pending auto-print
        if (autoPrintTimerRef.current) {
            clearTimeout(autoPrintTimerRef.current);
        }

        setIsLoading(true);
        setError(null);
        setScanResult(null);
        setCountdown(null);
        setShowDuplicateModal(false);
        setDuplicateInfo(null);

        try {
            const result = await api.scanBarcode(code);

            if (result.success && result.found) {
                // Check if this barcode was printed before
                if (result.print_count > 0) {
                    // Show duplicate confirmation modal
                    setDuplicateInfo({
                        printCount: result.print_count,
                        lastPrint: result.last_print
                    });
                    setScanResult(result.mapping);
                    setShowDuplicateModal(true);
                } else {
                    // No previous prints, proceed normally
                    setScanResult(result.mapping);
                }
            } else {
                setError('Barcode not found in any uploaded document.');
            }
        } catch (err) {
            setError('Error searching for barcode. Is the server running?');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = async () => {
        if (!scanResult || isPrinting) return;

        // Cancel countdown
        if (autoPrintTimerRef.current) {
            clearTimeout(autoPrintTimerRef.current);
        }
        setCountdown(null);
        setShowDuplicateModal(false);

        setIsPrinting(true);
        try {
            // Get label settings from localStorage
            const labelSettings = JSON.parse(localStorage.getItem('label_settings') || '{}');
            // Get selected printer from localStorage
            const printerName = localStorage.getItem('selected_printer') || null;
            // Get username from sessionStorage (set by Login)
            const session = JSON.parse(sessionStorage.getItem('auth_session') || '{}');
            const username = session.username || 'Anonymous';

            const printResponse = await api.printLabel(
                scanResult.file_id,
                scanResult.page_num,
                printerName, // Use selected printer
                labelSettings, // Pass crop settings
                username // Pass username
            );

            if (printResponse?.mode === 'preview' && printResponse?.preview_url) {
                const baseUrl = localStorage.getItem('api_url') || 'http://localhost:5001';
                window.open(`${baseUrl}${printResponse.preview_url}`, '_blank');
            }

            // Silent success: just reset for next scan after brief display
            setTimeout(() => {
                setBarcode('');
                setScanResult(null);
                setDuplicateInfo(null);
                setError(null);
            }, 500);

        } catch (err) {
            console.error('Print error:', err);
            // Optionally show brief error indicator
            setError('Print failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDuplicateProceed = () => {
        setShowDuplicateModal(false);
        // Start auto-print countdown after user confirms
    };

    const cancelAutoPrint = () => {
        if (autoPrintTimerRef.current) {
            clearTimeout(autoPrintTimerRef.current);
        }
        setCountdown(null);
        setScanResult(null);
        setBarcode('');
        setShowDuplicateModal(false);
        setDuplicateInfo(null);
    };

    const formatTimestamp = (isoString) => {
        if (!isoString) return 'Unknown';
        const date = new Date(isoString);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div style={{ maxWidth: '480px', margin: '60px auto' }}>
            <div className="text-center" style={{ marginBottom: '32px' }}>
                <h1 style={{ marginBottom: '8px' }}>Scan to Print</h1>
                <p>Scan a barcode. Label prints automatically.</p>
            </div>

            <BarcodeInput
                value={barcode}
                onChange={setBarcode}
                onLookup={handleLookup}
                isLoading={isLoading}
            />

            {error && (
                <div className="card status-error" style={{
                    marginTop: '24px',
                    padding: '16px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '1px solid var(--error)'
                }}>
                    <span style={{ fontWeight: 500 }}>Error:</span> {error}
                </div>
            )}

            {/* Duplicate Confirmation Modal */}
            {showDuplicateModal && duplicateInfo && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="card animate-in" style={{
                        maxWidth: '400px',
                        width: '90%',
                        padding: '24px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px'
                        }}>
                            <AlertTriangle size={28} color="#f59e0b" />
                        </div>

                        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>
                            Duplicate Print Detected
                        </h2>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            This barcode has been printed <strong style={{ color: 'var(--primary)' }}>{duplicateInfo.printCount} time{duplicateInfo.printCount > 1 ? 's' : ''}</strong> before.
                        </p>

                        {duplicateInfo.lastPrint && (
                            <div style={{
                                background: '#f9fafb',
                                padding: '12px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    <Clock size={14} />
                                    <span>Last printed: {formatTimestamp(duplicateInfo.lastPrint.timestamp)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    <Printer size={14} />
                                    <span>Printer: {duplicateInfo.lastPrint.printer}</span>
                                </div>
                            </div>
                        )}

                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            Do you want to print this label again?
                        </p>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={cancelAutoPrint}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleDuplicateProceed}
                                style={{ flex: 1 }}
                            >
                                Print Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {scanResult && !showDuplicateModal && (
                <div className="card animate-in" style={{ marginTop: '24px', textAlign: 'center' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Found: <strong>{scanResult.doc_name}</strong> - Page {scanResult.page_num}
                        </div>

                        {/* Duplicate Badge */}
                        {duplicateInfo && duplicateInfo.printCount > 0 && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#b45309',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 500,
                                marginBottom: '12px'
                            }}>
                                <Copy size={12} />
                                Reprinting (#{duplicateInfo.printCount + 1})
                            </div>
                        )}

                        {/* Preview */}
                        <iframe
                            src={api.getPreviewUrl(scanResult.file_id, scanResult.page_num)}
                            style={{
                                width: '100%',
                                height: '180px',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                            }}
                            title="Label Preview"
                        />
                    </div>

                    {countdown !== null && countdown > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{
                                fontSize: '32px',
                                fontWeight: '700',
                                color: 'var(--primary)',
                                marginBottom: '4px'
                            }}>
                                {countdown}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Printing automatically...
                            </div>
                        </div>
                    )}

                    {isPrinting && (
                        <div style={{ color: 'var(--primary)', fontWeight: 500 }}>
                            Sending to printer...
                        </div>
                    )}

                    <button
                        className="btn btn-secondary"
                        onClick={cancelAutoPrint}
                        style={{ marginTop: '12px' }}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

export default ScanPage;
