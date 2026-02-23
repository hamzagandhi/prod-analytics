import React, { useState } from 'react';
import { login, register } from '../api';
import { useAuth } from '../AuthContext';

export default function AuthPage() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', age: '', gender: 'Male' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const fn = mode === 'login' ? login : register;
      const { token, user } = await fn(form);
      signIn(token, user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon">[]</span>
          <span className="logo-text">Vigility</span>
        </div>

        <h1 className="auth-title">{mode === 'login' ? 'Sign in to Analytics' : 'Create Account'}</h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Track and visualize product interactions'
            : 'Start tracking your product analytics'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder="your_username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="********"
              required
            />
          </div>

          {mode === 'register' && (
            <>
              <div className="form-group">
                <label htmlFor="age">Age</label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  min="1"
                  max="120"
                  value={form.age}
                  onChange={handleChange}
                  placeholder="25"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-demo">
          <p>
            Demo credentials: <code>alice / password123</code>
          </p>
        </div>

        <div className="auth-switch">
          {mode === 'login' ? (
            <p>
              No account?{' '}
              <button type="button" onClick={() => { setMode('register'); setError(''); }}>
                Register
              </button>
            </p>
          ) : (
            <p>
              Have an account?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(''); }}>
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
