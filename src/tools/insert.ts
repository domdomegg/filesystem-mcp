import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import * as fs from 'node:fs/promises';
import {jsonResult} from '../utils/response.js';
import {expandPath} from '../utils/paths.js';

const description = `Insert text at a specific line in a file.

- insert_line = 0: Insert at the beginning
- insert_line = N: Insert after line N
- insert_text should typically end with a newline
- Use absolute paths`;

export function registerInsert(server: McpServer): void {
	server.registerTool(
		'insert',
		{
			title: 'Insert',
			description,
			inputSchema: {
				path: z.string().describe('Absolute path to file'),
				insert_line: z.number().int().min(0).describe('Line number to insert after (0 = beginning)'),
				insert_text: z.string().describe('Text to insert (should end with newline)'),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async (args) => {
			const targetPath = expandPath(args.path);
			const insertLine = args.insert_line;
			const insertText = args.insert_text;

			const content = await fs.readFile(targetPath, 'utf-8');
			const lines = content.split('\n');

			// Validate line number
			if (insertLine > lines.length) {
				throw new Error(`insert_line ${insertLine} is beyond file length (${lines.length} lines)`);
			}

			// Warn if insert_text doesn't end with newline
			let warning: string | undefined;
			if (!insertText.endsWith('\n')) {
				warning = 'insert_text does not end with newline - text will run together with next line';
			}

			// Insert the text
			// Split insert_text into lines (removing trailing newline for array ops)
			const insertLines = insertText.endsWith('\n')
				? insertText.slice(0, -1).split('\n')
				: insertText.split('\n');

			lines.splice(insertLine, 0, ...insertLines);

			const newContent = lines.join('\n');
			await fs.writeFile(targetPath, newContent, 'utf-8');

			return jsonResult({
				success: true,
				path: targetPath,
				insertedAt: insertLine,
				linesInserted: insertLines.length,
				...(warning ? {warning} : {}),
			});
		},
	);
}
