'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Simplefin Bridge callback page
 *
 * User is redirected here after authenticating at the claim URL
 * The URL contains ?setup=SETUP_TOKEN that we exchange for a permanent access token
 */
export default function ConnectCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Connecting your bank...');

  useEffect(() => {
    const setupToken = searchParams.get('setup');

    if (!setupToken) {
      setError('No setup token found. Please try connecting your account again.');
      return;
    }

    exchangeToken(setupToken);
  }, [searchParams]);

  async function exchangeToken(setupToken: string) {
    try {
      setStatus('Verifying your account...');

      const response = await fetch('/api/finance/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_token: setupToken,
          institution_name: 'Bank Account',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to connect account');
      }

      setStatus('✓ Account connected successfully!');

      // Redirect to finance dashboard
      setTimeout(() => {
        router.push(data.redirectTo ?? '/finance/dashboard');
      }, 1000);
    } catch (err: any) {
      console.error('Exchange error:', err);
      setError(err.message ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 20,
        }}>
          🏦
        </div>

        {error ? (
          <>
            <h1 style={{ fontSize: 20, color: 'var(--color-ink)', marginBottom: 10 }}>
              Connection Failed
            </h1>
            <p style={{ color: 'var(--color-ink-3)', marginBottom: 20, lineHeight: 1.6 }}>
              {error}
            </p>
            <button
              onClick={() => window.location.href = '/finance/dashboard'}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-accent)',
                color: '#FFFDF8',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Back to Finance
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, color: 'var(--color-ink)', marginBottom: 10 }}>
              Connecting Your Bank
            </h1>
            <p style={{ color: 'var(--color-ink-2)', marginBottom: 30 }}>
              {status}
            </p>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '3px solid var(--color-rule)',
              borderTopColor: 'var(--color-accent)',
              margin: '0 auto',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  );
}
