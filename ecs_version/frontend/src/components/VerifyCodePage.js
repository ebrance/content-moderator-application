import React, { useState } from 'react';
import { cognitoService } from '../services/cognitoService';
import '../styles/LoginPage.css';

function VerifyCodePage({ email, password, onVerifySuccess, onGoToLogin }) {
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!code.trim()) {
      setError('Please enter the verification code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      // Confirm the sign-up with the code
      await cognitoService.confirmSignUp(email, code.trim());
      // Auto sign-in immediately after verification
      const userData = await cognitoService.signIn(email, password);
      onVerifySuccess(userData);
    } catch (errMsg) {
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResent(false);
    try {
      await cognitoService.resendConfirmationCode(email);
      setResent(true);
    } catch (errMsg) {
      setError(errMsg);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>

        <h1 className="login-title">Check your email</h1>
        <p className="login-subtitle">
          We sent a verification code to <strong>{email}</strong>.
          Enter it below to confirm your account.
        </p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              disabled={loading}
              className="code-input"
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9h2V5H9v4zm0 4h2v-2H9v2z" clipRule="evenodd"/>
              </svg>
              {error}
            </div>
          )}

          {resent && (
            <div className="login-success" role="status">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              A new code has been sent to {email}.
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                Verifying…
              </span>
            ) : (
              'Verify email'
            )}
          </button>
        </form>

        <p className="login-switch">
          Didn't receive a code?{' '}
          <button className="link-btn" onClick={handleResend} disabled={loading}>
            Resend code
          </button>
        </p>

        <p className="login-switch" style={{ marginTop: '8px' }}>
          <button className="link-btn" onClick={onGoToLogin} disabled={loading}>
            ← Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export default VerifyCodePage;
