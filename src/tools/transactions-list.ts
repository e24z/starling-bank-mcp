import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {categoryUid} from './schemas.js';
import {makeStarlingApiCall} from '../utils/starling-api.js';
import {jsonResult} from '../utils/response.js';

const currencyAndAmount = z.object({
	currency: z.string(),
	minorUnits: z.number().int(),
});

const feedItem = z.object({
	feedItemUid: z.string().optional(),
	categoryUid: z.string().optional(),
	amount: currencyAndAmount.optional(),
	sourceAmount: currencyAndAmount.optional(),
	direction: z.string().optional(),
	updatedAt: z.string().optional(),
	transactionTime: z.string().optional(),
	settlementTime: z.string().optional(),
	source: z.string().optional(),
	sourceSubType: z.string().optional(),
	status: z.string().optional(),
	transactingApplicationUserUid: z.string().optional(),
	counterPartyType: z.string().optional(),
	counterPartyUid: z.string().optional(),
	counterPartyName: z.string().optional(),
	counterPartySubEntityUid: z.string().optional(),
	counterPartySubEntityName: z.string().optional(),
	exchangeRate: z.number().optional(),
	totalFees: z.number().optional(),
	totalFeeAmount: currencyAndAmount.optional(),
	reference: z.string().optional(),
	country: z.string().optional(),
	spendingCategory: z.string().optional(),
	userNote: z.string().optional(),
	hasAttachment: z.boolean().optional(),
	hasReceipt: z.boolean().optional(),
});

const outputSchema = z.object({
	feedItems: z.array(feedItem),
});

export function registerTransactionsList(server: McpServer, config: Config): void {
	server.registerTool(
		'transactions_list',
		{
			title: 'List transactions',
			description: 'Get transaction feed items for an account category. Use the default category UID for main account transactions.',
			inputSchema: {
				...categoryUid,
				minTransactionTimestamp: z.iso.datetime({offset: true}).describe('Inclusive start timestamp in ISO 8601 format'),
				maxTransactionTimestamp: z.iso.datetime({offset: true}).describe('Inclusive end timestamp in ISO 8601 format, at most 32 days after start'),
			},
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({accountUid, categoryUid, minTransactionTimestamp, maxTransactionTimestamp}) => {
			const start = Date.parse(minTransactionTimestamp);
			const end = Date.parse(maxTransactionTimestamp);
			if (end < start || end - start > 32 * 86_400_000) {
				throw new Error('Choose an inclusive transaction range of at most 32 days.');
			}

			let endpoint = `/api/v2/feed/account/${accountUid}/category/${categoryUid}`;

			if (minTransactionTimestamp || maxTransactionTimestamp) {
				endpoint += '/transactions-between';
				const params = new URLSearchParams();

				if (minTransactionTimestamp) {
					params.append('minTransactionTimestamp', minTransactionTimestamp);
				}

				if (maxTransactionTimestamp) {
					params.append('maxTransactionTimestamp', maxTransactionTimestamp);
				}

				endpoint += `?${params.toString()}`;
			}

			const result = await makeStarlingApiCall(endpoint, config.accessToken);
			return jsonResult(outputSchema.parse(result));
		},
	);
}
