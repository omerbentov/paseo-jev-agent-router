#!/usr/bin/env bash
# Installs (or updates) the Jev agent router plugin in your local Paseo daemon.
#   curl -fsSL https://raw.githubusercontent.com/omerbentov/paseo-jev-agent-router/main/install.sh | bash
set -euo pipefail

SOURCE="${JEV_ROUTER_SOURCE:-https://github.com/omerbentov/paseo-jev-agent-router.git}"
PLUGIN_ID="jev-agent-router"
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/paseo-jev-agent-router/config.json"

if command -v paseo >/dev/null 2>&1; then
  PASEO=paseo
elif [ -x /Applications/Paseo.app/Contents/Resources/bin/paseo ]; then
  PASEO=/Applications/Paseo.app/Contents/Resources/bin/paseo
else
  echo "Paseo CLI not found. Install Paseo from https://paseo.sh, then run this again." >&2
  exit 1
fi

if ! status=$("$PASEO" daemon status --json 2>/dev/null); then
  echo "The Paseo daemon is not running. Open the Paseo app, then run this again." >&2
  exit 1
fi
home=$(printf '%s' "$status" | sed -n 's/.*"home": *"\([^"]*\)".*/\1/p' | head -n 1)

if ! grep -Eq '"pluginsEnabled"[[:space:]]*:[[:space:]]*true' "$home/config.json" 2>/dev/null; then
  cat >&2 <<'MSG'
Plugins are off in this Paseo daemon.

Plugins are trusted, unsandboxed code. Backend plugin code can access your
machine, including files, processes, credentials, and network services.

If you accept that, turn them on in Paseo: Settings → Plugins → Enable plugins,
then run this script again.
MSG
  exit 1
fi

if "$PASEO" plugin ls --json | grep -q "\"$PLUGIN_ID\""; then
  echo "Updating ${PLUGIN_ID}…"
  "$PASEO" plugin update "$PLUGIN_ID"
else
  echo "Installing ${PLUGIN_ID} from ${SOURCE}…"
  "$PASEO" plugin add "$SOURCE"
fi

# Ask for the TypeSafe key once, unless one is already configured. Read from
# the terminal, since stdin is this script when it is piped from curl.
if [ -z "${TYPESAFE_API_KEY:-}" ] && [ ! -f "$CONFIG" ] && [ -r /dev/tty ]; then
  printf 'TypeSafe API key (Enter to skip and set it later in Paseo): ' >/dev/tty
  IFS= read -rs key </dev/tty || key=""
  printf '\n' >/dev/tty
  if [ -n "$key" ]; then
    escaped=$(printf '%s' "$key" | sed 's/\\/\\\\/g; s/"/\\"/g')
    mkdir -p "$(dirname "$CONFIG")"
    chmod 700 "$(dirname "$CONFIG")"
    (umask 077 && printf '{\n  "typesafeApiKey": "%s",\n  "minConfidence": 0.5,\n  "fallbackProfileId": ""\n}\n' "$escaped" >"$CONFIG")
    echo "Saved the key to $CONFIG"
  fi
fi

echo
"$PASEO" plugin ls
echo
echo "Done. In any workspace, type:  /route <your task>"
echo "Settings: Paseo → Settings → Plugins → Jev agent router"
