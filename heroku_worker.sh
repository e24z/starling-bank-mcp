#!/bin/sh
set -eu

: "${STARLING_BANK_ACCESS_TOKEN:?STARLING_BANK_ACCESS_TOKEN is required}"
: "${CONTROL_PLANE_TUNNEL_ID:?CONTROL_PLANE_TUNNEL_ID is required}"
: "${CONTROL_PLANE_API_KEY:?CONTROL_PLANE_API_KEY is required}"

exec tunnel-client run \
  --control-plane.tunnel-id "${CONTROL_PLANE_TUNNEL_ID}" \
  --control-plane.api-key env:CONTROL_PLANE_API_KEY \
  --mcp.command 'command=/app/start_mcp.sh,channel=main' \
  --health.listen-addr '127.0.0.1:18081' \
  --log.format json \
  --log.level info
