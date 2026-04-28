import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, RefreshCw, Server } from 'lucide-react';
import { api } from '../api';
import { buildLabelSettingsPayload, loadLayoutProfiles } from '../qrLayoutSettings';

const DEFAULT_SERVER = 'http://localhost:5001';

function normalizeScanData(value) {
    return (value || '').replace(/\r/g, '').replace(/\n/g, '').trim();
}

function parseScanPayload(value) {
    const payload = normalizeScanData(value);
    if (!payload) {
        return { payload: '', line1: '', line2: '', error: '' };
    }

    const parts = payload.split('$');
    if (parts.length < 2) {
        return { payload, line1: '', line2: '', error: 'Invalid scan format. Use: <line1>$<line2>' };
    }
    const line1 = parts[0].trim().toUpperCase();
    const line2 = parts[1].replace(/\D/g, '');
    const normalizedPayload = `${line1}$${line2}`;

    if (!line1 || !line2) {
        return { payload: normalizedPayload, line1, line2, error: 'Both line 1 and line 2 are required.' };
    }

    if (![15, 16].includes(line1.length)) {
        return { payload: normalizedPayload, line1, line2, error: 'Line 1 must be 15 or 16 characters.' };
    }

    if (!/^\d{10}$/.test(line2)) {
        return { payload: normalizedPayload, line1, line2, error: 'Line 2 must be exactly 10 digits.' };
    }

    return { payload: normalizedPayload, line1, line2, error: '' };
}

function QRTemplatePage({ layoutProfiles, onOpenSettings }) {
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('api_url') || DEFAULT_SERVER);
    const [status, setStatus] = useState({ type: 'idle', message: '' });
    const [qrData, setQrData] = useState('FOB1NA2R411105MA$2534007223');
    const [templateType, setTemplateType] = useState(localStorage.getItem('template_type') || 'template_1');
    const [printers, setPrinters] = useState([]);
    const [selectedPrinter, setSelectedPrinter] = useState(localStorage.getItem('selected_printer') || '');
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [autoPrintEnabled, setAutoPrintEnabled] = useState(localStorage.getItem('qr_auto_print_enabled') === 'true');
    const [autoPrintDelay, setAutoPrintDelay] = useState(() => {
        const saved = localStorage.getItem('auto_print_delay');
        const parsed = saved ? parseInt(saved, 10) : 3;
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
    });
    const autoPrintTimerRef = useRef(null);
    const lastPrintedPayloadRef = useRef('');

    const parsedPayload = useMemo(() => parseScanPayload(qrData), [qrData]);
    const activeLayoutProfiles = useMemo(
        () => layoutProfiles || loadLayoutProfiles(),
        [layoutProfiles]
    );
    const labelSettingsPayload = useMemo(
        () => buildLabelSettingsPayload(activeLayoutProfiles, templateType),
        [activeLayoutProfiles, templateType]
    );

    const previewUrl = useMemo(() => {
        if (!parsedPayload.payload || parsedPayload.error) {
            return '';
        }
        const base = serverUrl.replace(/\/$/, '');
        const params = new URLSearchParams({
            data: parsedPayload.payload,
            template_type: templateType,
            layout: JSON.stringify(labelSettingsPayload)
        });
        return `${base}/api/qr/preview?${params.toString()}`;
    }, [serverUrl, parsedPayload.payload, parsedPayload.error, templateType, labelSettingsPayload]);

    const saveSettings = () => {
        const normalizedUrl = serverUrl.replace(/\/$/, '');
        localStorage.setItem('api_url', normalizedUrl);
        localStorage.setItem('selected_printer', selectedPrinter);
        localStorage.setItem('template_type', templateType);
        localStorage.setItem('qr_auto_print_enabled', autoPrintEnabled ? 'true' : 'false');
        localStorage.setItem('auto_print_delay', String(autoPrintDelay));
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

    const onPrint = async () => {
        if (!parsedPayload.payload) {
            setStatus({ type: 'error', message: 'Scan QR data before printing.' });
            return;
        }

        if (parsedPayload.error) {
            setStatus({ type: 'error', message: parsedPayload.error });
            return;
        }

        setPrinting(true);
        setStatus({ type: 'loading', message: 'Sending print job...' });
        lastPrintedPayloadRef.current = parsedPayload.payload;

        try {
            const response = await api.printQrLabel({
                data: parsedPayload.payload,
                label: '',
                templateType,
                printerName: selectedPrinter || null,
                labelSettings: labelSettingsPayload
            });

            if (response?.mode === 'preview') {
                const normalizedServer = serverUrl.replace(/\/$/, '');
                const previewLink = response.preview_url ? `${normalizedServer}${response.preview_url}` : previewUrl;
                window.open(previewLink, '_blank');
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

    useEffect(() => {
        if (autoPrintTimerRef.current) {
            clearTimeout(autoPrintTimerRef.current);
            autoPrintTimerRef.current = null;
        }
        if (!autoPrintEnabled || printing || parsedPayload.error || !parsedPayload.payload) {
            return;
        }
        if (parsedPayload.payload === lastPrintedPayloadRef.current) {
            return;
        }

        autoPrintTimerRef.current = setTimeout(() => {
            onPrint();
        }, Math.max(0, autoPrintDelay) * 1000);

        return () => {
            if (autoPrintTimerRef.current) {
                clearTimeout(autoPrintTimerRef.current);
                autoPrintTimerRef.current = null;
            }
        };
    }, [autoPrintEnabled, autoPrintDelay, parsedPayload.payload, parsedPayload.error, printing, templateType]);

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
                        <h3>Server, Printer & Template</h3>
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

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Template Option</label>
                    <select
                        className="input"
                        style={{ marginTop: '6px', marginBottom: '10px' }}
                        value={templateType}
                        onChange={(e) => setTemplateType(e.target.value)}
                    >
                        <option value="template_1">Template 1 (First Cell Type)</option>
                        <option value="template_2">Template 2 (Second Cell Type)</option>
                        <option value="template_3">Template 3 (Line1 + Barcode + Line3)</option>
                    </select>

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Auto Print</label>
                    <div style={{ marginTop: '6px', marginBottom: '10px', display: 'grid', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                            <input
                                type="checkbox"
                                checked={autoPrintEnabled}
                                onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                            />
                            Auto print after valid scan data is entered
                        </label>
                        <div>
                            <label style={{ fontSize: '13px', fontWeight: 500 }}>Delay (seconds)</label>
                            <input
                                className="input"
                                type="number"
                                min="0"
                                step="1"
                                value={autoPrintDelay}
                                onChange={(e) => {
                                    const parsed = parseInt(e.target.value, 10);
                                    setAutoPrintDelay(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
                                }}
                                style={{ marginTop: '6px' }}
                            />
                        </div>
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Active Label Measurement</label>
                    <p style={{ marginTop: '6px', marginBottom: '16px', fontSize: '13px' }}>
                        Width: {labelSettingsPayload.width_in} in, Total Height: {labelSettingsPayload.total_height_in} in,
                        Top Printable: {labelSettingsPayload.top_printable_height_in} in.
                    </p>

                    <div className="flex" style={{ flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={saveSettings}>Save Template Settings</button>
                        <button className="btn btn-secondary" onClick={onOpenSettings}>Open Layout Settings</button>
                    </div>
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
                        placeholder="Scan value format: LINE1$LINE2"
                        style={{ marginTop: '6px', marginBottom: '10px', resize: 'vertical' }}
                    />

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Line 1</label>
                    <input className="input" value={parsedPayload.line1} readOnly style={{ marginTop: '6px', marginBottom: '10px' }} />

                    <label style={{ fontSize: '13px', fontWeight: 500 }}>Line 2</label>
                    <input className="input" value={parsedPayload.line2} readOnly style={{ marginTop: '6px', marginBottom: '10px' }} />

                    {parsedPayload.error && (
                        <div className="status-badge status-error" style={{ marginBottom: '12px' }}>
                            {parsedPayload.error}
                        </div>
                    )}

                    <button className="btn btn-primary" onClick={onPrint} disabled={printing}>
                        {printing ? 'Printing...' : 'Generate & Print QR'}
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginTop: '16px' }}>
                <h3 style={{ marginBottom: '8px' }}>Preview</h3>
                {previewUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <iframe
                            title="Label Preview"
                            src={`${previewUrl}#toolbar=0&zoom=page-width`}
                            style={{ width: '100%', height: '360px', border: '1px solid var(--border)', borderRadius: '8px' }}
                        />
                    </div>
                ) : (
                    <p>Enter valid QR data in `LINE1$LINE2` format to generate preview.</p>
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
