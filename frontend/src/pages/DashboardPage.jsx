import { useState, useEffect } from 'react';
import { Trash2, FileText, Calendar, Barcode, Printer, Clock, CheckCircle, XCircle, Files, AlertCircle, User, Key, Download, UserPlus, Shield, Lock } from 'lucide-react';
import { api } from '../api';

function DashboardPage() {
    const [activeTab, setActiveTab] = useState('documents'); // 'documents', 'history', or 'users'
    const [documents, setDocuments] = useState([]);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [stats, setStats] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [uploadDateFrom, setUploadDateFrom] = useState('');
    const [uploadDateTo, setUploadDateTo] = useState('');

    // User Management State
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
    const [changePassword, setChangePassword] = useState({ current: '', new: '', confirm: '' });
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadStats();
        loadCurrentUser();
    }, []);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadStats = async () => {
        try {
            const data = await api.getStats();
            if (data.success) setStats(data.stats);
        } catch (error) {
            console.error('Failed to load stats', error);
        }
    };

    const loadCurrentUser = () => {
        const session = sessionStorage.getItem('auth_session');
        if (session) {
            setCurrentUser(JSON.parse(session));
        }
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'documents') {
                const data = await api.getDocuments();
                if (data.success) setDocuments(data.documents);
            } else if (activeTab === 'history') {
                const data = await api.getPrintHistory();
                if (data.success) setHistory(data.history);
            } else if (activeTab === 'users') {
                await loadUsers();
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- User Management Logic ---

    const loadUsers = async () => {
        try {
            const result = await api.getUsers();
            if (result.success) {
                setUsers(result.users || []);
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to load users' });
            }
        } catch (error) {
            console.error('Failed to load users', error);
            setMessage({ type: 'error', text: 'Failed to load users' });
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password) {
            setMessage({ type: 'error', text: 'Username and password are required' });
            return;
        }
        try {
            const result = await api.addUser(newUser.username, newUser.password, newUser.role);
            if (result.success) {
                setUsers(result.users || []);
                setNewUser({ username: '', password: '', role: 'user' });
                setMessage({ type: 'success', text: 'User added successfully' });
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to add user' });
            }
        } catch (error) {
            console.error('Failed to add user', error);
            setMessage({ type: 'error', text: 'Failed to add user' });
        }
    };

    const handleDeleteUser = async (username) => {
        if (username === currentUser.username) {
            alert("You cannot delete yourself.");
            return;
        }
        if (confirm(`Are you sure you want to delete user "${username}"?`)) {
            try {
                const result = await api.deleteUser(username);
                if (result.success) {
                    setUsers(result.users || []);
                } else {
                    setMessage({ type: 'error', text: result.error || 'Failed to delete user' });
                }
            } catch (error) {
                console.error('Failed to delete user', error);
                setMessage({ type: 'error', text: 'Failed to delete user' });
            }
        }
    };

    const handleResetPassword = async (username) => {
        const newPass = prompt(`Enter new password for ${username}:`);
        if (newPass) {
            try {
                const result = await api.resetUserPassword(username, newPass);
                if (result.success) {
                    setMessage({ type: 'success', text: `Password for ${username} reset successfully` });
                    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
                } else {
                    setMessage({ type: 'error', text: result.error || 'Failed to reset password' });
                }
            } catch (error) {
                console.error('Failed to reset password', error);
                setMessage({ type: 'error', text: 'Failed to reset password' });
            }
        }
    };

    const handleChangeOwnPassword = async (e) => {
        e.preventDefault();
        if (changePassword.new !== changePassword.confirm) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }
        try {
            const result = await api.changeUserPassword(currentUser.username, changePassword.current, changePassword.new);
            if (result.success) {
                setChangePassword({ current: '', new: '', confirm: '' });
                setMessage({ type: 'success', text: 'Password changed successfully' });
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to change password' });
            }
        } catch (error) {
            console.error('Failed to change password', error);
            setMessage({ type: 'error', text: 'Failed to change password' });
        }
    };

    // --- Document Logic ---

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this document?')) {
            try {
                await api.deleteDocument(id);
                loadData();
                loadStats();
                if (selectedDoc?.document.id === id) setSelectedDoc(null);
            } catch (error) {
                alert('Failed to delete');
            }
        }
    };

    const handleRowClick = async (docId) => {
        try {
            const data = await api.getDocumentPrintStats(docId);
            if (data.success) setSelectedDoc(data.stats);
        } catch (error) {
            console.error("Failed to load details", error);
        }
    };

    const getRoleBadge = (role) => {
        const style = role === 'admin'
            ? { background: '#e0e7ff', color: '#4338ca' }
            : { background: '#f3f4f6', color: '#4b5563' };

        return (
            <span style={{
                ...style,
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase'
            }}>
                {role}
            </span>
        );
    };

    const filteredDocuments = documents.filter((doc) => {
        const nameMatches = doc.name?.toLowerCase().includes(searchTerm.trim().toLowerCase());

        const uploadedDate = doc.uploaded_at ? new Date(doc.uploaded_at) : null;
        const hasValidUploadDate = uploadedDate && !Number.isNaN(uploadedDate.getTime());

        const fromDate = uploadDateFrom ? new Date(`${uploadDateFrom}T00:00:00`) : null;
        const toDate = uploadDateTo ? new Date(`${uploadDateTo}T23:59:59`) : null;

        const fromMatches = !fromDate || (hasValidUploadDate && uploadedDate >= fromDate);
        const toMatches = !toDate || (hasValidUploadDate && uploadedDate <= toDate);

        return nameMatches && fromMatches && toMatches;
    });

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Stats Cards Section */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                marginBottom: '32px'
            }}>
                <div className="card" style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #635bff 0%, #8b7aff 100%)',
                    color: 'white',
                    border: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <Files size={22} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total PDFs</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats?.total_documents ?? '-'}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                        {stats?.total_pages ?? 0} pages total
                    </div>
                </div>

                <div className="card" style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                    color: 'white',
                    border: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <CheckCircle size={22} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prints Done</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats?.total_prints ?? '-'}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                        {stats?.total_barcodes ?? 0} barcodes found
                    </div>
                </div>

                <div className="card" style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                    color: 'white',
                    border: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <Clock size={22} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats?.pending_prints ?? '-'}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                        awaiting print
                    </div>
                </div>

                <div className="card" style={{
                    padding: '20px',
                    background: stats?.failed_prints > 0
                        ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                        : 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
                    color: 'white',
                    border: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <AlertCircle size={22} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats?.failed_prints ?? 0}</div>
                    <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
                        print failures
                    </div>
                </div>
            </div>

            {/* Header Section */}
            <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
                <div>
                    <h1>Dashboard</h1>
                    <p>Manage your documents, view print history, and configure users.</p>
                </div>

                {/* Tab Navigation */}
                <div style={{
                    background: 'rgba(0,0,0,0.04)',
                    padding: '4px',
                    borderRadius: '8px',
                    display: 'inline-flex'
                }}>
                    <button
                        onClick={() => setActiveTab('documents')}
                        style={{
                            padding: '6px 16px',
                            background: activeTab === 'documents' ? 'white' : 'transparent',
                            borderRadius: '6px',
                            boxShadow: activeTab === 'documents' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            border: 'none',
                            fontWeight: 500,
                            color: activeTab === 'documents' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Documents
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        style={{
                            padding: '6px 16px',
                            background: activeTab === 'history' ? 'white' : 'transparent',
                            borderRadius: '6px',
                            boxShadow: activeTab === 'history' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            border: 'none',
                            fontWeight: 500,
                            color: activeTab === 'history' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Print History
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        style={{
                            padding: '6px 16px',
                            background: activeTab === 'users' ? 'white' : 'transparent',
                            borderRadius: '6px',
                            boxShadow: activeTab === 'users' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            border: 'none',
                            fontWeight: 500,
                            color: activeTab === 'users' ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Users
                    </button>
                </div>
            </div>

            {/* Users Tab - Admin & Standard Logic */}
            {activeTab === 'users' && (
                <div className="grid" style={{ gridTemplateColumns: currentUser?.role === 'admin' ? '1fr 1fr' : '1fr', gap: '24px' }}>

                    {/* Admin: User List */}
                    {currentUser?.role === 'admin' && (
                        <div className="card">
                            <h3 style={{ marginBottom: '20px' }}>Managed Users</h3>
                            <table style={{ margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Role</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 500 }}>
                                                <div className="flex items-center">
                                                    <User size={14} style={{ marginRight: '8px', opacity: 0.6 }} />
                                                    {user.username}
                                                    {user.username === currentUser.username && (
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(You)</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{getRoleBadge(user.role)}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ padding: '4px 8px', fontSize: '11px', marginRight: '6px' }}
                                                    onClick={() => handleResetPassword(user.username)}
                                                >
                                                    Reset Pass
                                                </button>
                                                {user.username !== currentUser.username && (
                                                    <button
                                                        className="btn"
                                                        style={{ color: 'var(--error)', padding: '4px' }}
                                                        onClick={() => handleDeleteUser(user.username)}
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Right Column: Profile or Add User */}
                    <div>
                        {/* Status Message */}
                        {message.text && (
                            <div className={`status-${message.type}`} style={{ padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                                {message.text}
                            </div>
                        )}

                        {/* Admin: Add New User Form */}
                        {currentUser?.role === 'admin' && (
                            <div className="card" style={{ marginBottom: '24px' }}>
                                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                                    <div style={{ background: 'rgba(99, 91, 255, 0.1)', padding: '8px', borderRadius: '8px', marginRight: '12px', color: 'var(--primary)' }}>
                                        <UserPlus size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '16px', margin: 0 }}>Create New User</h3>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Add authorized operators</div>
                                    </div>
                                </div>
                                <form onSubmit={handleAddUser}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label className="label">Username</label>
                                        <input type="text" className="input" style={{ width: '100%' }}
                                            value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label className="label">Password</label>
                                        <input type="password" className="input" style={{ width: '100%' }}
                                            value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                    </div>
                                    <div style={{ marginBottom: '20px' }}>
                                        <label className="label">Role</label>
                                        <select className="input" style={{ width: '100%' }}
                                            value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                            <option value="user">User (Scan & Print + Upload + Dashboard)</option>
                                            <option value="printer">Printer (Scan & Print only)</option>
                                            <option value="uploader">Uploader (Upload PDF only)</option>
                                            <option value="admin">Admin (Full Access)</option>
                                        </select>
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create User</button>
                                </form>
                            </div>
                        )}

                        {/* Change Password Form (Visible to All) */}
                        <div className="card">
                            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px', marginRight: '12px', color: '#10b981' }}>
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', margin: 0 }}>Security</h3>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Change your password</div>
                                </div>
                            </div>
                            <form onSubmit={handleChangeOwnPassword}>
                                <div style={{ marginBottom: '12px' }}>
                                    <label className="label">Current Password</label>
                                    <input type="password" className="input" style={{ width: '100%' }}
                                        value={changePassword.current} onChange={e => setChangePassword({ ...changePassword, current: e.target.value })} />
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <label className="label">New Password</label>
                                    <input type="password" className="input" style={{ width: '100%' }}
                                        value={changePassword.new} onChange={e => setChangePassword({ ...changePassword, new: e.target.value })} />
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label className="label">Confirm New Password</label>
                                    <input type="password" className="input" style={{ width: '100%' }}
                                        value={changePassword.confirm} onChange={e => setChangePassword({ ...changePassword, confirm: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>Update Password</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Documents and History Content */}
            {activeTab !== 'users' && (
                <div className="grid" style={{ gridTemplateColumns: selectedDoc ? '1fr 380px' : '1fr', transition: 'grid-template-columns 0.3s ease' }}>

                    {/* Main Content Card */}
                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                        {isLoading ? (
                            <div className="text-center" style={{ padding: '60px' }}>
                                <div className="spinner"></div>
                                <p>Loading data...</p>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'history' && (
                                    <div className="flex items-center justify-between" style={{ padding: '20px 24px 0', marginBottom: '16px' }}>
                                        <h3 style={{ margin: 0 }}>Print Job History</h3>
                                        <button
                                            onClick={() => api.downloadReport()}
                                            className="btn btn-secondary"
                                            title="Download as CSV"
                                        >
                                            <Download size={16} style={{ marginRight: '8px' }} />
                                            Download Report
                                        </button>
                                    </div>
                                )}

                                {activeTab === 'documents' && (
                                    <div style={{ padding: '20px 24px 0', marginBottom: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '10px' }}>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="Search uploads by file name"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                            <input
                                                type="date"
                                                className="input"
                                                value={uploadDateFrom}
                                                onChange={(e) => setUploadDateFrom(e.target.value)}
                                                title="Uploaded from"
                                            />
                                            <input
                                                type="date"
                                                className="input"
                                                value={uploadDateTo}
                                                onChange={(e) => setUploadDateTo(e.target.value)}
                                                title="Uploaded to"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ margin: 0 }}>
                                        <thead style={{ background: '#fcfcfd', borderBottom: '1px solid var(--divide)' }}>
                                            {activeTab === 'documents' ? (
                                                <tr>
                                                    <th style={{ paddingLeft: '24px' }}>Name</th>
                                                    <th>Date Uploaded</th>
                                                    <th className="text-center">Pages</th>
                                                    <th>Status</th>
                                                    <th style={{ paddingRight: '24px', textAlign: 'right' }}>Actions</th>
                                                </tr>
                                            ) : (
                                                <tr>
                                                    <th style={{ paddingLeft: '24px' }}>Time</th>
                                                    <th>Document</th>
                                                    <th>Barcode/Page</th>
                                                    <th>User</th>
                                                    <th>Printer</th>
                                                    <th style={{ paddingRight: '24px' }}>Status</th>
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody>
                                            {activeTab === 'documents' ? (
                                                filteredDocuments.map(doc => (
                                                    <tr
                                                        key={doc.id}
                                                        onClick={() => handleRowClick(doc.id)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            background: selectedDoc?.document.id === doc.id ? 'rgba(99,91,255,0.03)' : 'transparent',
                                                            borderLeft: selectedDoc?.document.id === doc.id ? '3px solid var(--primary)' : '3px solid transparent'
                                                        }}
                                                    >
                                                        <td style={{ paddingLeft: '21px' }}> {/* Compensate for border */}
                                                            <div className="flex items-center">
                                                                <div style={{
                                                                    background: 'rgba(99,91,255,0.1)',
                                                                    padding: '8px',
                                                                    borderRadius: '6px',
                                                                    marginRight: '12px'
                                                                }}>
                                                                    <FileText size={18} color="var(--primary)" />
                                                                </div>
                                                                <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{doc.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="text-muted" style={{ fontSize: '13px' }}>
                                                            {new Date(doc.uploaded_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="text-center" style={{ fontFamily: 'monospaced' }}>{doc.pages}</td>
                                                        <td>
                                                            <span className="status-badge" style={{ background: '#e3f2fd', color: '#0d47a1' }}>
                                                                {doc.barcodes_found} Barcodes
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                                                            <button
                                                                className="btn"
                                                                style={{
                                                                    color: 'var(--text-secondary)',
                                                                    padding: '6px',
                                                                    height: 'auto',
                                                                    background: 'transparent',
                                                                    boxShadow: 'none'
                                                                }}
                                                                onClick={(e) => handleDelete(e, doc.id)}
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                history.map((job) => (
                                                    <tr key={job.id}>
                                                        <td style={{ paddingLeft: '24px' }}>
                                                            <div className="flex items-center text-muted">
                                                                <Clock size={14} style={{ marginRight: '6px' }} />
                                                                {new Date(job.timestamp).toLocaleString()}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center">
                                                                <FileText size={16} color="var(--primary)" style={{ marginRight: '8px' }} />
                                                                <span style={{ fontWeight: 500 }}>
                                                                    {job.doc_name || 'Unknown'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center" style={{ fontFamily: 'monospace' }}>
                                                                <Barcode size={16} style={{ marginRight: '8px', opacity: 0.5 }} />
                                                                <span className="status-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                                                    Page {job.page_num}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center">
                                                                <User size={14} style={{ marginRight: '6px', opacity: 0.5 }} />
                                                                {job.username || 'Unknown'}
                                                            </div>
                                                        </td>
                                                        <td>{job.printer}</td>
                                                        <td style={{ paddingRight: '24px' }}>
                                                            {job.status === 'success' ? (
                                                                <span className="status-badge status-success">
                                                                    <CheckCircle size={12} /> Success
                                                                </span>
                                                            ) : (
                                                                <div className="flex items-center" title={job.error}>
                                                                    <span className="status-badge status-error">
                                                                        <XCircle size={12} /> Failed
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                            {((activeTab === 'documents' && filteredDocuments.length === 0) || (activeTab === 'history' && history.length === 0)) && (
                                                <tr>
                                                    <td colSpan="6" className="text-center" style={{ padding: '60px' }}>
                                                        <div style={{ color: 'var(--text-secondary)' }}>No items found.</div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right Column: Details Drawer */}
                    {activeTab === 'documents' && selectedDoc && (
                        <div className="card animate-in" style={{ height: 'calc(100vh - 140px)', position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column' }}>
                            <div className="flex justify-between items-start" style={{ marginBottom: '20px', borderBottom: '1px solid var(--divider)', paddingBottom: '20px' }}>
                                <div>
                                    <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Document Details</h3>
                                    <div style={{ fontWeight: 600, fontSize: '16px' }}>{selectedDoc.document.name}</div>
                                </div>
                                <button
                                    className="btn"
                                    onClick={() => setSelectedDoc(null)}
                                    style={{ padding: '4px', background: 'transparent', boxShadow: 'none' }}
                                >
                                    <XCircle size={20} color="var(--text-secondary)" />
                                </button>
                            </div>

                            {/* Print Stats Summary */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                                marginBottom: '20px'
                            }}>
                                <div style={{
                                    padding: '12px',
                                    background: '#f0fdf4',
                                    borderRadius: '8px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>
                                        {selectedDoc.printed_count}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#15803d', textTransform: 'uppercase' }}>
                                        Printed
                                    </div>
                                </div>
                                <div style={{
                                    padding: '12px',
                                    background: '#fef3c7',
                                    borderRadius: '8px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706' }}>
                                        {selectedDoc.pending_count}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#b45309', textTransform: 'uppercase' }}>
                                        Pending
                                    </div>
                                </div>
                            </div>

                            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={14} color="var(--text-secondary)" />
                                    <span className="text-muted" style={{ fontSize: '13px' }}>
                                        Uploaded on {new Date(selectedDoc.document.uploaded_at).toLocaleDateString()}
                                    </span>
                                </div>

                                <h4 style={{ fontSize: '13px', margin: '24px 0 12px', color: 'var(--text-secondary)' }}>DETECTED BARCODES</h4>

                                {selectedDoc.mappings.length === 0 ? (
                                    <div className="text-center text-muted" style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
                                        No barcodes found.
                                    </div>
                                ) : (
                                    <div className="flex-col" style={{ gap: '12px' }}>
                                        {selectedDoc.mappings.map((mapping, idx) => {
                                            const printCount = selectedDoc.page_print_counts[mapping.page_num] || 0;
                                            const isPrinted = printCount > 0;

                                            return (
                                                <div key={idx} style={{
                                                    padding: '12px',
                                                    border: `1px solid ${isPrinted ? '#86efac' : 'var(--border)'}`,
                                                    borderRadius: '8px',
                                                    background: isPrinted ? '#f0fdf4' : 'white',
                                                    transition: 'border-color 0.2s'
                                                }} className="hover:border-primary">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-start" style={{ gap: '10px' }}>
                                                            <Barcode size={18} color={isPrinted ? '#16a34a' : 'var(--primary)'} style={{ marginTop: '2px' }} />
                                                            <div>
                                                                <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                                                                    {mapping.barcode}
                                                                </div>
                                                                <div className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                                                                    {mapping.type}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: 600, background: '#e0e0e0', padding: '2px 6px', borderRadius: '4px' }}>
                                                                PG {mapping.page_num}
                                                            </span>
                                                            {isPrinted && (
                                                                <span style={{
                                                                    fontSize: '10px',
                                                                    fontWeight: 500,
                                                                    background: '#dcfce7',
                                                                    color: '#166534',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px'
                                                                }}>
                                                                    <CheckCircle size={10} />
                                                                    {printCount}x printed
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ marginTop: '12px' }}>
                                                        <a
                                                            href={api.getPreviewUrl(selectedDoc.document.id, mapping.page_num)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="btn btn-secondary"
                                                            style={{ width: '100%', height: '32px', fontSize: '13px' }}
                                                        >
                                                            View Label
                                                        </a>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DashboardPage;
