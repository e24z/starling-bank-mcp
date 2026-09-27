import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {registerAccountsList} from './accounts-list.js';
import {registerAccountBalanceGet} from './account-balance-get.js';
import {registerTransactionsList} from './transactions-list.js';
import {registerSavingsGoalsList} from './savings-goals-list.js';
import {registerSpacesList} from './spaces-list.js';
import {registerSpendingSummary} from './spending-summary.js';

export type {Config} from './types.js';

export function registerAll(server: McpServer, config: Config): void {
	registerAccountsList(server, config);
	registerAccountBalanceGet(server, config);
	registerTransactionsList(server, config);
	registerSavingsGoalsList(server, config);
	registerSpacesList(server, config);
	registerSpendingSummary(server, config);
}
