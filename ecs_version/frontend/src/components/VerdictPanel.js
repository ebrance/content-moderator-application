import React from 'react';
import '../styles/VerdictPanel.css';

const VERDICT_CONFIG = {
  Approved: {
    className: 'verdict-approve',
    dotClass: 'dot-approve',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
      </svg>
    ),
  },
  Flagged: {
    className: 'verdict-flag',
    dotClass: 'dot-flag',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
    ),
  },
  Removed: {
    className: 'verdict-remove',
    dotClass: 'dot-remove',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
      </svg>
    ),
  },
};

const CATEGORY_STATUS_CONFIG = {
  detected: { className: 'cat-detected', label: 'Detected' },
  flagged:  { className: 'cat-flagged',  label: 'Flagged'  },
  clear:    { className: 'cat-clear',    label: 'Clear'    },
};

function VerdictPanel({ result, loading, contentType }) {
  if (loading) {
    return (
      <div className="verdict-loading">
        <div className="verdict-spinner" />
        <p>Super Agent is analyzing content…</p>
        <p className="verdict-loading-sub">Routing to appropriate utility agent</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="verdict-empty">
        <div className="verdict-empty-icon">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="24" cy="24" r="20"/>
            <path d="M16 24l6 6 10-12"/>
          </svg>
        </div>
        <p>No analysis yet</p>
        <p className="verdict-empty-sub">Enter content and click Analyze to get a verdict from the Super Agent.</p>
      </div>
    );
  }

  const config = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.Flagged;

  return (
    <div className="verdict-content">
      {/* Verdict badge */}
      <div className={`verdict-badge ${config.className}`}>
        {config.icon}
        {result.verdict}
      </div>

      {/* Meta info */}
      <div className="verdict-meta">
        <span>Routed to <strong>{result.agent_used}</strong></span>
        {result.processing_time_ms && (
          <span className="meta-sep">·</span>
        )}
        {result.processing_time_ms && (
          <span>{(result.processing_time_ms / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* Category breakdown */}
      {result.categories && result.categories.length > 0 && (
        <div className="verdict-categories">
          <p className="section-label">Violation categories checked</p>
          <div className="categories-list">
            {result.categories.map((cat, idx) => {
              const statusKey = cat.status?.toLowerCase();
              const statusCfg = CATEGORY_STATUS_CONFIG[statusKey] || CATEGORY_STATUS_CONFIG.clear;
              return (
                <div key={idx} className="category-row">
                  <span className="category-name">{cat.name}</span>
                  <span className={`category-badge ${statusCfg.className}`}>{statusCfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reasoning summary */}
      {result.reasoning && (
        <div className="verdict-reasoning">
          <p className="section-label">Analysis summary</p>
          <p className="reasoning-text">{result.reasoning}</p>
        </div>
      )}

      {/* Violations list */}
      {result.violations && result.violations.length > 0 && (
        <div className="verdict-violations">
          <p className="section-label">Specific violations found</p>
          <ul className="violations-list">
            {result.violations.map((v, idx) => (
              <li key={idx} className="violation-item">
                <span className="violation-dot" />
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default VerdictPanel;
