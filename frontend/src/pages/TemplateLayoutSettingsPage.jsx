import { useMemo, useState } from 'react';
import {
    buildLabelSettingsPayload,
    DEFAULT_GLOBAL_LAYOUT,
    DEFAULT_TEMPLATE_LAYOUTS,
    FONT_OPTIONS,
    normalizeLayoutProfiles
} from '../qrLayoutSettings';

const DEFAULT_SERVER = 'http://localhost:5001';

function NumericInput({ label, value, step = '0.01', min, max, onChange, hint }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>{label}</label>
            <input
                className="input"
                type="number"
                value={value}
                step={step}
                min={min}
                max={max}
                onChange={(e) => onChange(e.target.value)}
            />
            {hint && <p style={{ fontSize: '12px' }}>{hint}</p>}
        </div>
    );
}

function FontSelect({ label, value, onChange }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>{label}</label>
            <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
                {FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>{font}</option>
                ))}
            </select>
        </div>
    );
}

function TemplateLayoutSettingsPage({ profiles, onSaveProfiles, onBackToPrint }) {
    const [selectedTemplate, setSelectedTemplate] = useState('template_1');
    const [workingProfiles, setWorkingProfiles] = useState(() => normalizeLayoutProfiles(profiles));
    const [status, setStatus] = useState({ type: 'idle', message: '' });
    const [previewServerUrl, setPreviewServerUrl] = useState(localStorage.getItem('api_url') || DEFAULT_SERVER);
    const [sampleQrData, setSampleQrData] = useState('FOB1NA2R411105MA$2534007223');
    const [previewNonce, setPreviewNonce] = useState(0);

    const selectedLayout = useMemo(
        () => workingProfiles[selectedTemplate] || DEFAULT_TEMPLATE_LAYOUTS[selectedTemplate],
        [workingProfiles, selectedTemplate]
    );
    const previewPayload = useMemo(
        () => buildLabelSettingsPayload(workingProfiles, selectedTemplate),
        [workingProfiles, selectedTemplate]
    );
    const previewUrl = useMemo(() => {
        const normalizedServer = (previewServerUrl || DEFAULT_SERVER).replace(/\/$/, '');
        const params = new URLSearchParams({
            data: sampleQrData,
            template_type: selectedTemplate,
            layout: JSON.stringify(previewPayload),
            _t: String(previewNonce)
        });
        return `${normalizedServer}/api/qr/preview?${params.toString()}`;
    }, [previewServerUrl, sampleQrData, selectedTemplate, previewPayload, previewNonce]);

    const updateGlobal = (key, value) => {
        setWorkingProfiles((prev) => ({
            ...prev,
            global: {
                ...prev.global,
                [key]: Number(value)
            }
        }));
        setStatus({ type: 'idle', message: '' });
    };

    const updateTemplate = (key, value) => {
        setWorkingProfiles((prev) => ({
            ...prev,
            [selectedTemplate]: {
                ...prev[selectedTemplate],
                [key]: value
            }
        }));
        setStatus({ type: 'idle', message: '' });
    };

    const saveSettings = () => {
        const saved = onSaveProfiles(workingProfiles);
        setWorkingProfiles(saved);
        setStatus({ type: 'success', message: 'Layout settings saved.' });
    };

    const resetSelectedTemplate = () => {
        setWorkingProfiles((prev) => ({
            ...prev,
            [selectedTemplate]: { ...DEFAULT_TEMPLATE_LAYOUTS[selectedTemplate] }
        }));
        setStatus({ type: 'success', message: `${selectedTemplate.replace('_', ' ')} reset to defaults.` });
    };

    const resetAll = () => {
        const defaults = {
            global: { ...DEFAULT_GLOBAL_LAYOUT },
            template_1: { ...DEFAULT_TEMPLATE_LAYOUTS.template_1 },
            template_2: { ...DEFAULT_TEMPLATE_LAYOUTS.template_2 },
            template_3: { ...DEFAULT_TEMPLATE_LAYOUTS.template_3 }
        };
        setWorkingProfiles(defaults);
        setStatus({ type: 'success', message: 'All layout settings reset to defaults.' });
    };

    return (
        <div className="container" style={{ maxWidth: '1240px', paddingTop: '40px', paddingBottom: '40px' }}>
            <div className="card" style={{ marginBottom: '16px' }}>
                <h1 style={{ marginBottom: '8px' }}>Label Layout Settings</h1>
                <p>Adjust spacing, font type/size, element size and positions for Template 1, Template 2, and Template 3. Logo is always used for all templates.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <div>
                    <div className="card" style={{ marginBottom: '16px' }}>
                        <h3 style={{ marginBottom: '12px' }}>Global Label Size (inches)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '12px' }}>
                            <NumericInput
                                label="Label Width"
                                value={workingProfiles.global.width_in}
                                step="0.01"
                                min="0.5"
                                max="8.5"
                                onChange={(value) => updateGlobal('width_in', value)}
                            />
                            <NumericInput
                                label="Total Height"
                                value={workingProfiles.global.total_height_in}
                                step="0.01"
                                min="0.5"
                                max="11"
                                onChange={(value) => updateGlobal('total_height_in', value)}
                            />
                            <NumericInput
                                label="Top Printable Height"
                                value={workingProfiles.global.top_printable_height_in}
                                step="0.01"
                                min="0.1"
                                max="2"
                                onChange={(value) => updateGlobal('top_printable_height_in', value)}
                                hint="Bottom portion remains blank/white."
                            />
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3>Template Element Settings</h3>
                            <select
                                className="input"
                                style={{ width: '280px' }}
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                            >
                                <option value="template_1">Template 1 (First Cell Type)</option>
                                <option value="template_2">Template 2 (Second Cell Type)</option>
                                <option value="template_3">Template 3 (Line1 + Barcode + Line3)</option>
                            </select>
                        </div>

                        <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Logo</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                            <NumericInput label="X (from left)" value={selectedLayout.logo_x_in} onChange={(v) => updateTemplate('logo_x_in', Number(v))} />
                            <NumericInput label="Top Margin" value={selectedLayout.logo_top_in} onChange={(v) => updateTemplate('logo_top_in', Number(v))} />
                            <NumericInput label="Width" value={selectedLayout.logo_width_in} onChange={(v) => updateTemplate('logo_width_in', Number(v))} />
                            <NumericInput
                                label="Height (0=auto)"
                                value={selectedLayout.logo_height_in}
                                onChange={(v) => updateTemplate('logo_height_in', Number(v))}
                            />
                        </div>

                        <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Line 1</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                            <FontSelect label="Font Type" value={selectedLayout.line1_font_name} onChange={(v) => updateTemplate('line1_font_name', v)} />
                            <NumericInput label="Font Size" value={selectedLayout.line1_font_size} onChange={(v) => updateTemplate('line1_font_size', Number(v))} />
                            <NumericInput label="Y Position" value={selectedLayout.line1_y_in} onChange={(v) => updateTemplate('line1_y_in', Number(v))} />
                        </div>

                        <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Line 2</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                            <FontSelect label="Font Type" value={selectedLayout.line2_font_name} onChange={(v) => updateTemplate('line2_font_name', v)} />
                            <NumericInput label="Font Size" value={selectedLayout.line2_font_size} onChange={(v) => updateTemplate('line2_font_size', Number(v))} />
                            <NumericInput label="Y Position" value={selectedLayout.line2_y_in} onChange={(v) => updateTemplate('line2_y_in', Number(v))} />
                        </div>

                        <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Barcode and Text Area</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: '12px' }}>
                            <NumericInput label="Text Max Width" value={selectedLayout.text_max_width_in} onChange={(v) => updateTemplate('text_max_width_in', Number(v))} />
                            <NumericInput label="Barcode Y Position" value={selectedLayout.barcode_y_in} onChange={(v) => updateTemplate('barcode_y_in', Number(v))} />
                            <NumericInput label="Barcode Height" value={selectedLayout.barcode_height_in} onChange={(v) => updateTemplate('barcode_height_in', Number(v))} />
                            <NumericInput label="Barcode Bar Width" value={selectedLayout.barcode_bar_width_in} step="0.001" onChange={(v) => updateTemplate('barcode_bar_width_in', Number(v))} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={saveSettings}>Save Layout Settings</button>
                        <button className="btn btn-secondary" onClick={resetSelectedTemplate}>Reset Selected Template</button>
                        <button className="btn btn-secondary" onClick={resetAll}>Reset All</button>
                        <button className="btn btn-secondary" onClick={onBackToPrint}>Back to Print Page</button>
                    </div>

                    {status.type !== 'idle' && (
                        <div className="status-badge status-success" style={{ marginTop: '12px' }}>
                            {status.message}
                        </div>
                    )}
                </div>

                <div>
                    <div className="card" style={{ position: 'sticky', top: '16px' }}>
                        <h3 style={{ marginBottom: '10px' }}>Live Sample Preview</h3>
                        <div style={{ display: 'grid', gap: '10px', marginBottom: '10px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 500 }}>Preview Server URL</label>
                            <input
                                className="input"
                                value={previewServerUrl}
                                onChange={(e) => setPreviewServerUrl(e.target.value)}
                                placeholder="http://localhost:5001"
                            />
                            <label style={{ fontSize: '13px', fontWeight: 500 }}>Sample QR Data</label>
                            <input
                                className="input"
                                value={sampleQrData}
                                onChange={(e) => setSampleQrData(e.target.value)}
                                placeholder="LINE1$LINE2"
                            />
                        </div>

                        <div className="flex" style={{ marginBottom: '10px', flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary" onClick={() => setPreviewNonce((prev) => prev + 1)}>
                                Refresh Preview
                            </button>
                        </div>

                        <iframe
                            title="Layout Preview"
                            src={`${previewUrl}#toolbar=0&zoom=page-width`}
                            style={{ width: '100%', minHeight: '500px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TemplateLayoutSettingsPage;
