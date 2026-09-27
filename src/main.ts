#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createServer} from './index.js';

function setupSignalHandlers(cleanup: () => Promise<void>): void {
	process.on('SIGINT', async () => {
		await cleanup();
		process.exit(0);
	});
	process.on('SIGTERM', async () => {
		await cleanup();
		process.exit(0);
	});
}

function getAccessToken(): string {
	const accessToken = process.env.STARLING_BANK_ACCESS_TOKEN;
	if (!accessToken) {
		throw new Error('starling-bank-mcp: No access token provided. Set it in the `STARLING_BANK_ACCESS_TOKEN` environment variable');
	}

	return accessToken;
}

const transport = process.env.MCP_TRANSPORT || 'stdio';

(async () => {
	if (transport === 'stdio') {
		const server = createServer({accessToken: getAccessToken()});
		setupSignalHandlers(async () => server.close());

		const stdioTransport = new StdioServerTransport();
		await server.connect(stdioTransport);
		console.error('Starling Bank read-only MCP server running on stdio');
	} else {
		console.error('Only private stdio transport is enabled in this fork.');
		process.exit(1);
	}
})();
