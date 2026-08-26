/**
 * Turn a stored sync failure into something the person can act on.
 *
 * `plaid_items.last_error` holds the raw message, which is what you want when
 * debugging. It is not what you want on screen: "SimpleFIN accounts fetch
 * failed with status 403" tells someone their money app is broken without
 * telling them it is fixable, or how.
 *
 * Translation happens at display time rather than on write, so the wording can
 * improve without a migration and the raw reason is never lost.
 */
export function explainSyncFailure(raw: string | null): { headline: string; detail: string; canReconnect: boolean } {
  const msg = raw ?? "";

  if (/status 40[13]/.test(msg)) {
    return {
      headline: "SimpleFIN is refusing the saved credential",
      detail:
        "The connection was authorised once but is being rejected now — usually because it was revoked at SimpleFIN, or the SimpleFIN subscription lapsed. Check your SimpleFIN account, then disconnect here and reconnect with a fresh setup token.",
      canReconnect: true,
    };
  }
  if (/status 4\d\d/.test(msg)) {
    return {
      headline: "SimpleFIN rejected the request",
      detail: "Reconnecting with a new setup token usually clears this.",
      canReconnect: true,
    };
  }
  if (/status 5\d\d/.test(msg)) {
    return {
      headline: "SimpleFIN is having trouble",
      detail: "A problem at their end, not yours. The next sync should pick it up — nothing needs reconnecting.",
      canReconnect: false,
    };
  }
  if (/timed out|timeout|aborted/i.test(msg)) {
    return {
      headline: "SimpleFIN did not respond in time",
      detail: "Usually transient. The next sync will try again.",
      canReconnect: false,
    };
  }
  if (/TOKEN_ENCRYPTION_KEY|decrypt/i.test(msg)) {
    return {
      headline: "The stored credential can't be read",
      detail:
        "The server's encryption key does not match the one used to save this connection. Reconnecting will store it again under the current key.",
      canReconnect: true,
    };
  }
  return {
    headline: "The last sync failed",
    detail: msg || "No reason was recorded.",
    canReconnect: false,
  };
}
