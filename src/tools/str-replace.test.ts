import {
	describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type {ZodTypeAny} from 'zod';
import {getRegisteredTool, callWithValidation} from './_test-utils.js';

type StrReplaceArgs = {path: string; old_str: string; new_str?: string};

describe('str_replace tool', () => {
	let handler: (args: StrReplaceArgs) => Promise<unknown>;
	let inputSchema: ZodTypeAny;
	let tmpDir: string;

	beforeEach(async () => {
		const tool = getRegisteredTool<StrReplaceArgs>('str_replace');
		handler = tool.handler;
		inputSchema = tool.meta.inputSchema;
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filesystem-mcp-test-'));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	it('replaces unique string', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await callWithValidation(inputSchema, handler, {path: testFile, old_str: 'world', new_str: 'universe'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('hello universe');
	});

	it('deletes string when new_str omitted', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await callWithValidation(inputSchema, handler, {path: testFile, old_str: ' world'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('hello');
	});

	it('throws for non-unique string', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello hello');

		await expect(callWithValidation(inputSchema, handler, {path: testFile, old_str: 'hello', new_str: 'hi'})).rejects.toThrow('appears 2 times');
	});

	it('throws for string not found', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await expect(callWithValidation(inputSchema, handler, {path: testFile, old_str: 'xyz', new_str: 'abc'})).rejects.toThrow('not found');
	});

	it('accepts old_string alias for old_str', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await callWithValidation(inputSchema, handler, {path: testFile, old_string: 'world', new_str: 'universe'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('hello universe');
	});

	it('accepts new_string alias for new_str', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await callWithValidation(inputSchema, handler, {path: testFile, old_str: 'world', new_string: 'universe'});

		const content = await fs.readFile(testFile, 'utf-8');
		expect(content).toBe('hello universe');
	});

	it('rejects unknown parameters', async () => {
		const testFile = path.join(tmpDir, 'test.txt');
		await fs.writeFile(testFile, 'hello world');

		await expect(callWithValidation(inputSchema, handler, {
			path: testFile, old_str: 'world', new_str: 'universe', unknown_param: 'foo',
		})).rejects.toThrow();
	});
});
