#!/bin/bash
# Run this script ONCE after mbt build && cf deploy
# It creates the BTP_INTEGRATION_SUITE destination automatically
# from the it-rt service key credentials

set -e

SPACE=$(cf target | grep "space:" | awk '{print $2}')
SERVICE_INSTANCE="iflow-runtime-api"
KEY_NAME="iflow-runtime-key"
DESTINATION_SERVICE="btp-iflow-manager-destination"
INTEGRATION_SUITE_URL="https://ad1142betrial.integrationsuite-trial.cfapps.us10-001.hana.ondemand.com"

echo "🔑 Creating service key for $SERVICE_INSTANCE..."
cf create-service-key "$SERVICE_INSTANCE" "$KEY_NAME" 2>/dev/null || echo "Key already exists, using existing."

echo "📋 Reading credentials..."
CREDENTIALS=$(cf service-key "$SERVICE_INSTANCE" "$KEY_NAME" | tail -n +2)

CLIENT_ID=$(echo "$CREDENTIALS"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('clientid',''))")
CLIENT_SECRET=$(echo "$CREDENTIALS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('clientsecret',''))")
TOKEN_URL=$(echo "$CREDENTIALS"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tokenurl',''))")

echo "  clientId:   $CLIENT_ID"
echo "  tokenUrl:   $TOKEN_URL"

echo ""
echo "🌐 Getting destination service credentials..."
DEST_KEY="dest-setup-key"
cf create-service-key "$DESTINATION_SERVICE" "$DEST_KEY" 2>/dev/null || echo "Key already exists."
DEST_CREDS=$(cf service-key "$DESTINATION_SERVICE" "$DEST_KEY" | tail -n +2)

DEST_URL=$(echo "$DEST_CREDS"           | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('uri',''))")
DEST_CLIENT_ID=$(echo "$DEST_CREDS"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('clientid',''))")
DEST_CLIENT_SECRET=$(echo "$DEST_CREDS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('clientsecret',''))")
DEST_TOKEN_URL=$(echo "$DEST_CREDS"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))")

echo "🔐 Getting destination service token..."
ACCESS_TOKEN=$(curl -s -X POST "$DEST_TOKEN_URL/oauth/token" \
  -u "$DEST_CLIENT_ID:$DEST_CLIENT_SECRET" \
  -d "grant_type=client_credentials" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "📡 Creating BTP_INTEGRATION_SUITE destination..."
HTTP_CODE=$(curl -s -o /tmp/dest_response.json -w "%{http_code}" \
  -X POST "$DEST_URL/destination-configuration/v1/instanceDestinations" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"Name\": \"BTP_INTEGRATION_SUITE\",
    \"Description\": \"SAP Integration Suite API\",
    \"URL\": \"$INTEGRATION_SUITE_URL\",
    \"Type\": \"HTTP\",
    \"ProxyType\": \"Internet\",
    \"Authentication\": \"OAuth2ClientCredentials\",
    \"clientId\": \"$CLIENT_ID\",
    \"clientSecret\": \"$CLIENT_SECRET\",
    \"tokenServiceURL\": \"$TOKEN_URL\",
    \"tokenServiceURLType\": \"Dedicated\",
    \"HTML5.DynamicDestination\": \"true\"
  }")

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Destination BTP_INTEGRATION_SUITE created successfully!"
else
  echo "⚠️  Response ($HTTP_CODE):"
  cat /tmp/dest_response.json
fi

echo ""
echo "🧹 Cleaning up temporary service key..."
cf delete-service-key "$DESTINATION_SERVICE" "$DEST_KEY" -f

echo ""
echo "✅ Setup complete! Your app is ready at:"
cf app btp-iflow-manager-approuter | grep "routes:"
