import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function UploadPage() {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState(null);
    const [results, setResults] = useState([]);

    const handleFilesSelected = (fileList) => {
        const selectedFiles = Array.from(fileList || []).filter(
            (selectedFile) => selectedFile.name.toLowerCase().endsWith('.pdf')
        );

        if (selectedFiles.length > 0) {
            setFiles(selectedFiles);
            setStatus('idle');
            setMessage('');
            setStats(null);
            setResults([]);
        }
    };

    const handleFileChange = (e) => {
        handleFilesSelected(e.target.files);
    };

    const handleUpload = async () => {
        if (!files.length) return;

        setStatus('uploading');
        setMessage('');
        setStats(null);
        setResults([]);

        let uploadedCount = 0;
        let duplicateCount = 0;
        let failedCount = 0;
        let totalPages = 0;
        let totalBarcodes = 0;
        const uploadResults = [];

        try {
            for (const file of files) {
                try {
                    const result = await api.uploadFile(file);

                    if (result.success) {
                        uploadedCount += 1;
                        if (result.is_duplicate) {
                            duplicateCount += 1;
                        }
                        totalPages += result.stats?.pages || 0;
                        totalBarcodes += result.stats?.barcodes || 0;

                        uploadResults.push({
                            name: file.name,
                            success: true,
                            duplicate: !!result.is_duplicate,
                            pages: result.stats?.pages || 0,
                            barcodes: result.stats?.barcodes || 0,
                            message: result.message || ''
                        });
                    } else {
                        failedCount += 1;
                        uploadResults.push({
                            name: file.name,
                            success: false,
                            duplicate: false,
                            pages: 0,
                            barcodes: 0,
                            message: result.error || 'Upload failed'
                        });
                    }
                } catch (err) {
                    failedCount += 1;
                    uploadResults.push({
                        name: file.name,
                        success: false,
                        duplicate: false,
                        pages: 0,
                        barcodes: 0,
                        message: err.message || 'Upload failed'
                    });
                }
            }

            if (uploadedCount > 0) {
                setStatus('success');
                setMessage(
                    failedCount > 0
                        ? `${uploadedCount}/${files.length} files processed successfully (${failedCount} failed).`
                        : `${uploadedCount} file${uploadedCount > 1 ? 's' : ''} uploaded and processed successfully!`
                );
                setStats({
                    uploaded: uploadedCount,
                    duplicates: duplicateCount,
                    failed: failedCount,
                    total: files.length,
                    pages: totalPages,
                    barcodes: totalBarcodes
                });
                navigate('/dashboard', { replace: true });
            } else {
                setStatus('error');
                setMessage('All selected files failed to upload.');
                setStats({
                    uploaded: 0,
                    duplicates: 0,
                    failed: failedCount,
                    total: files.length,
                    pages: 0,
                    barcodes: 0
                });
            }

            setResults(uploadResults);
        } catch {
            setStatus('error');
            setMessage('Upload failed');
        }
    };

    return (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div className="text-center" style={{ marginBottom: '40px' }}>
                <h1 style={{ marginBottom: '12px' }}>Upload Document</h1>
                <p>Upload a PDF containing multiple labels. We'll automatically detect barcodes.</p>
            </div>

            <div className="card">
                <div
                    style={{
                        border: '2px dashed var(--border)',
                        borderRadius: '12px',
                        padding: '60px 40px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: files.length > 0 ? 'rgba(99,91,255,0.02)' : 'transparent',
                        borderColor: files.length > 0 ? 'var(--primary)' : 'var(--border)',
                        transition: 'all 0.2s ease'
                    }}
                    onClick={() => document.getElementById('pdf-upload').click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(99,91,255,0.02)';
                    }}
                    onDragLeave={(e) => {
                        if (files.length === 0) {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.background = 'transparent';
                        }
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            handleFilesSelected(e.dataTransfer.files);
                        }
                    }}
                >
                    <input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />

                    <div className="flex flex-col items-center" style={{ gap: '16px' }}>
                        <div style={{
                            background: 'white',
                            padding: '16px',
                            borderRadius: '50%',
                            boxShadow: 'var(--shadow-md)',
                            color: 'var(--primary)'
                        }}>
                            <Upload size={32} />
                        </div>

                        {files.length > 0 ? (
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
                                    {files.length} PDF{files.length > 1 ? 's' : ''} selected
                                </div>
                                <div className="text-muted">
                                    {(files.reduce((sum, selectedFile) => sum + selectedFile.size, 0) / 1024 / 1024).toFixed(2)} MB • Ready to process
                                </div>
                                <div style={{ marginTop: '10px', maxHeight: '96px', overflowY: 'auto', textAlign: 'left' }}>
                                    {files.slice(0, 5).map((selectedFile) => (
                                        <div key={selectedFile.name} className="text-muted" style={{ fontSize: '12px', marginBottom: '4px' }}>
                                            <FileText size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                            {selectedFile.name}
                                        </div>
                                    ))}
                                    {files.length > 5 && (
                                        <div className="text-muted" style={{ fontSize: '12px' }}>+ {files.length - 5} more file(s)</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>Click to upload PDF(s)</div>
                                <div className="text-muted" style={{ fontSize: '14px' }}>or drag and drop one or multiple PDFs here</div>
                            </div>
                        )}
                    </div>
                </div>

                {files.length > 0 && status !== 'success' && (
                    <div style={{ marginTop: '24px' }}>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', height: '48px', fontSize: '15px' }}
                            onClick={handleUpload}
                            disabled={status === 'uploading'}
                        >
                            {status === 'uploading' ? (
                                <span className="flex items-center">Processing...</span>
                            ) : `Start Processing (${files.length})`}
                        </button>
                    </div>
                )}

                {status === 'success' && (
                    <div style={{ marginTop: '32px', textAlign: 'center' }} className="animate-in">
                        <div className="status-badge status-success" style={{ padding: '8px 16px', fontSize: '14px', marginBottom: '24px' }}>
                            <CheckCircle size={16} />
                            <span style={{ marginLeft: '8px' }}>Upload Complete</span>
                        </div>

                        <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>{message}</p>

                        {stats && (
                            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{stats.uploaded}</div>
                                    <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Files Uploaded</div>
                                </div>
                                <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{stats.pages}</div>
                                    <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Pages Processed</div>
                                </div>
                                <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--primary)' }}>{stats.barcodes}</div>
                                    <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Barcodes Found</div>
                                </div>
                                <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: '700', color: stats.failed > 0 ? 'var(--error)' : 'var(--text-main)' }}>
                                        {stats.failed}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase' }}>Failed Uploads</div>
                                </div>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div style={{ textAlign: 'left', marginBottom: '16px', maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                                {results.map((result, idx) => (
                                    <div key={`${result.name}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: idx < results.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{result.name}</span>
                                        <span style={{ fontSize: '12px', color: result.success ? 'var(--success)' : 'var(--error)' }}>
                                            {result.success ? (result.duplicate ? 'Duplicate' : 'Uploaded') : 'Failed'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ marginTop: '24px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setFiles([]); setStatus('idle'); setStats(null); setResults([]); setMessage(''); }}
                            >
                                Upload Another
                            </button>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div style={{ marginTop: '24px', textAlign: 'center' }} className="animate-in">
                        <div className="status-badge status-error" style={{ padding: '8px 16px' }}>
                            <AlertCircle size={16} />
                            <span style={{ marginLeft: '8px' }}>{message}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UploadPage;
