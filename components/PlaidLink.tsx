'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink, type PlaidLinkOnSuccess } from 'react-plaid-link';

export function PlaidLink({
  onConnected,
  label = 'Connect a bank',
  variant = 'primary',
}: {
  onConnected?: () => void;
  label?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/finance/plaid/link-token', { method: 'POST' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'unknown');
        return d;
      })
      .then((d) => setLinkToken(d.link_token))
      .catch((e) => {
        console.error('link token fetch failed', e);
        setError(e.message);
      });
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token, metadata) => {
      setLoading(true);
      try {
        const res = await fetch('/api/finance/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token, institution: metadata.institution }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? 'exchange failed');
        }
        onConnected?.();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [onConnected]
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });
  const disabled = !ready || !linkToken || loading;

  const primaryStyle: React.CSSProperties = {
    padding: '11px 22px',
    borderRadius: 8,
    border: '1px solid var(--color-bronze-dark)',
    background: 'var(--color-bronze)',
    color: '#FBF8F1',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
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
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <button
        onClick={() => open()}
        disabled={disabled}
        style={variant === 'primary' ? primaryStyle : secondaryStyle}
      >
        {loading ? 'Connecting…' : !ready && !error ? 'Loading…' : label}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--color-red)' }}>
          Failed to load Plaid: {error}
        </span>
      )}
    </div>
  );
}
