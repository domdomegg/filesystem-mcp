import {
	describe, it, expect, beforeAll, afterAll,
} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createServer} from '../index.js';

/**
 * Integration test that verifies the MCP server's tools/list response
 * has proper JSON schemas. This catches issues where the SDK's schema
 * serialization doesn't work correctly (e.g., with ZodEffects schemas).
 */
describe('MCP server integration', () => {
	let client: Client;
	let cleanup: () => Promise<void>;

	beforeAll(async () => {
		const server = createServer();
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

		client = new Client({name: 'test-client', version: '1.0.0'});

		await Promise.all([
			client.connect(clientTransport),
			server.connect(serverTransport),
		]);

		cleanup = async () => {
			await client.close();
			await server.close();
		};
	});

	afterAll(async () => {
		await cleanup?.();
	});

	it('tools/list returns schemas with properties (not empty)', async () => {
		const result = await client.listTools();

		expect(result.tools.length).toBeGreaterThan(0);

		// Each tool with parameters should have non-empty properties
		const toolsWithParams = ['view', 'create', 'str_replace', 'insert'];

		for (const toolName of toolsWithParams) {
			const tool = result.tools.find((t) => t.name === toolName);
			expect(tool, `Tool ${toolName} should exist`).toBeDefined();

			const schema = tool!.inputSchema as {
				type: string;
				properties?: Record<string, unknown>;
			};

			expect(schema.type).toBe('object');
			expect(
				schema.properties,
				`Tool ${toolName} should have properties in inputSchema`,
			).toBeDefined();
			expect(
				Object.keys(schema.properties!).length,
				`Tool ${toolName} should have non-empty properties`,
			).toBeGreaterThan(0);
		}
	});

	it('str_replace schema has correct parameter names', async () => {
		const result = await client.listTools();
		const tool = result.tools.find((t) => t.name === 'str_replace');

		const schema = tool!.inputSchema as {
			properties?: Record<string, unknown>;
			required?: string[];
		};

		// Should have canonical names
		expect(Object.keys(schema.properties!)).toContain('path');
		expect(Object.keys(schema.properties!)).toContain('old_str');
		expect(Object.keys(schema.properties!)).toContain('new_str');

		// Should NOT have alias names exposed in schema
		expect(Object.keys(schema.properties!)).not.toContain('old_string');
		expect(Object.keys(schema.properties!)).not.toContain('new_string');

		// Required fields should be correct
		expect(schema.required).toContain('path');
		expect(schema.required).toContain('old_str');
	});

	it('view schema has correct parameter structure', async () => {
		const result = await client.listTools();
		const tool = result.tools.find((t) => t.name === 'view');

		const schema = tool!.inputSchema as {
			properties?: Record<string, {type: string; description?: string}>;
			required?: string[];
		};

		expect(schema.properties!.path).toBeDefined();
		expect(schema.properties!.path!.type).toBe('string');
		expect(schema.properties!.path!.description).toBeDefined();

		expect(schema.required).toContain('path');
	});
});
