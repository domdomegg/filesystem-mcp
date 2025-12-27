import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {jsonResult} from '../utils/response.js';
import {expandPath} from '../utils/paths.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const description = `View file contents or list directory.

For files:
- Returns content with line numbers (format: "   N\\t<content>")
- Use view_range to read specific lines [start, end] (1-indexed, inclusive)
- Large files are truncated at 16000 characters

For directories:
- Lists contents with type indicator (/ for directories)
- Shows 2 levels deep by default
- Ignores hidden files and node_modules`;

export function registerView(server: McpServer): void {
	server.registerTool(
		'view',
		{
			title: 'View',
			description,
			inputSchema: strictSchemaWithAliases(
				{
					path: z.string().describe('Absolute path to file or directory'),
					view_range: z.tuple([z.number(), z.number()]).optional().describe('Line range [start, end] for text files (1-indexed, inclusive)'),
				},
				{},
			),
			annotations: {
				readOnlyHint: true,
			},
		},
		async (args) => {
			const targetPath = expandPath(args.path);
			const stat = await fs.stat(targetPath);

			if (stat.isDirectory()) {
				const entries = await listDirectory(targetPath, 2);
				return jsonResult({
					type: 'directory',
					path: targetPath,
					entries,
				});
			}

			// File
			const content = await fs.readFile(targetPath, 'utf-8');
			const lines = content.split('\n');

			let startLine = 1;
			let endLine = lines.length;

			if (args.view_range) {
				[startLine, endLine] = args.view_range;
				startLine = Math.max(1, startLine);
				endLine = Math.min(lines.length, endLine);
			}

			// Format with line numbers (6-char padding + tab)
			const numberedLines = lines
				.slice(startLine - 1, endLine)
				.map((line, i) => {
					const lineNum = (startLine + i).toString().padStart(6, ' ');
					return `${lineNum}\t${line}`;
				});

			let result = numberedLines.join('\n');

			// Truncate if too large
			const MAX_CHARS = 16000;
			if (result.length > MAX_CHARS) {
				result = `${result.slice(0, MAX_CHARS)}\n... (truncated)`;
			}

			return jsonResult({
				type: 'file',
				path: targetPath,
				totalLines: lines.length,
				viewedRange: [startLine, endLine],
				content: result,
			});
		},
	);
}

async function listDirectory(dirPath: string, depth: number): Promise<string[]> {
	if (depth <= 0) {
		return [];
	}

	const entries: string[] = [];
	const items = await fs.readdir(dirPath, {withFileTypes: true});

	for (const item of items) {
		// Skip hidden files and node_modules
		if (item.name.startsWith('.') || item.name === 'node_modules') {
			continue;
		}

		if (item.isDirectory()) {
			entries.push(`${item.name}/`);
			if (depth > 1) {
				// eslint-disable-next-line no-await-in-loop -- sequential traversal for predictable ordering
				const subEntries = await listDirectory(path.join(dirPath, item.name), depth - 1);
				for (const sub of subEntries) {
					entries.push(`  ${item.name}/${sub}`);
				}
			}
		} else {
			entries.push(item.name);
		}
	}

	return entries;
}
