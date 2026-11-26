#!/usr/bin/env bash
# Test NextSMS WhatsApp v2 template personalisation directly (bypasses the app).
# Usage: ./test-nextsms-whatsapp.sh 255712345678 "VARIABLE-TEST-123" [template] [placeholder-name]
# Add --test as the last argument to use the free /test/ endpoint (nothing sent).
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE="$BACKEND_DIR/../.env"
fi

TO="${1:-}"
TEXT="${2:-VARIABLE-TEST-123}"
TEMPLATE="${3:-}"
PLACEHOLDER="${4:-message}"
MODE="send"
if [ "${5:-}" = "--test" ] || [ "${4:-}" = "--test" ]; then
  MODE="test"
fi

if [ -z "$TO" ]; then
  echo "Usage: $0 <phone 2557XXXXXXXX> <text> [template] [placeholder-name] [--test]" >&2
  exit 1
fi

K=$(grep '^NEXTSMS_API_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
B="${NEXTSMS_BASE_URL:-$(grep '^NEXTSMS_BASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')}"
ACCOUNT=$(grep '^NEXTSMS_WHATSAPP_ACCOUNT=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
if [ -z "$TEMPLATE" ]; then
  TEMPLATE=$(grep '^NEXTSMS_WHATSAPP_TEMPLATE=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
fi
BASE="${B:-https://messaging-service.co.tz}"
NUMBER="${TO#+255}"
NUMBER="255${NUMBER#255}"
NUMBER="${NUMBER#0}"

echo "Base:        $BASE"
echo "Mode:        $MODE"
echo "Account:     $ACCOUNT"
echo "Template:    $TEMPLATE"
echo "Placeholder: {$PLACEHOLDER}"
echo "To:          $NUMBER"
echo "Value:       $TEXT"
echo "--------------------------------------------------"

PATH_SEGMENT="text/single"
if [ "$MODE" = "test" ]; then
  PATH_SEGMENT="test/text/single"
fi

curl -sS -X POST "${BASE%/}/api/whatsapp/v2/${PATH_SEGMENT}" \
  -H "Authorization: Bearer $K" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{\"to\":[${NUMBER}],\"account\":\"$ACCOUNT\",\"template\":\"$TEMPLATE\",\"personalisation\":[{\"$PLACEHOLDER\":\"$TEXT\"}],\"reference\":\"re-cli-$(date +%s)\"}"
echo
