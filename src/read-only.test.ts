import {
	afterEach, describe, expect, test, vi,
} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createServer} from './index.js';

async function connected() {
	const server = createServer({accessToken: 'secret-test-token'});
	const client = new Client({name: 'test', version: '1'});
	const [a, b] = InMemoryTransport.createLinkedPair();
	await server.connect(a);
	await client.connect(b);
	return {
		client, async close() {
			await client.close();
			await server.close();
		},
	};
}

function mockJson(data: unknown, status = 200) {
	vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data), {
		status, headers: {'content-type': 'application/json'},
	})));
}

afterEach(() => vi.unstubAllGlobals());

describe('personal read-only surface', () => {
	test('advertises only the six intended reads', async () => {
		const {client, close} = await connected();
		try {
			const result = await client.listTools();
			expect(result.tools.map((tool) => tool.name).sort()).toEqual([
				'account_balance_get',
				'accounts_list',
				'savings_goals_list',
				'spaces_list',
				'spending_summary',
				'transactions_list',
			]);
			expect(result.tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
		} finally {
			await close();
		}
	});

	test('returns separate Savings and Spending Spaces', async () => {
		mockJson({
			savingsGoals: [{
				savingsGoalUid: 's1', name: 'Groceries', totalSaved: {currency: 'GBP', minorUnits: 2050}, state: 'ACTIVE',
			}],
			spendingSpaces: [{
				spaceUid: 'p1', name: 'Everyday', balance: {currency: 'GBP', minorUnits: 700}, state: 'ACTIVE', spendingSpaceType: 'EXPENSE',
			}],
		});
		const {client, close} = await connected();
		try {
			const result = await client.callTool({name: 'spaces_list', arguments: {accountUid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}});
			expect(result.structuredContent).toMatchObject({
				savingsGoals: [{name: 'Groceries', totalSaved: {minorUnits: 2050}}],
				spendingSpaces: [{name: 'Everyday', balance: {minorUnits: 700}}],
			});
		} finally {
			await close();
		}
	});

	test('discovers accounts without exposing bank identifiers', async () => {
		mockJson({
			accounts: [{
				accountUid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', accountType: 'PRIMARY', defaultCategory: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
				currency: 'GBP', createdAt: '2025-01-01T00:00:00Z', name: 'Personal',
				accountNumber: '12345678',
			}],
		});
		const {client, close} = await connected();
		try {
			const result = await client.callTool({name: 'accounts_list', arguments: {}});
			expect(result.structuredContent).toMatchObject({accounts: [{accountUid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', defaultCategory: 'cccccccc-cccc-cccc-cccc-cccccccccccc'}]});
			expect(JSON.stringify(result)).not.toContain('12345678');
		} finally {
			await close();
		}
	});

	test('preserves cleared, effective and total balances in pence', async () => {
		mockJson({
			clearedBalance: {currency: 'GBP', minorUnits: 5000},
			effectiveBalance: {currency: 'GBP', minorUnits: 4500},
			totalClearedBalance: {currency: 'GBP', minorUnits: 7050},
			acceptedOverdraft: {currency: 'GBP', minorUnits: 10000},
		});
		const {client, close} = await connected();
		try {
			const result = await client.callTool({name: 'account_balance_get', arguments: {accountUid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}});
			expect(result.structuredContent).toMatchObject({
				clearedBalance: {minorUnits: 5000}, effectiveBalance: {minorUnits: 4500},
				totalClearedBalance: {minorUnits: 7050}, acceptedOverdraft: {minorUnits: 10000},
			});
		} finally {
			await close();
		}
	});

	test('reports settled spend apart from pending and internal transfers', async () => {
		mockJson({
			feedItems: [
				{
					amount: {currency: 'GBP', minorUnits: 1250}, direction: 'OUT', status: 'SETTLED', source: 'MASTER_CARD', spendingCategory: 'GROCERIES',
				},
				{
					amount: {currency: 'GBP', minorUnits: 2000}, direction: 'OUT', status: 'SETTLED', source: 'INTERNAL_TRANSFER', spendingCategory: 'GROCERIES',
				},
				{
					amount: {currency: 'GBP', minorUnits: 300}, direction: 'OUT', status: 'PENDING', source: 'MASTER_CARD', spendingCategory: 'GROCERIES',
				},
				{
					amount: {currency: 'GBP', minorUnits: 400}, direction: 'OUT', status: 'SETTLED', source: 'FASTER_PAYMENTS_OUT', spendingCategory: 'PERSONAL_TRANSFERS',
				},
			],
		});
		const {client, close} = await connected();
		try {
			const result = await client.callTool({
				name: 'spending_summary', arguments: {
					accountUid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', categoryUid: 'cccccccc-cccc-cccc-cccc-cccccccccccc', dateFrom: '2026-09-01', dateTo: '2026-09-26',
				},
			});
			expect(result.structuredContent).toMatchObject({
				settledSpendMinorUnits: 1250, internalTransfersOutMinorUnits: 2000,
				pendingOutMinorUnits: 300, otherTransfersOutMinorUnits: 400,
				byCategoryMinorUnits: {GROCERIES: 1250},
			});
		} finally {
			await close();
		}
	});

	test('rejects an overlong range before fetching', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const {client, close} = await connected();
		try {
			const result = await client.callTool({
				name: 'spending_summary', arguments: {
					accountUid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', categoryUid: 'cccccccc-cccc-cccc-cccc-cccccccccccc', dateFrom: '2026-01-01', dateTo: '2026-03-01',
				},
			});
			expect(result.isError).toBe(true);
			expect(fetchMock).not.toHaveBeenCalled();
		} finally {
			await close();
		}
	});

	test('rejects mixed currencies in a GBP summary', async () => {
		mockJson({
			feedItems: [{
				amount: {currency: 'EUR', minorUnits: 500}, direction: 'OUT', status: 'SETTLED', source: 'MASTER_CARD',
			}],
		});
		const {client, close} = await connected();
		try {
			const result = await client.callTool({
				name: 'spending_summary', arguments: {
					accountUid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', categoryUid: 'cccccccc-cccc-cccc-cccc-cccccccccccc', dateFrom: '2026-09-01', dateTo: '2026-09-26',
				},
			});
			expect(result.isError).toBe(true);
			expect(JSON.stringify(result)).toContain('mixed currencies');
		} finally {
			await close();
		}
	});

	test('does not echo an upstream error body or token', async () => {
		mockJson({message: 'secret-test-token'}, 403);
		const {client, close} = await connected();
		try {
			const result = await client.callTool({name: 'accounts_list', arguments: {}});
			expect(result.isError).toBe(true);
			expect(JSON.stringify(result)).not.toContain('secret-test-token');
			expect(JSON.stringify(result)).toContain('required scope');
		} finally {
			await close();
		}
	});
});
