# filesystem-mcp

MCP server for filesystem operations - read, create, and edit files.

## Use Cases

**Save email attachments**: "Download all PDFs from my accountant's emails this month" → searches Gmail for matching emails, extracts attachments, and saves them to a local folder.

**Update config files**: "Change the API endpoint from staging to production in my config" → finds the config file, replaces the URL, and shows you the diff.

**Generate reports**: "Create a summary of today's calendar events" → reads your calendar, formats a markdown report, and saves it to your notes folder.

**Code refactoring**: "Rename the function `getData` to `fetchUserData` in src/api.ts" → reads the file, makes the precise replacement, and confirms the change.

**Backup before changes**: "Save a copy of my .zshrc before I modify it" → reads the current file and writes a timestamped backup.

## Setup

```bash
claude mcp add filesystem-mcp -- npx -y filesystem-mcp
```

Or with HTTP transport:

```bash
# Start the server
MCP_TRANSPORT=http PORT=3000 npx -y filesystem-mcp

# Add to Claude
claude mcp add --transport http filesystem-mcp http://localhost:3000/mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `view` | Read file contents or list directory (with line numbers) |
| `create` | Create or overwrite a file |
| `str_replace` | Replace an exact string in a file |
| `insert` | Insert text at a specific line |

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to the NPM registry.
