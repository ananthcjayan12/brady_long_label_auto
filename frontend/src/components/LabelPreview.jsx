import { Printer, XCircle } from 'lucide-react';

function LabelPreview({ mapping, previewUrl, onPrint, onCancel, isPrinting }) {
    if (!mapping) return null;

    return (
        <div className="card" style={{ marginTop: '20px', animation: 'fadeIn 0.3s ease' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '20px' }}>
                <h3>Label Preview</h3>
                <div className="status-badge status-success">Match Found</div>
            </div>

            <div className="grid">
                {/* Meta details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Barcode</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{mapping.barcode_text || 'N/A'}</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Document</div>
                        <div>{mapping.doc_name} (Page {mapping.page_num})</div>
                    </div>
                </div>

                {/* Image Preview */}
                <div style={{
                    background: '#ccc',
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    minHeight: '200px'
                }}>
                    {previewUrl ? (
                        <iframe
                            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                            title="Label Preview"
                            style={{
                                width: '100%',
                                height: '300px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                border: '1px solid #999',
                                background: 'white'
                            }}
                        />
                    ) : (
                        <div style={{ color: '#666' }}>Loading preview...</div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex" style={{ marginTop: '10px' }}>
                    <button
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '15px', fontSize: '1.1rem' }}
                        onClick={onPrint}
                        disabled={isPrinting}
                    >
                        <Printer size={24} />
                        {isPrinting ? 'Printing...' : 'Print Label'}
                    </button>

                    <button
                        className="btn btn-secondary"
                        style={{ padding: '0 20px' }}
                        onClick={onCancel}
                        disabled={isPrinting}
                    >
                        <XCircle size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LabelPreview;
