#!/bin/sh
set -eu

STARLING_BANK_ACCESS_TOKEN="$(security find-generic-password -a "$(id -un)" -s starling-mcp-readonly -w)"
export STARLING_BANK_ACCESS_TOKEN

repo_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec node "$repo_dir/dist/main.js"
