import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, RefreshCw, Server } from 'lucide-react';
import { api } from '../api';

const DEFAULT_SERVER = 'http://localhost:5001';

function QRTemplatePage() {
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('api_url') || DEFAULT_SERVER);
    const [status, setStatus] = useState({ type: 'idle', message: '' });
    const [qrData, setQrData] = useState('https://example.com/item/ABC-123');
    const [label, setLabel] = useState('Sample QR Label');
    const [printers, setPrinters] = useState([]);
    const [selectedPrinter, setSelectedPrinter] = useState(localStorage.getItem('selected_printer') || '');
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [previewSrc, setPreviewSrc] = useState('');

    const [labelSettings, setLabelSettings] = useState(() => {
        const stored = localStorage.getItem('label_settings');
        if (!stored) {
            return { width: 3.94, height: 2.0 };
        }
        try {
            const parsed = JSON.parse(stored);
            return {
                width: Number(parsed.width) || 3.94,
                height: Number(parsed.height) || 2.0
            };
        } catch {
            return { width: 3.94, height: 2.0 };
        }
    });

    useEffect(() => {
        regeneratePreview();
    }, [qrData]);

    const previewUrl = useMemo(() => {
        const base = serverUrl.replace(/\/$/, '');
        const params = new URLSearchParams({
            data: qrData,
            label,
            width: String(labelSettings.width),
            height: String(labelSettings.height)
        });
        return `${base}/api/qr/preview?${params.toString()}`;
    }, [serverUrl, qrData, label, labelSettings]);

    const saveSettings = () => {
        const normalizedUrl = serverUrl.replace(/\/$/, '');
        localStorage.setItem('api_url', normalizedUrl);
        localStorage.setItem('selected_printer', selectedPrinter);
        localStorage.setItem('label_settings', JSON.stringify(labelSettings));
        setStatus({ type: 'success', message: 'Template settings saved.' });
    };

    const testServer = async () => {
        setStatus({ type: 'loading', message: 'Checking server...' });
        const normalizedUrl = serverUrl.replace(/\/$/, '');
        localStorage.setItem('api_url', normalizedUrl);
        try {
            const result = await api.checkHealth();
            if (result?.status === 'ok') {
                setStatus({ type: 'success', message: 'Server connected.' });
            } else {
                setStatus({ type: 'error', message: 'Unexpected server response.' });
            }
        } catch {
            setStatus({ type: 'error', message: 'Cannot reach print server.' });
        }
    };

    const loadPrinters = async () => {
        setLoadingPrinters(true);
        setStatus({ type: 'idle', message: '' });
        try {
            const result = await api.getPrinters();
            if (result.success) {
                setPrinters(result.printers || []);
                const nextPrinter = selectedPrinter || result.default_printer || '';
                setSelectedPrinter(nextPrinter);
                if (nextPrinter) {
                    localStorage.setItem('selected_printer', nextPrinter);
                }
            } else {
                setStatus({ type: 'error', message: result.error || 'Could not load printers.' });
            }
        } catch {
            setStatus({ type: 'error', message: 'Could not load printers.' });
        } finally {
            setLoadingPrinters(false);
        }
    };

    const regeneratePreview = async () => {
        if (!qrData.trim()) {
            setPreviewSrc('');
            return;
        }
        try {
            const dataUrl = await QRCode.toDataURL(qrData, {
                margin: 1,
                width: 280,
                errorCorrectionLevel: 'M'
            });
            setPreviewSrc(dataUrl);
        } catch {
            setPreviewSrc('');
        }
    };

    const onPrint = async () => {
        if (!qrData.trim()) {
            setStatus({ type: 'error', message: 'Enter QR data before printing.' });
            return;
        }

        setPrinting(true);
        setStatus({ type: 'loading', message: 'Sending print job...' });

        try {
            const response = await api.printQrLabel({
                data: qrData,
                label,
                printerName: selectedPrinter || null,
                labelSettings
            });

            if (response?.mode === 'preview') {
                window.open(previewUrl, '_blank');
            }

            if (response.success) {
                setStatus({ type: 'success', message: response.message || 'Print sent successfully.' });
            } else {
                setStatus({ type: 'error', message: response.error || 'Print failed.' });
            }
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || 'Print failed.';
            setStatus({ type: 'error', message: errorMessage });
        } finally {
            setPrinting(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '960px', paddingTop: '40px', paddingBottom: '40px' }}>
            <div className="card" style={{ marginBottom: '16px' }}>
                <h1 style={{ marginBottom: '8px' }}>QR Print Template</h1>
                <p>Template repository for generating QR labels and printing them through the local print server.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="card">
                    <div className="flex items-center" style={{ marginBottom: '12px' }}>
                        <Server size={18} color="var(--primary)" />
                        <h3>Server & Printer</h3>
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Server URL</label>
                    <input
                        className="input"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        placeholder="http://localhost:5001"
                        style={{ marginTop: '6px', marginBottom: '10px' }}
                    />

                    <div className="flex" style={{ marginBottom: '16px' }}>
                        <button className="btn btn-secondary" onClick={testServer}>Test Connection</button>
                        <button className="btn btn-secondary" onClick={loadPrinters} disabled={loadingPrinters}>
                            <RefreshCw size={14} />
                            {loadingPrinters ? 'Loading...' : 'Load Printers'}
                        </button>
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Printer</label>
                    <select
                        className="input"
                        style={{ marginTop: '6px', marginBottom: '10px' }}
                        value={selectedPrinter}
                        onChange={(e) => {
                            setSelectedPrinter(e.target.value);
                            localStorage.setItem('selected_printer', e.target.value);
                        }}
                    >
                        <option value="">Default Printer</option>
                        {printers.map((printer) => (
                            <option key={printer} value={printer}>{printer}</option>
                        ))}
                    </select>

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Label Width (inches)</label>
                    <input
                        className="input"
                        type="number"
                        min="1"
                        max="8.5"
                        step="0.1"
                        value={labelSettings.width}
                        onChange={(e) => setLabelSettings((prev) => ({ ...prev, width: Number(e.target.value) || 3.94 }))}
                        style={{ marginTop: '6px', marginBottom: '10px' }}
                    />

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Label Height (inches)</label>
                    <input
                        className="input"
                        type="number"
                        min="1"
                        max="11"
                        step="0.1"
                        value={labelSettings.height}
                        onChange={(e) => setLabelSettings((prev) => ({ ...prev, height: Number(e.target.value) || 2.0 }))}
                        style={{ marginTop: '6px', marginBottom: '16px' }}
                    />

                    <button className="btn btn-primary" onClick={saveSettings}>Save Template Settings</button>
                </div>

                <div className="card">
                    <div className="flex items-center" style={{ marginBottom: '12px' }}>
                        <Printer size={18} color="var(--primary)" />
                        <h3>QR Content</h3>
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>QR Data</label>
                    <textarea
                        className="input"
                        rows={4}
                        value={qrData}
                        onChange={(e) => setQrData(e.target.value)}
                        placeholder="Text or URL to encode"
                        style={{ marginTop: '6px', marginBottom: '10px', resize: 'vertical' }}
                    />

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Label Text (optional)</label>
                    <input
                        className="input"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        style={{ marginTop: '6px', marginBottom: '16px' }}
                    />

                    <button className="btn btn-primary" onClick={onPrint} disabled={printing}>
                        {printing ? 'Printing...' : 'Generate & Print QR'}
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginTop: '16px' }}>
                <h3 style={{ marginBottom: '8px' }}>Preview</h3>
                {previewSrc ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <img src={previewSrc} alt="QR Preview" style={{ width: 220, height: 220, border: '1px solid var(--border)', borderRadius: '8px' }} />
                        <p style={{ fontSize: '13px' }}>PDF preview endpoint: {previewUrl}</p>
                    </div>
                ) : (
                    <p>Enter QR data to generate preview.</p>
                )}
            </div>

            {status.type !== 'idle' && (
                <div
                    className={`status-badge ${status.type === 'error' ? 'status-error' : status.type === 'success' ? 'status-success' : ''}`}
                    style={{ marginTop: '12px' }}
                >
                    {status.message}
                </div>
            )}
        </div>
    );
}

export default QRTemplatePage;
