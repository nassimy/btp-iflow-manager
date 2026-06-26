#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — Run ONCE after cf deploy to create all required services
# and the BTP_INTEGRATION_SUITE destination
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── CONFIG — update these for each BTP account ───────────────────────────────
INTEGRATION_SUITE_URL="https://ad1142betrial.integrationsuite-trial.cfapps.us10-001.hana.ondemand.com"
IT_RT_INSTANCE="is-api-instance"          # existing it-rt service instance
DEST_INSTANCE="btp-iflow-manager-destination"  # destination service instance
# ─────────────────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════"
echo "  iFlow Manager — Setup Script"
echo "════════════════════════════════════════════════"
echo ""

# ── Step 1: Create destination service instance if not exists ─────────────────
echo "📦 Step 1 — Destination service instance..."
if cf service "$DEST_INSTANCE" > /dev/null 2>&1; then
  echo "  ✅ Already exists: $DEST_INSTANCE"
else
  echo "  Creating $DEST_INSTANCE..."
  cf create-service destination lite "$DEST_INSTANCE"
  echo "  ✅ Created."
fi

# ── Step 2: Bind destination service to apps ──────────────────────────────────
echo ""
echo "🔗 Step 2 — Binding destination service to apps..."
for APP in btp-iflow-manager-srv btp-iflow-manager-approuter; do
  if cf app "$APP" > /dev/null 2>&1; then
    cf bind-service "$APP" "$DEST_INSTANCE" 2>/dev/null && echo "  Bound $APP" || echo "  Already bound: $APP"
  fi
done

# ── Step 3: Get it-rt credentials ────────────────────────────────────────────
echo ""
echo "🔑 Step 3 — Reading it-rt credentials from $IT_RT_INSTANCE..."
KEY_NAME="setup-key-$$"
cf create-service-key "$IT_RT_INSTANCE" "$KEY_NAME"
cf service-key "$IT_RT_INSTANCE" "$KEY_NAME" | tail -n +3 > /tmp/it_rt_key.json

CLIENT_ID=$(python3 -c "import json; d=json.load(open('/tmp/it_rt_key.json')); o=d.get('credentials',d).get('oauth',d); print(o.get('clientid',''))")
TOKEN_URL=$(python3 -c "import json; d=json.load(open('/tmp/it_rt_key.json')); o=d.get('credentials',d).get('oauth',d); print(o.get('tokenurl',''))")

cf delete-service-key "$IT_RT_INSTANCE" "$KEY_NAME" -f
echo "  clientId : $CLIENT_ID"
echo "  tokenUrl : $TOKEN_URL"
echo "  ✅ Credentials read and key cleaned up."

echo "  clientId : $CLIENT_ID"
echo "  tokenUrl : $TOKEN_URL"

cf delete-service-key "$IT_RT_INSTANCE" "$KEY_NAME" -f
echo "  ✅ Credentials read and key cleaned up."

# ── Step 4: Get destination service credentials ───────────────────────────────
echo ""
echo "🌐 Step 4 — Reading destination service credentials..."
DEST_KEY="dest-key-$$"
cf create-service-key "$DEST_INSTANCE" "$DEST_KEY"
cf service-key "$DEST_INSTANCE" "$DEST_KEY" | tail -n +3 > /tmp/dest_key.json
cp /tmp/dest_key.json /tmp/dest_creds_raw.json

DEST_URI=$(python3 -c "import json; d=json.load(open('/tmp/dest_key.json')); c=d.get('credentials',d); print(c.get('uri',''))")
DEST_TOKEN_URL=$(python3 -c "import json; d=json.load(open('/tmp/dest_key.json')); c=d.get('credentials',d); print(c.get('url',''))")

rm -f /tmp/dest_key.json
cf delete-service-key "$DEST_INSTANCE" "$DEST_KEY" -f
echo "  ✅ Credentials read and key cleaned up."

cf delete-service-key "$DEST_INSTANCE" "$DEST_KEY" -f
echo "  ✅ Credentials read and key cleaned up."

# ── Step 5: Get destination service OAuth token ───────────────────────────────
echo ""
echo "🔐 Step 5 — Getting destination service token..."
echo "  Token URL: $DEST_TOKEN_URL"

ACCESS_TOKEN=$(python3 << 'PYEOF'
import urllib.request, urllib.parse, json

with open('/tmp/dest_creds_raw.json') as f:
    d = json.load(f)

c = d.get('credentials', d)
client_id     = c.get('clientid', '')
client_secret = c.get('clientsecret', '')
token_url     = c.get('url', '') + '/oauth/token'

data = urllib.parse.urlencode({
    "grant_type":    "client_credentials",
    "client_id":     client_id,
    "client_secret": client_secret,
}).encode()

req = urllib.request.Request(
    token_url, data=data,
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)
with urllib.request.urlopen(req) as r:
    print(json.load(r)["access_token"])
PYEOF
)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "  ❌ Failed to get access token."
  exit 1
fi
echo "$ACCESS_TOKEN" > /tmp/access_token.txt
echo "  ✅ Token obtained."

# ── Step 6: Create BTP_INTEGRATION_SUITE destination ─────────────────────────
echo ""
echo "📡 Step 6 — Creating BTP_INTEGRATION_SUITE destination..."

# ── Step 6: Create BTP_INTEGRATION_SUITE destination ─────────────────────────
echo ""
echo "📡 Step 6 — Creating BTP_INTEGRATION_SUITE destination..."

SUITE_URL="$INTEGRATION_SUITE_URL"

python3 << PYEOF
import urllib.request, json

with open('/tmp/it_rt_key.json') as f:
    it = json.load(f)
with open('/tmp/dest_creds_raw.json') as f:
    dc = json.load(f)

o  = it.get('credentials', it).get('oauth', it)
c  = dc.get('credentials', dc)

client_id     = o.get('clientid', '')
client_secret = o.get('clientsecret', '')
token_url     = o.get('tokenurl', '')
dest_uri      = c.get('uri', '')
access_token  = open('/tmp/access_token.txt').read().strip()
suite_url     = '$SUITE_URL'

dest = {
    "Name":                  "BTP_INTEGRATION_SUITE",
    "Description":           "SAP Integration Suite API",
    "URL":                   suite_url,
    "Type":                  "HTTP",
    "ProxyType":             "Internet",
    "Authentication":        "OAuth2ClientCredentials",
    "clientId":              client_id,
    "clientSecret":          client_secret,
    "tokenServiceURL":       token_url,
    "tokenServiceURLType":   "Dedicated",
    "HTML5.DynamicDestination": "true"
}

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type":  "application/json"
}

base = f"{dest_uri}/destination-configuration/v1/instanceDestinations"

try:
    req = urllib.request.Request(f"{base}/BTP_INTEGRATION_SUITE", method="DELETE", headers=headers)
    urllib.request.urlopen(req)
except: pass

req = urllib.request.Request(base, data=json.dumps(dest).encode(), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as r:
        print(f"  ✅ Destination BTP_INTEGRATION_SUITE created (HTTP {r.status})")
except urllib.error.HTTPError as e:
    print(f"  ⚠️  HTTP {e.code}: {e.read().decode()}")
PYEOF

rm -f /tmp/it_rt_key.json /tmp/dest_creds_raw.json /tmp/access_token.txt

# ── Step 7: Restage apps to pick up new bindings ─────────────────────────────
echo ""
echo "🔄 Step 7 — Restaging apps..."
for APP in btp-iflow-manager-srv btp-iflow-manager-approuter; do
  if cf app "$APP" > /dev/null 2>&1; then
    cf restage "$APP"
  fi
done

echo ""
echo "════════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo "  App URL:"
cf app btp-iflow-manager-approuter | grep "routes:" | awk '{print "  https://" $2}'
echo "════════════════════════════════════════════════"