#!/usr/bin/env bash
# Reads CFBundleIdentifier / CFBundleDisplayName from an .ipa or .app (macOS) and prints them; with --write, writes
# BUNDLE_ID and APP_PATH into .env (never .env.example). Installs nothing; never touches a device.
#   ./scripts/setup-ios.sh --app apps/ios/MyBuild.ipa [--write] [--dry-run] [--help]
set -euo pipefail
APP="" WRITE=0 DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --write) WRITE=1; shift ;;
    --dry-run) DRY=1; shift ;;
    --help|-h) sed -n '2,4p' "$0"; exit 0 ;;
    *) echo "Unknown argument $1"; exit 2 ;;
  esac
done
[ -n "$APP" ] || { sed -n '2,4p' "$0"; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [[ "$APP" == *.ipa ]]; then unzip -q "$APP" -d "$TMP"; PLIST="$(ls -d "$TMP"/Payload/*.app)/Info.plist"; else PLIST="$APP/Info.plist"; fi
BUNDLE_ID="$(plutil -extract CFBundleIdentifier raw "$PLIST")"
NAME="$(plutil -extract CFBundleDisplayName raw "$PLIST" 2>/dev/null || plutil -extract CFBundleName raw "$PLIST")"
echo "BUNDLE_ID    = $BUNDLE_ID   (Info.plist CFBundleIdentifier)"
echo "Display name = $NAME   (Info.plist CFBundleDisplayName/CFBundleName)"
[ "$DRY" = 1 ] || [ "$WRITE" = 0 ] && exit 0
ENV_FILE="$ROOT/.env"; [ -f "$ENV_FILE" ] || cp "$ROOT/.env.example" "$ENV_FILE"
sed -i.bak -e "s|^BUNDLE_ID=.*|BUNDLE_ID=$BUNDLE_ID|" -e "s|^APP_PATH=.*|APP_PATH=$(cd "$(dirname "$APP")" && pwd)/$(basename "$APP")|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
echo "Written to .env (Git-ignored)."
