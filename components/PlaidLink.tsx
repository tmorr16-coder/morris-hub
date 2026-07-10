'use client';

import { useEffect, useState } from 'react';

/**
 * Simplefin Bridge connect button
 *
 * Redirects user to Simplefin claim URL where they authenticate with their bank.
 * No embedded modal — user visits simplefin.org, then returns via callback.
 */
export function PlaidLink({
  onConnected,
  label = 'Connect a bank',
  variant = 'primary',
}: {
  onConnected?: () => void;
  label?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      // Get claim URL from backend
      const res = await fetch('/api/finance/plaid/link-token', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create claim URL');
      }

      // Redirect to Simplefin — user authenticates, then is redirected back to /finance/connect/callback
      window.location.href = data.claim_url;
    } catch (e) {
      console.error('Connect error:', e);
      setError((e as Error).message);
      setLoading(false);
    }
  }

  const primaryStyle: React.CSSProperties = {
    padding: '11px 22px',
    borderRadius: 8,
    border: '1px solid var(--color-bronze-dark)',
    background: 'var(--color-bronze)',
    color: '#FBF8F1',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: loading ? 'wait' : 'pointer',
    opacity: loading ? 0.7 : 1,
    boxShadow: 'var(--shadow-card)',
    transition: 'opacity 120ms',
  };

  const secondaryStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid var(--color-rule)',
    background: 'var(--color-paper-card)',
    color: 'var(--color-ink-2)',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: loading ? 'wait' : 'pointer',
    opacity: loading ? 0.7 : 1,
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <button
        onClick={handleConnect}
        disabled={loading}
        style={variant === 'primary' ? primaryStyle : secondaryStyle}
      >
        {loading ? 'Redirecting…' : label}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--color-red)' }}>
          {error}
        </span>
      )}
    </div>
  );
}
