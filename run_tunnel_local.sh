#!/bin/sh
set -eu

# Read the Personal organization runtime key from Keychain at launch.
# The key is never written to the tunnel profile.
CONTROL_PLANE_API_KEY="$(security find-generic-password -l 'OpenAI Secure MCP Tunnel runtime API key' -w)"
export CONTROL_PLANE_API_KEY

exec "${TUNNEL_CLIENT_BIN:-${HOME}/.local/bin/tunnel-client}" "$@"
