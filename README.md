# Personal Starling Bank MCP

This is [a fork of domdomegg/starling-bank-mcp](https://github.com/domdomegg/starling-bank-mcp) for one account holder. It exposes six **read-only** MCP tools over stdio: account discovery, balances, Savings Spaces, all Spaces, dated transactions, and a settled GBP spending summary. Payment, payee, card, account setting, and Space mutation tools are absent from the registry. The server has no HTTP listener.

## Starling access

Create a personal access token in your own [Starling Developer Portal](https://developer.starlingbank.com/personal/token) with these read scopes: `account:read`, `account-list:read`, `balance:read`, `savings-goal:read`, `space:read`, and `transaction:read`. The accounts endpoint's current OpenAPI security declaration lists both account scopes. Do not grant payment, payee, or savings-goal creation or transfer scopes. Starling's [FAQ](https://developer.starlingbank.com/faq) explains that personal access tokens are for accessing your own account and that `/api/v2/identity/token` reports granted scopes.

Provide the token as `STARLING_BANK_ACCESS_TOKEN` to the process running this server. Keep it in a protected local secret store or Heroku config vars. Never put it in Git, a tunnel profile, or chat. The server returns bank data to ChatGPT when a tool is invoked. Account discovery omits account numbers and sort codes; transaction results omit counterparty bank identifiers. Raw upstream error bodies are never returned.

## Local build and private tunnel

Requires Node 24.18 or later and the official `tunnel-client`.

```sh
npm ci
npm run build
npm test
npm run lint
```

After creating a **separate Starling tunnel** in [Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels), load `STARLING_BANK_ACCESS_TOKEN` and `CONTROL_PLANE_API_KEY` into your local environment without displaying them. Then:

```sh
tunnel-client init --sample sample_mcp_stdio_local \
  --profile starling-readonly \
  --tunnel-id '<Starling tunnel ID>' \
  --mcp-command 'node /absolute/path/to/starling-bank-mcp/dist/main.js'
tunnel-client doctor --profile starling-readonly --explain
tunnel-client run --profile starling-readonly
```

Keep the tunnel running. In ChatGPT's developer-mode Plugins screen, create a connection using **Tunnel**, select the separate Starling tunnel, and review the discovered six tools. Ask for an account balance in a normal conversation. A named second channel on the Cronometer tunnel is not treated as an independently discoverable connection. The existing Cronometer tunnel and its `main` channel remain untouched. [OpenAI's Secure MCP Tunnel documentation](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) describes workspace association, tunnel selection, and `doctor` checks.

## Optional Heroku worker

`Dockerfile.heroku` and `heroku_worker.sh` package this server and the pinned tunnel client as an outbound-only worker. They require `STARLING_BANK_ACCESS_TOKEN`, `CONTROL_PLANE_TUNNEL_ID` for the separate Starling tunnel, and `CONTROL_PLANE_API_KEY`. The image has no public banking endpoint. Deploy only to a **separate** Heroku app after approval of its recurring dyno cost and deployment. Do not push or release this image to the existing Cronometer app. A local tunnel avoids an additional dyno while the computer is running.

Rollback: stop this worker or local tunnel and disconnect the Starling connection in ChatGPT. Revoke the Starling personal token in the Developer Portal if retiring the integration. Cronometer needs no rollback because its deployment is unchanged.

## Data and safety limits

Amounts are integer minor units; GBP 2050 minor units means £20.50. `clearedBalance` excludes pending activity, `effectiveBalance` includes it, and `total*Balance` includes Space allocations. Do not add Space balances to total balances. Accepted overdraft is credit, not income.

`transactions_list` is limited to 32 days. `spending_summary` counts settled outbound GBP feed items, excludes `INTERNAL_TRANSFER`, and reports pending and transfer-like outflows separately. External transfers to another account you own cannot be proven from this feed, and Starling spending categories can be changed. A genuinely unallocated amount also requires upcoming bills and the next income date; this server will not invent them.

Starling's Savings Goals API supports creation, deposits and withdrawals with separate scopes. The current OpenAPI Spaces API lists Spending Spaces but does not provide equivalent mutation endpoints. Savings Space writes are **not registered or executable** here. They require verified ChatGPT write confirmation, an independent transaction-specific approval channel, preflight balance checks, transfer limits, a durable idempotency store, and uncertain/partial outcome reconciliation before activation. No live transfer is used in tests.
