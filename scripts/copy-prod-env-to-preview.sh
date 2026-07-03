#!/usr/bin/env bash
# Copy the feature API keys from Vercel PRODUCTION to PREVIEW so preview
# deployments have live data (stock/Alpaca/Plaid/Oura/Withings/Apple-Health/email).
#
# Run this yourself in the Codespace terminal (NOT through Claude — the whole-prod-env
# pull is intentionally blocked in the agent sandbox as a credential-safety guardrail):
#     bash scripts/copy-prod-env-to-preview.sh
#
# It pulls prod env to a temp file, adds each listed var to Preview by piping the
# value straight into `vercel env add` (values are never echoed), then shreds the file.
set -euo pipefail

VC="npx -y vercel@48"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Vars that features read but that currently live only in Production.
VARS=(
  FINNHUB_API_KEY
  ALPACA_API_KEY ALPACA_API_SECRET ALPACA_ENV
  PLAID_CLIENT_ID PLAID_SECRET PLAID_ENV
  OURA_ACCESS_TOKEN
  WITHINGS_CLIENT_ID WITHINGS_CLIENT_SECRET
  TOKEN_ENCRYPTION_KEY
  HEALTH_AUTO_EXPORT_SECRET
  RESEND_API_KEY
  NEXT_PUBLIC_SITE_URL
)

echo "Pulling production env…"
$VC env pull --environment=production "$TMP" --yes >/dev/null

for name in "${VARS[@]}"; do
  # Extract the value for this var from the dotenv file without printing it.
  line="$(grep -E "^${name}=" "$TMP" || true)"
  if [ -z "$line" ]; then
    echo "skip   $name (not set in production)"
    continue
  fi
  # Strip NAME= and surrounding quotes.
  val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"
  # Remove any existing Preview copy so re-runs are idempotent (ignore errors).
  $VC env rm "$name" preview --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | $VC env add "$name" preview >/dev/null 2>&1 \
    && echo "added  $name -> Preview" \
    || echo "FAILED $name"
done

echo
echo "Done. Redeploy so the preview picks them up:  npx -y vercel@48 deploy --yes"
echo "(Optional: also add FDC_API_KEY — a free USDA FoodData Central key — to Preview+Production for the US meal library.)"
