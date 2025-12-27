import {
	describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {getRegisteredTool} from './_test-utils.js';

type ViewArgs = {path: string; view_range?: [number, number]};

describe('view tool', () => {
	let handler: (args: ViewArgs) => Promise<unknown>;
	let tmpDir: string;

	beforeEach(async () => {
		const tool = getRegisteredTool<ViewArgs>('view');
		handler = tool.handler;
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
