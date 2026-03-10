# GitLab MCP

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for GitLab. Exposes GitLab projects, commits, files, merge requests, and issues as MCP tools for use in Cursor, Claude Desktop, or other MCP clients.

## Features

- **list_projects** — List all GitLab projects (membership-based, up to 100)
- **list_commits** — List repository commits for a project
- **get_file** — Get file content from a project at a given ref (branch/tag/commit)
- **list_merge_requests** — List merge requests for a project
- **list_issues** — List issues for a project

## Requirements

- Node.js 18+
- GitLab instance (self-hosted or GitLab.com)
- GitLab [Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) or [Project/Group Access Token](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html) with `read_api` scope

## Installation

```bash
npm install
```

## Configuration

Set environment variables before running the server:

| Variable      | Description                    | Default (example)     |
|---------------|--------------------------------|------------------------|
| `GITLAB_URL`  | GitLab base URL (no trailing slash) | `http://192.168.3.11` |
| `GITLAB_TOKEN`| API token (e.g. `glpat-xxxx`)  | `glpat-xxxxxxxx`       |

Example:

```bash
export GITLAB_URL="https://gitlab.com"
export GITLAB_TOKEN="glpat-your-token-here"
```

**Security:** Do not commit real tokens. Use environment variables or a secrets manager.

## Usage

### Run directly

```bash
node server.js
```

Or via npm:

```bash
npm start
```

The server uses stdio transport and is intended to be launched by an MCP client (e.g. Cursor MCP settings).

### Cursor configuration

Add to Cursor MCP settings (e.g. `~/.cursor/mcp.json` or project MCP config):

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "node",
      "args": ["/path/to/gitlab-mcp/server.js"],
      "env": {
        "GITLAB_URL": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat-your-token"
      }
    }
  }
}
```

Replace `/path/to/gitlab-mcp` with the actual path to this project.

## Tools Reference

| Tool                  | Parameters                          | Description                    |
|-----------------------|-------------------------------------|--------------------------------|
| `list_projects`       | —                                   | List projects (membership, per_page=100) |
| `list_commits`        | `project_id` (number)               | List commits for project       |
| `get_file`            | `project_id`, `file_path`, `ref`    | Get file content at ref        |
| `list_merge_requests` | `project_id` (number)               | List MRs for project           |
| `list_issues`         | `project_id` (number)               | List issues for project        |

Project IDs can be the numeric project ID or the URL-encoded path (e.g. `group%2Fproject`).

## License

ISC
