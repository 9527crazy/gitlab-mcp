# GitLab MCP

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for GitLab. Exposes GitLab projects, commits, files, merge requests, and issues as MCP tools for use in Cursor, Claude Desktop, or other MCP clients.

## Features

- **list_projects** — List all GitLab projects (membership-based, up to 100)
- **list_commits** — List repository commits for a project
- **get_file** — Get file content from a project at a given ref (branch/tag/commit)
- **list_merge_requests** — List merge requests for a project
- **list_issues** — List issues for a project (optional: state, labels, iids)
- **create_issue** — Create an issue in a project
- **get_issue** — Get a single issue by project and issue IID
- **update_issue** — Update an issue (title, description, state_event, labels, assignees, etc.)
- **delete_issue** — Delete an issue from a project
- **add_issue_note** — Add a comment/note to an issue
- **list_issue_notes** — List notes/comments of an issue

## Requirements

- Node.js 18+
- GitLab instance (self-hosted or GitLab.com)
- GitLab [Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) or [Project/Group Access Token](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html) with `read_api` (and `api` for creating/updating/deleting issues and adding notes)

## Installation

From npm :

```bash
npm install -g @butterfly-liu/gitlab-mcp
# or as project dependency
npm install @butterfly-liu/gitlab-mcp
```

Or clone and install locally:

```bash
git clone https://github.com/9527crazy/gitlab-mcp.git && cd gitlab-mcp && npm install
```

## Configuration

**Required:** Set `GITLAB_TOKEN` in your environment or MCP client config. The server will exit with an error if it is missing.

| Variable       | Description                         | Default           |
|----------------|-------------------------------------|-------------------|
| `GITLAB_URL`   | GitLab base URL (no trailing slash) | `https://gitlab.com` |
| `GITLAB_TOKEN` | API token (e.g. `glpat-xxxx`)       | *required*        |

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
# or if installed globally
gitlab-mcp
```

Or in a project with `npm start` or `npx gitlab-mcp`.

The server uses stdio transport and is intended to be launched by an MCP client (e.g. Cursor MCP settings).

### Cursor configuration

Add to Cursor MCP settings (e.g. `~/.cursor/mcp.json` or project MCP config).

When installed from npm (global or local `node_modules`):

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": ["@butterfly-liu/gitlab-mcp"],
      "env": {
        "GITLAB_URL": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat-your-token"
      }
    }
  }
}
```

Or with explicit path to `server.js`:

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

## Tools Reference

| Tool                   | Parameters                                      | Description |
|------------------------|--------------------------------------------------|-------------|
| `list_projects`        | —                                               | List projects (membership, per_page=100) |
| `list_commits`         | `project_id` (number)                            | List commits for project |
| `get_file`             | `project_id`, `file_path`, `ref`                 | Get file content at ref |
| `list_merge_requests`  | `project_id` (number)                            | List MRs for project |
| `list_issues`          | `project_id` (number), *optional:* `state`, `labels`, `iids` | List issues for project |
| `create_issue`         | `project_id`, `title`, *optional:* `description`, `labels`, `assignee_ids`, `due_date`, `confidential`, `issue_type` | Create an issue |
| `get_issue`            | `project_id`, `issue_iid`                        | Get a single issue |
| `update_issue`         | `project_id`, `issue_iid`, *optional:* `title`, `description`, `state_event`, `labels`, `add_labels`, `remove_labels`, `assignee_ids`, `due_date`, `milestone_id`, `confidential`, `discussion_locked`, `issue_type` | Update an issue |
| `delete_issue`         | `project_id`, `issue_iid`                        | Delete an issue |
| `add_issue_note`       | `project_id`, `issue_iid`, `body`                | Add a comment/note to an issue |
| `list_issue_notes`     | `project_id`, `issue_iid`                        | List notes/comments of an issue |

Project IDs are numeric. Issue IID is the project-internal issue number (e.g. `#3` → `issue_iid: 3`).

---

## Publishing to npm (maintainers)

**Note:** The unscoped name `gitlab-mcp` is already taken on npm. Publish under a scoped name, e.g. `@butterfly-liu/gitlab-mcp`.

Before first publish:

1. **Set package name** in `package.json`: Package name is `@butterfly-liu/gitlab-mcp` (use your npm username as scope if different).
2. **Fill repo URLs** in `package.json`: Replace `your-username` in `repository`, `bugs`, and `homepage` with your GitHub/GitLab username or org.
3. **Login**: `npm login` (create account at [npmjs.com](https://www.npmjs.com/) if needed).
4. **Preview tarball**: `npm pack --dry-run` — only `server.js` and `README.md` are included (see `files` in package.json).
5. **Publish**: `npm publish --access public` (required for scoped packages to be installable by everyone).

After code changes: bump `version` (e.g. `npm version patch`) then `npm publish --access public`.

## License

ISC
