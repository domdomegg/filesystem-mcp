import {
	describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {getRegisteredTool} from './_test-utils.js';

type InsertArgs = {path: string; insert_line: number; insert_text: string};

describe('insert tool', () => {
	let handler: (args: InsertArgs) => Promise<unknown>;
	let tmpDir: string;

	beforeEach(async () => {
		const tool = getRegisteredTool<InsertArgs>('insert');
		handler = tool.handler;
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
