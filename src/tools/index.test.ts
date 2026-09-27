import {describe, test, expect} from 'vitest';
import {createServer} from '../index.js';

describe('tools index', () => {
	test('server creates without error', () => {
		const server = createServer({accessToken: 'test-token'});
		expect(server).toBeDefined();
	});
});
