import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {jsonResult} from '../utils/response.js';

const description = `Create or overwrite a file with the specified content.

- Creates parent directories if they don't exist
- Overwrites existing files without warning
- Use absolute paths`;

export function registerCreate(server: McpServer): void {
	server.registerTool(
		'create',
		{
			title: 'Create',
			description,
			inputSchema: {
				path: z.string().describe('Absolute path where file will be created'),
				file_text: z.string().describe('Content to write to the file'),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
			},
		},
		async (args) => {
			const targetPath = args.path;
			const content = args.file_text;

			// Create parent directories if needed
			const dir = path.dirname(targetPath);
			await fs.mkdir(dir, {recursive: true});

			// Write the file
			await fs.writeFile(targetPath, content, 'utf-8');

			return jsonResult({
				success: true,
				path: targetPath,
				bytesWritten: Buffer.byteLength(content, 'utf-8'),
			});
		},
	);
}
