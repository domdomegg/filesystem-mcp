import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import * as fs from 'node:fs/promises';
import {jsonResult} from '../utils/response.js';
import {expandPath} from '../utils/paths.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const description = `Replace an exact string in a file.

- old_str must match exactly and be unique in the file
- If old_str appears 0 times or more than once, the operation fails
- If new_str is omitted, old_str is deleted
- Use absolute paths`;

export function registerStrReplace(server: McpServer): void {
	server.registerTool(
		'str_replace',
		{
			title: 'String Replace',
			description,
			inputSchema: strictSchemaWithAliases(
				{
					path: z.string().describe('Absolute path to file'),
					old_str: z.string().describe('Exact string to find (must be unique)'),
					new_str: z.string().optional().describe('Replacement string (omit to delete)'),
				},
				{
					old_string: 'old_str',
					new_string: 'new_str',
				},
			),
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async (args) => {
			const targetPath = expandPath(args.path);
			const oldStr = args.old_str;
			const newStr = args.new_str ?? '';

			const content = await fs.readFile(targetPath, 'utf-8');

			// Check for empty file
			if (content.length === 0) {
				throw new Error('Cannot use str_replace on an empty file');
			}

			// Count occurrences
			const occurrences = countOccurrences(content, oldStr);

			if (occurrences === 0) {
				const preview = oldStr.length > 100 ? `${oldStr.slice(0, 100)}...` : oldStr;
				throw new Error(`old_str not found in file: "${preview}"`);
			}

			if (occurrences > 1) {
				// Find line numbers of all occurrences
				const lines = content.split('\n');
				const matchingLines: number[] = [];
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					if (line?.includes(oldStr)) {
						matchingLines.push(i + 1);
					}
				}

				throw new Error(`old_str appears ${occurrences} times (must be unique). Found on lines: ${matchingLines.join(', ')}`);
			}

			// Replace
			const newContent = content.replace(oldStr, newStr);
			await fs.writeFile(targetPath, newContent, 'utf-8');

			return jsonResult({
				success: true,
				path: targetPath,
				replacements: 1,
			});
		},
	);
}

function countOccurrences(str: string, substr: string): number {
	if (substr.length === 0) {
		return 0;
	}

	let count = 0;
	let pos = 0;
	while ((pos = str.indexOf(substr, pos)) !== -1) {
		count += 1;
		pos += substr.length;
	}

	return count;
}
