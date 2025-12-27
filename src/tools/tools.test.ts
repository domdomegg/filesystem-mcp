import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {type McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {ZodTypeAny} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {registerAll} from './index.js';

describe('tool registration', () => {
	let registeredTools: Map<string, {meta: unknown; handler: (args: unknown) => Promise<unknown>}>;

	beforeEach(() => {
		registeredTools = new Map();

		const server = {
			registerTool: vi.fn((name: string, meta: unknown, handler: (args: unknown) => Promise<unknown>) => {
				registeredTools.set(name, {meta, handler});
			}),
		} as unknown as McpServer;

		registerAll(server);
	});

	it('registers all expected tools', () => {
		const expectedTools = ['view', 'create', 'str_replace', 'insert'];

		for (const toolName of expectedTools) {
			expect(registeredTools.has(toolName), `Tool ${toolName} should be registered`).toBe(true);
		}
	});

	it('all tools have title and description', () => {
		for (const [name, tool] of registeredTools) {
			const meta = tool.meta as {title?: string; description?: string};
			expect(meta.title, `Tool ${name} should have a title`).toBeDefined();
			expect(meta.description, `Tool ${name} should have a description`).toBeDefined();
			expect(meta.title!.length, `Tool ${name} title should not be empty`).toBeGreaterThan(0);
			expect(meta.description!.length, `Tool ${name} description should not be empty`).toBeGreaterThan(0);
		}
	});

	it('all tools have input schema', () => {
		for (const [name, tool] of registeredTools) {
			const meta = tool.meta as {inputSchema?: unknown};
			expect(meta.inputSchema, `Tool ${name} should have inputSchema`).toBeDefined();
		}
	});

	it('view tool is marked read-only', () => {
		const tool = registeredTools.get('view');
		const meta = tool!.meta as {annotations?: {readOnlyHint?: boolean}};
		expect(meta.annotations?.readOnlyHint).toBe(true);
	});

	it('mutating tools are marked destructive', () => {
		const mutatingTools = ['create', 'str_replace', 'insert'];
		for (const toolName of mutatingTools) {
			const tool = registeredTools.get(toolName);
			const meta = tool!.meta as {annotations?: {destructiveHint?: boolean}};
			expect(meta.annotations?.destructiveHint, `Tool ${toolName} should be destructive`).toBe(true);
		}
	});

	it('str_replace JSON schema only shows canonical params (not aliases)', () => {
		const tool = registeredTools.get('str_replace')!;
		const meta = tool.meta as {inputSchema: ZodTypeAny};
		const jsonSchema = zodToJsonSchema(meta.inputSchema) as {
			properties?: Record<string, unknown>;
		};

		const properties = Object.keys(jsonSchema.properties ?? {});

		// Should have canonical names
		expect(properties).toContain('path');
		expect(properties).toContain('old_str');
		expect(properties).toContain('new_str');

		// Should NOT have alias names
		expect(properties).not.toContain('old_string');
		expect(properties).not.toContain('new_string');
	});

	it('create JSON schema only shows canonical params (not aliases)', () => {
		const tool = registeredTools.get('create')!;
		const meta = tool.meta as {inputSchema: ZodTypeAny};
		const jsonSchema = zodToJsonSchema(meta.inputSchema) as {
			properties?: Record<string, unknown>;
		};

		const properties = Object.keys(jsonSchema.properties ?? {});

		// Should have canonical names
		expect(properties).toContain('path');
		expect(properties).toContain('content');

		// Should NOT have alias names
		expect(properties).not.toContain('file_text');
	});
});
