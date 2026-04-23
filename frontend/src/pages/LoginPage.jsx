import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Key, ArrowRight } from 'lucide-react';
import { api } from '../api';

function LoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [serverUrl, setServerUrl] = useState('http://10.142.190.195:5001');

    useEffect(() => {
        // If already logged in, redirect to home
        const session = sessionStorage.getItem('auth_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                navigate(parsed?.role === 'uploader' ? '/upload' : '/');
            } catch {
                navigate('/');
            }
        }

        const storedUrl = localStorage.getItem('api_url');
        if (storedUrl) setServerUrl(storedUrl);
    }, [navigate]);

    const handleSaveServerUrl = async () => {
        const url = serverUrl.replace(/\/$/, "");
        try {
            const res = await fetch(`${url}/health`);
            if (!res.ok) throw new Error('Server error');
            const data = await res.json();
            if (data.status !== 'ok') throw new Error('Invalid response');
            localStorage.setItem('api_url', url);
        } catch (err) {
            throw err;
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await handleSaveServerUrl();
            const result = await api.login(username, password);
            if (result.success) {
                sessionStorage.setItem('auth_session', JSON.stringify({
                    username: result.user.username,
                    role: result.user.role,
                    loginFullTime: new Date().toISOString()
                }));
                navigate(result.user.role === 'uploader' ? '/upload' : '/');
            } else {
                setError(result.error || 'Invalid username or password');
                setIsLoading(false);
            }
        } catch (err) {
            const serverError = err?.response?.data?.error;
            const localError = err?.message === 'Server error' ? 'Server error' : null;
            setError(serverError || localError || 'Unable to reach server. Please check the Server URL.');
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f6f9fc 0%, #eef2f6 100%)',
            padding: '20px'
        }}>
            <div className="card animate-in" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '40px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #635bff 0%, #a259ff 100%)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        color: 'white',
                        boxShadow: '0 10px 15px -3px rgba(99, 91, 255, 0.3)'
                    }}>
                        <Lock size={32} />
                    </div>
                    <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Please sign in to continue</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                            Server URL
                        </label>
                        <input
                            type="text"
                            className="input"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="http://localhost:5001"
                            style={{ height: '44px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                            Username
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#9ca3af'
                            }}>
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                className="input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                style={{ paddingLeft: '40px', height: '44px' }}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#9ca3af'
                            }}>
                                <Key size={18} />
                            </div>
                            <input
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                style={{ paddingLeft: '40px', height: '44px' }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="status-error" style={{
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            marginBottom: '24px',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', height: '44px', fontSize: '15px' }}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="spinner" style={{ width: '20px', height: '20px', margin: 0, borderWidth: '2px', borderTopColor: 'white', borderRightColor: 'rgba(255,255,255,0.4)', borderBottomColor: 'rgba(255,255,255,0.4)', borderLeftColor: 'rgba(255,255,255,0.4)' }} />
                        ) : (
                            <>
                                Sign In <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                            </>
                        )}
                    </button>

                    <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Default credentials: <strong>admin / admin</strong>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default LoginPage;
