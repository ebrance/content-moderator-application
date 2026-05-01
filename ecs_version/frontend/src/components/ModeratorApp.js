import React, { useState } from 'react';
import { apiService } from '../services/apiService';
import VerdictPanel from './VerdictPanel';
import '../styles/ModeratorApp.css';

const CONTENT_TYPES = [
  { value: 'general_community', label: 'General community' },
  { value: 'kids_platform',     label: 'Kids platform' },
  { value: 'marketplace',       label: 'Marketplace' },
  { value: 'news_comments',     label: 'News comments' },
];

function ModeratorApp({ user, onLogout }) {
  const [contentType, setContentType] = useState('general_community');
  const [content, setContent]         = useState('');
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const isAnalyzeEnabled = content.trim().length > 0 && !loading;

  const handleAnalyze = async () => {
    if (!isAnalyzeEnabled) return;
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const data = await apiService.analyzeContent(content.trim(), contentType);
      setResult(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setContent('');
    setResult(null);
    setError('');
  };

  return (
    <div className="mod-app">
      {/* Header */}
      <header className="mod-header">
        <div className="mod-header-left">
          <div className="mod-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="mod-header-title">Content Moderator</span>
          <span className="mod-header-badge">Super Agent</span>
        </div>
        <div className="mod-header-right">
          <span className="mod-user-pill">{user.email}</span>
          <button className="mod-logout-btn" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      {/* Main layout */}
      <main className="mod-main">
        {/* Left panel — Input */}
        <section className="mod-panel mod-input-panel">
          <h2 className="panel-heading">Content input</h2>

          <div className="form-field">
            <label className="field-label" htmlFor="content-type">Content type</label>
            <select
              id="content-type"
              value={contentType}
              onChange={(e) => { setContentType(e.target.value); setResult(null); setError(''); }}
              disabled={loading}
            >
              {CONTENT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor="content-input">
              Content to analyze
              <span className="char-count">{content.length} chars</span>
            </label>
            <textarea
              id="content-input"
              placeholder="Paste or type the content you want to analyze…"
              value={content}
              onChange={(e) => { setContent(e.target.value); setResult(null); setError(''); }}
              disabled={loading}
              rows={10}
            />
          </div>

          {error && (
            <div className="input-error" role="alert">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9h2V5H9v4zm0 4h2v-2H9v2z" clipRule="evenodd"/>
              </svg>
              {error}
            </div>
          )}

          <div className="input-actions">
            {(content || result) && (
              <button className="btn btn-ghost" onClick={handleClear} disabled={loading}>
                Clear
              </button>
            )}
            <button
              className={`btn btn-primary ${!isAnalyzeEnabled ? 'btn-disabled' : ''}`}
              onClick={handleAnalyze}
              disabled={!isAnalyzeEnabled}
              aria-disabled={!isAnalyzeEnabled}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="btn-spinner" />
                  Analyzing…
                </span>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z"/>
                    <path fillRule="evenodd" d="M10 3a7 7 0 100 14A7 7 0 0010 3zm-9 7a9 9 0 1118 0A9 9 0 011 10z" clipRule="evenodd"/>
                  </svg>
                  Analyze
                </>
              )}
            </button>
          </div>
        </section>

        {/* Right panel — Results */}
        <section className="mod-panel mod-result-panel">
          <h2 className="panel-heading">Agent verdict</h2>
          <VerdictPanel result={result} loading={loading} contentType={contentType} />
        </section>
      </main>
    </div>
  );
}

export default ModeratorApp;
