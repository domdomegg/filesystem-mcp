import {vi} from 'vitest';
import {type McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {ZodTypeAny} from 'zod';
import {registerAll} from './index.js';

// Helper to simulate MCP SDK's validation - parses args through schema before calling handler
export async function callWithValidation<T>(
	schema: ZodTypeAny,
	handler: (args: T) => Promise<unknown>,
	args: Record<string, unknown>,
): Promise<unknown> {
	const parsed = await schema.parseAsync(args);
	return handler(parsed as T);
}

type ToolRegistration<T> = {
	meta: {inputSchema: ZodTypeAny};
	handler: (args: T) => Promise<unknown>;
};

// Helper to get a registered tool's handler and schema
export function getRegisteredTool<T>(toolName: string): ToolRegistration<T> {
	const registeredTools = new Map<string, ToolRegistration<T>>();

	const server = {
		registerTool: vi.fn((name: string, meta: {inputSchema: ZodTypeAny}, h: (args: T) => Promise<unknown>) => {
			registeredTools.set(name, {meta, handler: h});
		}),
	} as unknown as McpServer;

	registerAll(server);

	const tool = registeredTools.get(toolName);
	if (!tool) {
		throw new Error(`Tool ${toolName} not found`);
	}

	return tool;
}
