import {
	describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {getRegisteredTool} from './_test-utils.js';

type CreateArgs = {path: string; content: string};

describe('create tool', () => {
	let handler: (args: CreateArgs) => Promise<unknown>;
	let tmpDir: string;

	beforeEach(async () => {
		const tool = getRegisteredTool<CreateArgs>('create');
		handler = tool.handler;
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
