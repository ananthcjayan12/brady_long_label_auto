import { useState, useEffect } from 'react';
import { Server, RefreshCw, CheckCircle, XCircle, Crop, Clock, Eye, Printer, Zap, Sliders } from 'lucide-react';
import { api } from '../api';

function SettingsPage() {
    // Server settings
    const [serverUrl, setServerUrl] = useState('http://10.142.190.195:5001');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    // Printer settings
    const [printers, setPrinters] = useState([]);
    const [selectedPrinter, setSelectedPrinter] = useState('');
    const [loadingPrinters, setLoadingPrinters] = useState(false);

    // Label settings - default 100x38mm = ~3.94x1.5 inches
    const [labelSettings, setLabelSettings] = useState({
        width: 3.94,      // inches (100mm)
        height: 1.5,      // inches (38mm)
        offsetX: 0,       // inches from left
        offsetY: 0,       // inches from top
        scale: 100,       // percentage (50-200)
        dpi: 600,         // Higher default for better quality
        // Print Quality Settings
        color_mode: 'grayscale',  // rgb, grayscale, monochrome
        sharpening: true,         // Apply sharpening filter
        resampling: 'lanczos',    // lanczos (best), bicubic, bilinear, nearest
        contrast: 1.0,            // 0.5 to 2.0
        threshold: 128            // For monochrome mode (0-255)
    });

    // Auto-print settings
    const [autoPrintDelay, setAutoPrintDelay] = useState(3);

    // Preview state
    const [documents, setDocuments] = useState([]);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [selectedPage, setSelectedPage] = useState(1);
    const [previewKey, setPreviewKey] = useState(0);

    useEffect(() => {
        // Load server URL
        const storedUrl = localStorage.getItem('api_url');
        if (storedUrl) setServerUrl(storedUrl);

        // Load label settings
        const storedLabel = localStorage.getItem('label_settings');
        if (storedLabel) {
            try {
                setLabelSettings(JSON.parse(storedLabel));
            } catch (e) { }
        }

        // Load auto-print delay
        const storedDelay = localStorage.getItem('auto_print_delay');
        if (storedDelay) setAutoPrintDelay(parseInt(storedDelay, 10));

        // Load saved printer
        const storedPrinter = localStorage.getItem('selected_printer');
        if (storedPrinter) setSelectedPrinter(storedPrinter);

        // Load documents for preview
        loadDocuments();

        // Load printers
        loadPrinters();
    }, []);

    const loadPrinters = async () => {
        setLoadingPrinters(true);
        try {
            const result = await api.getPrinters();
            if (result.success) {
                setPrinters(result.printers || []);
                // If no printer selected yet, use default
                if (!selectedPrinter && result.default_printer) {
                    setSelectedPrinter(result.default_printer);
                    localStorage.setItem('selected_printer', result.default_printer);
                }
            }
        } catch (e) {
            console.error('Failed to load printers:', e);
        } finally {
            setLoadingPrinters(false);
        }
    };

    const loadDocuments = async () => {
        try {
            const result = await api.getDocuments();
            if (result.documents) {
                setDocuments(result.documents);
                if (result.documents.length > 0) {
                    setSelectedDoc(result.documents[0]);
                }
            }
        } catch (e) {
            console.error('Failed to load documents:', e);
        }
    };

    const handleSaveServer = async () => {
        setStatus('testing');
        setMessage('Testing connection...');

        let url = serverUrl.replace(/\/$/, "");

        try {
            const res = await fetch(`${url}/health`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok') {
                    localStorage.setItem('api_url', url);
                    setStatus('success');
                    setMessage('Connected successfully!');
                    loadDocuments();
                } else {
                    throw new Error('Invalid response');
                }
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            setStatus('error');
            setMessage(`Connection failed: ${error.message}`);
        }
    };

    const handleSaveLabelSettings = () => {
        localStorage.setItem('label_settings', JSON.stringify(labelSettings));
        localStorage.setItem('auto_print_delay', autoPrintDelay.toString());
        // Refresh preview
        setPreviewKey(prev => prev + 1);
    };

    const updateLabelSetting = (key, value) => {
        // Handle different types properly
        let processedValue = value;

        // String fields that shouldn't be parsed as numbers
        const stringFields = ['color_mode', 'resampling'];
        // Boolean fields
        const booleanFields = ['sharpening'];

        if (stringFields.includes(key)) {
            processedValue = value; // Keep as string
        } else if (booleanFields.includes(key)) {
            processedValue = value; // Keep as boolean
        } else {
            // Parse as number
            processedValue = parseFloat(value) || 0;
        }

        setLabelSettings(prev => ({ ...prev, [key]: processedValue }));
    };

    // Generate preview URL with label settings as query params
    const getPreviewUrlWithSettings = () => {
        if (!selectedDoc) return null;
        const base = api.getPreviewUrl(selectedDoc.id, selectedPage);
        // Add settings as query params for server to use
        const params = new URLSearchParams({
            width: labelSettings.width,
            height: labelSettings.height,
            offsetX: labelSettings.offsetX,
            offsetY: labelSettings.offsetY,
            scale: labelSettings.scale,
            _t: previewKey // cache buster
        });
        return `${base}?${params.toString()}`;
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '24px' }}>Settings</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left Column - Settings */}
                <div>
                    {/* Server Connection */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Server size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Server Connection</h3>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontWeight: 500, marginBottom: '8px', fontSize: '14px' }}>
                                Local Server URL
                            </label>
                            <input
                                type="text"
                                className="input"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                placeholder="http://localhost:5001"
                                style={{ width: '100%' }}
                            />
                        </div>

                        {status !== 'idle' && (
                            <div style={{
                                padding: '10px',
                                borderRadius: '6px',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: status === 'success' ? '#dcfce7' : status === 'error' ? '#fee2e2' : '#f3f4f6',
                                color: status === 'success' ? '#166534' : status === 'error' ? '#dc2626' : '#374151',
                                fontSize: '13px'
                            }}>
                                {status === 'success' && <CheckCircle size={16} />}
                                {status === 'error' && <XCircle size={16} />}
                                {status === 'testing' && <RefreshCw size={16} />}
                                {message}
                            </div>
                        )}

                        <button className="btn btn-primary" onClick={handleSaveServer} disabled={status === 'testing'}>
                            {status === 'testing' ? 'Testing...' : 'Test & Save'}
                        </button>
                    </div>

                    {/* Printer Selection */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Printer size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Printer</h3>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontWeight: 500, marginBottom: '8px', fontSize: '14px' }}>
                                Select Printer
                            </label>
                            {printers.length === 0 ? (
                                <div style={{
                                    padding: '12px',
                                    background: '#fef3c7',
                                    borderRadius: '6px',
                                    color: '#b45309',
                                    fontSize: '13px',
                                    marginBottom: '12px'
                                }}>
                                    <strong>No printers found.</strong> Please add a printer in System Settings → Printers & Scanners.
                                </div>
                            ) : (
                                <select
                                    className="input"
                                    value={selectedPrinter}
                                    onChange={(e) => {
                                        setSelectedPrinter(e.target.value);
                                        localStorage.setItem('selected_printer', e.target.value);
                                    }}
                                    style={{ width: '100%' }}
                                >
                                    <option value="">-- Select a printer --</option>
                                    {printers.map(printer => (
                                        <option key={printer} value={printer}>{printer}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <button
                            className="btn btn-secondary"
                            onClick={loadPrinters}
                            disabled={loadingPrinters}
                            style={{ width: '100%' }}
                        >
                            <RefreshCw size={14} style={{ marginRight: '6px' }} />
                            {loadingPrinters ? 'Refreshing...' : 'Refresh Printers'}
                        </button>
                    </div>

                    {/* Label Settings */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Crop size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Label Dimensions</h3>
                        </div>

                        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                            Configure the label crop area. Default is 100x38mm.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>Width (in)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={labelSettings.width}
                                    onChange={(e) => updateLabelSetting('width', e.target.value)}
                                    step="0.1"
                                    min="0.5"
                                    max="12"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>Height (in)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={labelSettings.height}
                                    onChange={(e) => updateLabelSetting('height', e.target.value)}
                                    step="0.1"
                                    min="0.5"
                                    max="12"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>Offset X (in)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={labelSettings.offsetX}
                                    onChange={(e) => updateLabelSetting('offsetX', e.target.value)}
                                    step="0.1"
                                    min="0"
                                    max="6"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>Offset Y (in)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={labelSettings.offsetY}
                                    onChange={(e) => updateLabelSetting('offsetY', e.target.value)}
                                    step="0.1"
                                    min="0"
                                    max="6"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>Print DPI</label>
                            <select
                                className="input"
                                value={labelSettings.dpi}
                                onChange={(e) => updateLabelSetting('dpi', e.target.value)}
                                style={{ width: '100%', marginTop: '4px' }}
                            >
                                <option value="150">150 DPI (Fast)</option>
                                <option value="300">300 DPI (Standard)</option>
                                <option value="600">600 DPI (High Quality)</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>
                                Content Scale: {labelSettings.scale}%
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>50%</span>
                                <input
                                    type="range"
                                    min="50"
                                    max="200"
                                    step="5"
                                    value={labelSettings.scale}
                                    onChange={(e) => updateLabelSetting('scale', e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>200%</span>
                            </div>
                            <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                Shrink (&lt;100%) or expand (&gt;100%) the content to fit your label.
                            </p>
                        </div>
                    </div>

                    {/* Print Quality Settings - NEW */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Zap size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Print Quality</h3>
                        </div>

                        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                            Optimize print output for your Brady label printer. Higher quality = slower printing.
                        </p>

                        {/* Color Mode */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>Color Mode</label>
                            <select
                                className="input"
                                value={labelSettings.color_mode}
                                onChange={(e) => updateLabelSetting('color_mode', e.target.value)}
                                style={{ width: '100%', marginTop: '4px' }}
                            >
                                <option value="rgb">RGB (Full Color)</option>
                                <option value="grayscale">Grayscale (Recommended)</option>
                                <option value="monochrome">Monochrome (Best for Thermal)</option>
                            </select>
                            <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                Grayscale is best for most label printers. Use Monochrome for pure B&W thermal printers.
                            </p>
                        </div>

                        {/* Threshold for Monochrome */}
                        {labelSettings.color_mode === 'monochrome' && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 500 }}>
                                    B/W Threshold: {labelSettings.threshold}
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dark</span>
                                    <input
                                        type="range"
                                        min="50"
                                        max="200"
                                        step="5"
                                        value={labelSettings.threshold}
                                        onChange={(e) => updateLabelSetting('threshold', parseInt(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Light</span>
                                </div>
                                <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                    Lower = more black, Higher = more white. Default 128 is usually best.
                                </p>
                            </div>
                        )}

                        {/* Resampling Algorithm */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>Resampling Quality</label>
                            <select
                                className="input"
                                value={labelSettings.resampling}
                                onChange={(e) => updateLabelSetting('resampling', e.target.value)}
                                style={{ width: '100%', marginTop: '4px' }}
                            >
                                <option value="lanczos">Lanczos (Best Quality)</option>
                                <option value="bicubic">Bicubic (Good)</option>
                                <option value="bilinear">Bilinear (Fast)</option>
                                <option value="nearest">Nearest (Fastest)</option>
                            </select>
                            <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                Lanczos provides the sharpest barcodes and text. Use faster options if printing is slow.
                            </p>
                        </div>

                        {/* Sharpening Toggle */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                padding: '12px',
                                background: labelSettings.sharpening ? 'rgba(99, 91, 255, 0.08)' : '#f8f9fa',
                                borderRadius: '8px',
                                border: labelSettings.sharpening ? '1px solid rgba(99, 91, 255, 0.3)' : '1px solid var(--border)'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={labelSettings.sharpening}
                                    onChange={(e) => updateLabelSetting('sharpening', e.target.checked)}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '13px' }}>Enable Sharpening</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Improves barcode and text clarity (recommended)
                                    </div>
                                </div>
                            </label>
                        </div>

                        {/* Contrast Slider */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>
                                Contrast: {labelSettings.contrast.toFixed(1)}x
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>0.5</span>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={labelSettings.contrast}
                                    onChange={(e) => updateLabelSetting('contrast', parseFloat(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>2.0</span>
                            </div>
                            <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                1.0 = no change. Increase for bolder barcodes, decrease for lighter prints.
                            </p>
                        </div>

                        {/* Quality Preset Buttons */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1, fontSize: '12px' }}
                                onClick={() => setLabelSettings(prev => ({
                                    ...prev,
                                    dpi: 300,
                                    color_mode: 'grayscale',
                                    sharpening: false,
                                    resampling: 'bilinear',
                                    contrast: 1.0
                                }))}
                            >
                                ⚡ Fast
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1, fontSize: '12px' }}
                                onClick={() => setLabelSettings(prev => ({
                                    ...prev,
                                    dpi: 600,
                                    color_mode: 'grayscale',
                                    sharpening: true,
                                    resampling: 'lanczos',
                                    contrast: 1.0
                                }))}
                            >
                                ✨ Optimal
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1, fontSize: '12px' }}
                                onClick={() => setLabelSettings(prev => ({
                                    ...prev,
                                    dpi: 600,
                                    color_mode: 'monochrome',
                                    sharpening: true,
                                    resampling: 'lanczos',
                                    contrast: 1.2,
                                    threshold: 128
                                }))}
                            >
                                🏷️ Thermal
                            </button>
                        </div>
                    </div>

                    {/* Auto-Print Settings */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Clock size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Auto-Print</h3>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500 }}>Delay (seconds)</label>
                            <input
                                type="number"
                                className="input"
                                value={autoPrintDelay}
                                onChange={(e) => setAutoPrintDelay(parseInt(e.target.value, 10) || 3)}
                                min="1"
                                max="10"
                                style={{ width: '100%', marginTop: '4px' }}
                            />
                        </div>

                        <button className="btn btn-primary" onClick={handleSaveLabelSettings}>
                            Save Settings & Update Preview
                        </button>
                    </div>
                </div>

                {/* Right Column - Live Preview */}
                <div>
                    <div className="card" style={{ height: '100%' }}>
                        <div className="flex items-center" style={{ marginBottom: '16px' }}>
                            <Eye size={20} color="var(--primary)" style={{ marginRight: '10px' }} />
                            <h3 style={{ fontSize: '16px', margin: 0 }}>Live Preview</h3>
                        </div>

                        {documents.length > 0 ? (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 500 }}>Select Document</label>
                                    <select
                                        className="input"
                                        value={selectedDoc?.id || ''}
                                        onChange={(e) => {
                                            const doc = documents.find(d => d.id === e.target.value);
                                            setSelectedDoc(doc);
                                            setSelectedPage(1);
                                            setPreviewKey(prev => prev + 1);
                                        }}
                                        style={{ width: '100%', marginTop: '4px' }}
                                    >
                                        {documents.map(doc => (
                                            <option key={doc.id} value={doc.id}>{doc.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedDoc && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 500 }}>Page</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={selectedPage}
                                            onChange={(e) => {
                                                setSelectedPage(parseInt(e.target.value, 10) || 1);
                                                setPreviewKey(prev => prev + 1);
                                            }}
                                            min="1"
                                            max={selectedDoc.pages || 100}
                                            style={{ width: '100%', marginTop: '4px' }}
                                        />
                                    </div>
                                )}

                                <div style={{
                                    border: '2px solid var(--border)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    background: '#f8f9fa',
                                    minHeight: '200px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {getPreviewUrlWithSettings() ? (
                                        <iframe
                                            key={previewKey}
                                            src={getPreviewUrlWithSettings()}
                                            style={{
                                                width: '100%',
                                                height: '300px',
                                                border: 'none'
                                            }}
                                            title="Label Preview"
                                        />
                                    ) : (
                                        <div className="text-muted" style={{ padding: '40px', textAlign: 'center' }}>
                                            Select a document to preview
                                        </div>
                                    )}
                                </div>

                                <p className="text-muted" style={{ fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
                                    Preview shows cropped area: {labelSettings.width}" × {labelSettings.height}"
                                </p>
                            </>
                        ) : (
                            <div style={{
                                padding: '60px 20px',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                background: '#f8f9fa',
                                borderRadius: '8px'
                            }}>
                                <p style={{ marginBottom: '8px' }}>No documents uploaded yet.</p>
                                <p style={{ fontSize: '13px' }}>Upload a PDF first to see the preview.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;
