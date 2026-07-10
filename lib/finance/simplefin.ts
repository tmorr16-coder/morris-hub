/**
 * Simplefin Bridge API client
 * Community instance: https://bridge.simplefin.org/
 *
 * Simplefin uses a simpler auth model than Plaid:
 * 1. User creates a claim URL with their bank credentials
 * 2. User visits claim URL to authenticate
 * 3. Returns a setup token
 * 4. Setup token can be exchanged for access token
 * 5. Access token is used for all API calls
 */

const SIMPLEFIN_URL = 'https://bridge.simplefin.org';

export interface SimplefinAccount {
  id: string;
  name: string;
  type: string; // "depository", "credit", etc
  currency: string;
  balance: number;
  available_balance?: number;
  status?: string;
}

export interface SimplefinTransaction {
  id: string;
  posted: string; // ISO date
  transacted?: string; // ISO date
  amount: number;
  currency: string;
  description: string;
  merchant?: string;
  tags?: string[];
  type?: string;
}

export interface SimplefinInstitution {
  id: string;
  name: string;
  products?: string[];
  url?: string;
}

/**
 * Get list of supported financial institutions
 */
export async function getInstitutions(): Promise<SimplefinInstitution[]> {
  try {
    const res = await fetch(`${SIMPLEFIN_URL}/institutions`);
    if (!res.ok) throw new Error(`Failed to fetch institutions: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[simplefin] getInstitutions failed:', error);
    throw error;
  }
}

/**
 * Create a claim URL that user visits to authenticate
 * User logs in at that URL, then gets a setup token
 *
 * Returns: { claim_url: "https://...", redirect: "https://..." }
 */
export async function createClaimUrl(redirectUrl: string): Promise<{ claim_url: string; redirect: string }> {
  try {
    const res = await fetch(`${SIMPLEFIN_URL}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect: redirectUrl }),
    });
    if (!res.ok) throw new Error(`Failed to create claim: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[simplefin] createClaimUrl failed:', error);
    throw error;
  }
}

/**
 * Exchange setup token (from claim URL) for permanent access token
 * User is redirected with ?setup=SETUP_TOKEN after authenticating
 */
export async function exchangeSetupToken(setupToken: string): Promise<{ access_token: string }> {
  try {
    const res = await fetch(`${SIMPLEFIN_URL}/setup/${setupToken}`);
    if (!res.ok) throw new Error(`Failed to exchange setup token: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[simplefin] exchangeSetupToken failed:', error);
    throw error;
  }
}

/**
 * Get accounts for an authenticated connection
 * Requires Basic auth with access_token:x
 */
export async function getAccounts(accessToken: string): Promise<SimplefinAccount[]> {
  try {
    const auth = Buffer.from(`${accessToken}:x`).toString('base64');
    const res = await fetch(`${SIMPLEFIN_URL}/accounts`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.status}`);
    const data = await res.json();
    return data.accounts || [];
  } catch (error) {
    console.error('[simplefin] getAccounts failed:', error);
    throw error;
  }
}

/**
 * Get transactions for an account
 * Optional: startDate in ISO format (YYYY-MM-DD)
 */
export async function getTransactions(
  accessToken: string,
  accountId: string,
  startDate?: string
): Promise<SimplefinTransaction[]> {
  try {
    const auth = Buffer.from(`${accessToken}:x`).toString('base64');
    let url = `${SIMPLEFIN_URL}/accounts/${accountId}/transactions`;
    if (startDate) {
      url += `?start=${startDate}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`);
    const data = await res.json();
    return data.transactions || [];
  } catch (error) {
    console.error('[simplefin] getTransactions failed:', error);
    throw error;
  }
}

/**
 * Health check — verify access token is still valid
 */
export async function healthCheck(accessToken: string): Promise<boolean> {
  try {
    const auth = Buffer.from(`${accessToken}:x`).toString('base64');
    const res = await fetch(`${SIMPLEFIN_URL}/accounts`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
