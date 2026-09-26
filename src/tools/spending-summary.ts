import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {categoryUid} from './schemas.js';
import {checkedDateRange} from './date-range.js';
import {makeStarlingApiCall} from '../utils/starling-api.js';
import {jsonResult} from '../utils/response.js';

const item = z.object({
	amount: z.object({currency: z.string(), minorUnits: z.number().int().nonnegative()}),
	direction: z.enum(['IN', 'OUT']),
	status: z.string(),
	source: z.string(),
	spendingCategory: z.string().optional(),
});

const outputSchema = z.object({
	currency: z.literal('GBP'), dateFrom: z.string(), dateTo: z.string(),
	settledSpendMinorUnits: z.number().int(),
	internalTransfersOutMinorUnits: z.number().int(),
	otherTransfersOutMinorUnits: z.number().int(),
	pendingOutMinorUnits: z.number().int(),
	byCategoryMinorUnits: z.record(z.string(), z.number().int()),
	limitations: z.string(),
});

export function registerSpendingSummary(server: McpServer, config: Config): void {
	server.registerTool('spending_summary', {
		title: 'Summarise settled GBP spending',
		description: 'Summarise a maximum 32-day window for one account category. Excludes internal transfers and pending items. Other transfer-like outflows are reported separately, as ownership cannot be proven from the feed alone.',
		inputSchema: {...categoryUid, dateFrom: z.string(), dateTo: z.string()},
		outputSchema, annotations: {readOnlyHint: true},
	}, async ({accountUid, categoryUid, dateFrom, dateTo}) => {
		const {start, end} = checkedDateRange(dateFrom, dateTo);
		const params = new URLSearchParams({minTransactionTimestamp: start, maxTransactionTimestamp: end});
		const data = await makeStarlingApiCall(`/api/v2/feed/account/${accountUid}/category/${categoryUid}/transactions-between?${params.toString()}`, config.accessToken);
		const feed = z.object({feedItems: z.array(item)}).parse(data).feedItems;
		let settledSpendMinorUnits = 0;
		let internalTransfersOutMinorUnits = 0;
		let otherTransfersOutMinorUnits = 0;
		let pendingOutMinorUnits = 0;
		const byCategoryMinorUnits: Record<string, number> = {};
		for (const entry of feed) {
			if (entry.amount.currency !== 'GBP') {
				throw new Error('Cannot summarise mixed currencies as GBP. Read transactions individually.');
			}

			if (entry.direction !== 'OUT') {
				continue;
			}

			const minor = entry.amount.minorUnits;
			if (entry.status === 'PENDING' || entry.status === 'UPCOMING') {
				pendingOutMinorUnits += minor;
			} else if (entry.status !== 'SETTLED') {
				// Declined, reversed and refunded feed items are not settled expenditure.
				continue;
			} else if (entry.source === 'INTERNAL_TRANSFER') {
				internalTransfersOutMinorUnits += minor;
			} else if (['SAVING', 'PERSONAL_TRANSFERS', 'TRANSFERS'].includes(entry.spendingCategory ?? '')) {
				otherTransfersOutMinorUnits += minor;
			} else {
				settledSpendMinorUnits += minor;
				const category = entry.spendingCategory ?? 'UNCATEGORISED';
				byCategoryMinorUnits[category] = (byCategoryMinorUnits[category] ?? 0) + minor;
			}
		}

		return jsonResult(outputSchema.parse({
			currency: 'GBP', dateFrom, dateTo, settledSpendMinorUnits,
			internalTransfersOutMinorUnits, otherTransfersOutMinorUnits, pendingOutMinorUnits,
			byCategoryMinorUnits,
			limitations: 'Starling categories are user-editable. External own-account transfers cannot be proven from this feed. Review otherTransfersOut and individual transactions before deciding what is unallocated.',
		}));
	});
}
