import {
	describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import {type McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {registerAll} from './index.js';

describe('tool registration', () => {
	let server: McpServer;
	let registeredTools: Map<string, {meta: unknown; handler: (args: unknown) => Promise<unknown>}>;

	beforeEach(() => {
		registeredTools = new Map();

		server = {
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
});

describe('view tool', () => {
	let handler: (args: {path: string; view_range?: [number, number]}) => Promise<unknown>;
	let tmpDir: string;

	beforeEach(async () => {
		const registeredTools = new Map<string, {meta: unknown; handler: typeof handler}>();

		const server = {
			registerTool: vi.fn((name: string, meta: unknown, h: typeof handler) => {
				registeredTools.set(name, {meta, handler: h});
			}),
		} as unknown as McpServer;

		registerAll(server);
		handler = registeredTools.get('view')!.handler;

		// Create temp directory for tests
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filesystem-mcp-test-'));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	it('reads file with line numbers', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'line1\nline2\nline3\n');

		const result = await handler({path: testFile}) as {structuredContent: {type: string; content: string; totalLines: number}};

		expect(result.structuredContent.type).toBe('file');
		expect(result.structuredContent.totalLines).toBe(4); // includes trailing empty line
		expect(result.structuredContent.content).toContain('line1');
		expect(result.structuredContent.content).toContain('line2');
	});

	it('reads file with view_range', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'line1\nline2\nline3\nline4\nline5\n');

		const result = await handler({path: testFile, view_range: [2, 4]}) as {structuredContent: {content: string; viewedRange: [number, number]}};

		expect(result.structuredContent.viewedRange).toEqual([2, 4]);
		expect(result.structuredContent.content).toContain('line2');
		expect(result.structuredContent.content).toContain('line3');
		expect(result.structuredContent.content).toContain('line4');
		expect(result.structuredContent.content).not.toContain('line1');
		expect(result.structuredContent.content).not.toContain('line5');
	});

	it('lists directory contents', async () => {
		await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'content');
		await fs.mkdir(path.join(tmpDir, 'subdir'));
		await fs.writeFile(path.join(tmpDir, 'subdir', 'file2.txt'), 'content');

		const result = await handler({path: tmpDir}) as {structuredContent: {type: string; entries: string[]}};

		expect(result.structuredContent.type).toBe('directory');
		expect(result.structuredContent.entries).toContain('file1.txt');
		expect(result.structuredContent.entries).toContain('subdir/');
	});
});

describe('create tool', () => {
	let handler: (args: {path: string; content: string}) => Promise<unknown>;
	let tmpDir: string;

	beforeEach(async () => {
		const registeredTools = new Map<string, {meta: unknown; handler: typeof handler}>();

		const server = {
			registerTool: vi.fn((name: string, meta: unknown, h: typeof handler) => {
				registeredTools.set(name, {meta, handler: h});
			}),
		} as unknown as McpServer;

		registerAll(server);
		handler = registeredTools.get('create')!.handler;
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filesystem-mcp-test-'));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	it('creates a new file', async () => {
		const testFile = path.join(tmpDir, 'new.txt');

		const result = await handler({path: testFile, content: 'hello world'}) as {structuredContent: {success: boolean}};

		expect(result.structuredContent.success).toBe(true);
		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('hello world');
	});

	it('creates parent directories', async () => {
		const testFile = path.join(tmpDir, 'nested', 'dir', 'file.txt');

		await handler({path: testFile, content: 'content'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('content');
	});

	it('overwrites existing file', async () => {
		const testFile = path.join(tmpDir, 'existing.txt');
		await fs.writeFile(testFile, 'old content');

		await handler({path: testFile, content: 'new content'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('new content');
	});
});

describe('str_replace tool', () => {
	let handler: (args: {path: string; old_str: string; new_str?: string}) => Promise<unknown>;
	let tmpDir: string;

	beforeEach(async () => {
		const registeredTools = new Map<string, {meta: unknown; handler: typeof handler}>();

		const server = {
			registerTool: vi.fn((name: string, meta: unknown, h: typeof handler) => {
				registeredTools.set(name, {meta, handler: h});
			}),
		} as unknown as McpServer;

		registerAll(server);
		handler = registeredTools.get('str_replace')!.handler;
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filesystem-mcp-test-'));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	it('replaces unique string', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await handler({path: testFile, old_str: 'world', new_str: 'universe'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('hello universe');
	});

	it('deletes string when new_str omitted', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await handler({path: testFile, old_str: ' world'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('hello');
	});

	it('throws for non-unique string', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello hello');

		await expect(handler({path: testFile, old_str: 'hello', new_str: 'hi'})).rejects.toThrow('appears 2 times');
	});

	it('throws for string not found', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await expect(handler({path: testFile, old_str: 'xyz', new_str: 'abc'})).rejects.toThrow('not found');
	});
});

describe('insert tool', () => {
	let handler: (args: {path: string; insert_line: number; insert_text: string}) => Promise<unknown>;
	let tmpDir: string;

	beforeEach(async () => {
		const registeredTools = new Map<string, {meta: unknown; handler: typeof handler}>();

		const server = {
			registerTool: vi.fn((name: string, meta: unknown, h: typeof handler) => {
				registeredTools.set(name, {meta, handler: h});
			}),
		} as unknown as McpServer;

		registerAll(server);
		handler = registeredTools.get('insert')!.handler;
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filesystem-mcp-test-'));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	it('inserts at beginning (line 0)', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'line1\nline2\n');

		await handler({path: testFile, insert_line: 0, insert_text: 'line0\n'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('line0\nline1\nline2\n');
	});

	it('inserts after line N', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'line1\nline2\nline3\n');

		await handler({path: testFile, insert_line: 2, insert_text: 'inserted\n'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('line1\nline2\ninserted\nline3\n');
	});

	it('throws for line beyond file', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'line1\n');

		await expect(handler({path: testFile, insert_line: 100, insert_text: 'x\n'})).rejects.toThrow('beyond file length');
	});

	it('inserts at end with -1', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'line1\nline2\n');

		await handler({path: testFile, insert_line: -1, insert_text: 'line3\n'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('line1\nline2\nline3\n');
	});
});
