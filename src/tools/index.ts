import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerView} from './view.js';
import {registerCreate} from './create.js';
import {registerStrReplace} from './str-replace.js';
import {registerInsert} from './insert.js';

export function registerAll(server: McpServer): void {
	registerView(server);
	registerCreate(server);
	registerStrReplace(server);
	registerInsert(server);
}
