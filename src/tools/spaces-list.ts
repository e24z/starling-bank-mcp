import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {accountUid} from './schemas.js';
import {makeStarlingApiCall} from '../utils/starling-api.js';
import {jsonResult} from '../utils/response.js';

const money = z.object({currency: z.string(), minorUnits: z.number().int()});
const outputSchema = z.object({
	savingsGoals: z.array(z.object({
		savingsGoalUid: z.string(), name: z.string(), totalSaved: money, state: z.string(),
	})),
	spendingSpaces: z.array(z.object({
		spaceUid: z.string(), name: z.string(), balance: money, state: z.string(), spendingSpaceType: z.string(),
	})),
});

export function registerSpacesList(server: McpServer, config: Config): void {
	server.registerTool('spaces_list', {
		title: 'List Spaces and balances',
		description: 'List Savings Spaces and Spending Spaces separately. Balances are exact minor units. Spaces are allocations within an account; never add them to total account balance.',
		inputSchema: {...accountUid}, outputSchema,
		annotations: {readOnlyHint: true},
	}, async ({accountUid}) => {
		const data = await makeStarlingApiCall(`/api/v2/account/${accountUid}/spaces`, config.accessToken);
		return jsonResult(outputSchema.parse(data));
	});
}
