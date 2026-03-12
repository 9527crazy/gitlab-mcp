#!/usr/bin/env node
// server.js
import axios from "axios";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// 配置 GitLab URL 和 Token（发布到 npm 后需通过环境变量配置，不设默认 token）
const GITLAB_URL = process.env.GITLAB_URL || "https://gitlab.com";
const TOKEN = process.env.GITLAB_TOKEN || "";

if (!TOKEN) {
  console.error("Error: GITLAB_TOKEN is required. Set it in your environment or MCP client config.");
  process.exit(1);
}

const api = axios.create({
  baseURL: `${GITLAB_URL}/api/v4`,
  headers: {
    "PRIVATE-TOKEN": TOKEN
  }
});

const server = new Server(
  { name: "gitlab-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 定义 MCP 工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "list_projects", description: "List all GitLab projects", inputSchema: { type: "object" } },
    { name: "list_commits", description: "List commits of a project", inputSchema: { type: "object", properties: { project_id: { type: "number" } }, required: ["project_id"] } },
    { name: "get_file", description: "Get a file content", inputSchema: { type: "object", properties: { project_id: { type: "number" }, file_path: { type: "string" }, ref: { type: "string" } }, required: ["project_id","file_path","ref"] } },
    { name: "list_merge_requests", description: "List MR of project", inputSchema: { type: "object", properties: { project_id: { type: "number" } }, required: ["project_id"] } },
    { name: "list_issues", description: "List issues of project", inputSchema: { type: "object", properties: { project_id: { type: "number" }, state: { type: "string" }, labels: { type: "string" }, iids: { type: "array", items: { type: "number" } } }, required: ["project_id"] } },
    { name: "create_issue", description: "Create an issue in a project", inputSchema: { type: "object", properties: { project_id: { type: "number" }, title: { type: "string" }, description: { type: "string" }, labels: { type: "string" }, assignee_ids: { type: "array", items: { type: "number" } }, due_date: { type: "string" }, confidential: { type: "boolean" }, issue_type: { type: "string" } }, required: ["project_id", "title"] } },
    { name: "get_issue", description: "Get a single issue by project and issue IID", inputSchema: { type: "object", properties: { project_id: { type: "number" }, issue_iid: { type: "number" } }, required: ["project_id", "issue_iid"] } },
    { name: "update_issue", description: "Update an issue (title, description, state_event close/reopen, labels, assignees, etc.)", inputSchema: { type: "object", properties: { project_id: { type: "number" }, issue_iid: { type: "number" }, title: { type: "string" }, description: { type: "string" }, state_event: { type: "string" }, labels: { type: "string" }, add_labels: { type: "string" }, remove_labels: { type: "string" }, assignee_ids: { type: "array", items: { type: "number" } }, due_date: { type: "string" }, milestone_id: { type: "number" }, confidential: { type: "boolean" }, discussion_locked: { type: "boolean" }, issue_type: { type: "string" } }, required: ["project_id", "issue_iid"] } },
    { name: "delete_issue", description: "Delete an issue from a project", inputSchema: { type: "object", properties: { project_id: { type: "number" }, issue_iid: { type: "number" } }, required: ["project_id", "issue_iid"] } },
    { name: "add_issue_note", description: "Add a comment/note to an issue", inputSchema: { type: "object", properties: { project_id: { type: "number" }, issue_iid: { type: "number" }, body: { type: "string" } }, required: ["project_id", "issue_iid", "body"] } },
    { name: "list_issue_notes", description: "List notes/comments of an issue", inputSchema: { type: "object", properties: { project_id: { type: "number" }, issue_iid: { type: "number" } }, required: ["project_id", "issue_iid"] } },
    { name: "list_wiki_pages", description: "List all wiki pages of a project", inputSchema: { type: "object", properties: { project_id: { type: "number" }, with_content: { type: "boolean" } }, required: ["project_id"] } },
    { name: "get_wiki_page", description: "Get a single wiki page by slug", inputSchema: { type: "object", properties: { project_id: { type: "number" }, slug: { type: "string" }, render_html: { type: "boolean" }, version: { type: "string" } }, required: ["project_id", "slug"] } },
    { name: "create_wiki_page", description: "Create a new wiki page", inputSchema: { type: "object", properties: { project_id: { type: "number" }, title: { type: "string" }, content: { type: "string" }, format: { type: "string" } }, required: ["project_id", "title", "content"] } },
    { name: "update_wiki_page", description: "Update an existing wiki page (provide at least title or content)", inputSchema: { type: "object", properties: { project_id: { type: "number" }, slug: { type: "string" }, title: { type: "string" }, content: { type: "string" }, format: { type: "string" } }, required: ["project_id", "slug"] } },
    { name: "delete_wiki_page", description: "Delete a wiki page", inputSchema: { type: "object", properties: { project_id: { type: "number" }, slug: { type: "string" } }, required: ["project_id", "slug"] } }
  ]
}));

// MCP 调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_projects") {
      const res = await api.get("/projects?membership=true&per_page=100");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "list_commits") {
      const res = await api.get(`/projects/${args.project_id}/repository/commits`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "get_file") {
      const res = await api.get(`/projects/${args.project_id}/repository/files/${encodeURIComponent(args.file_path)}`, { params: { ref: args.ref } });
      const decoded = Buffer.from(res.data.content, 'base64').toString();
      return { content: [{ type: "text", text: decoded }] };
    }

    if (name === "list_merge_requests") {
      const res = await api.get(`/projects/${args.project_id}/merge_requests`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "list_issues") {
      const params = {};
      if (args.state != null) params.state = args.state;
      if (args.labels != null) params.labels = args.labels;
      if (args.iids != null && args.iids.length) params["iids[]"] = args.iids;
      const res = await api.get(`/projects/${args.project_id}/issues`, { params });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "create_issue") {
      const body = { title: args.title };
      if (args.description != null) body.description = args.description;
      if (args.labels != null) body.labels = args.labels;
      if (args.assignee_ids != null) body.assignee_ids = Array.isArray(args.assignee_ids) ? args.assignee_ids : [args.assignee_ids];
      if (args.due_date != null) body.due_date = args.due_date;
      if (args.confidential != null) body.confidential = args.confidential;
      if (args.issue_type != null) body.issue_type = args.issue_type;
      const res = await api.post(`/projects/${args.project_id}/issues`, body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "get_issue") {
      const res = await api.get(`/projects/${args.project_id}/issues/${args.issue_iid}`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "update_issue") {
      const body = {};
      if (args.title != null) body.title = args.title;
      if (args.description != null) body.description = args.description;
      if (args.state_event != null) body.state_event = args.state_event;
      if (args.labels != null) body.labels = args.labels;
      if (args.add_labels != null) body.add_labels = args.add_labels;
      if (args.remove_labels != null) body.remove_labels = args.remove_labels;
      if (args.assignee_ids != null) body.assignee_ids = Array.isArray(args.assignee_ids) ? args.assignee_ids : [args.assignee_ids];
      if (args.due_date != null) body.due_date = args.due_date;
      if (args.milestone_id != null) body.milestone_id = args.milestone_id;
      if (args.confidential != null) body.confidential = args.confidential;
      if (args.discussion_locked != null) body.discussion_locked = args.discussion_locked;
      if (args.issue_type != null) body.issue_type = args.issue_type;
      const res = await api.put(`/projects/${args.project_id}/issues/${args.issue_iid}`, body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "delete_issue") {
      await api.delete(`/projects/${args.project_id}/issues/${args.issue_iid}`);
      return { content: [{ type: "text", text: "Issue deleted successfully." }] };
    }

    if (name === "add_issue_note") {
      const res = await api.post(`/projects/${args.project_id}/issues/${args.issue_iid}/notes`, { body: args.body });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "list_issue_notes") {
      const res = await api.get(`/projects/${args.project_id}/issues/${args.issue_iid}/notes`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "list_wiki_pages") {
      const params = {};
      if (args.with_content != null) params.with_content = args.with_content;
      const res = await api.get(`/projects/${encodeURIComponent(args.project_id)}/wikis`, { params });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "get_wiki_page") {
      const params = {};
      if (args.render_html != null) params.render_html = args.render_html;
      if (args.version != null) params.version = args.version;
      const res = await api.get(`/projects/${encodeURIComponent(args.project_id)}/wikis/${encodeURIComponent(args.slug)}`, { params });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "create_wiki_page") {
      const body = { title: args.title, content: args.content };
      if (args.format != null) body.format = args.format;
      const res = await api.post(`/projects/${encodeURIComponent(args.project_id)}/wikis`, body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "update_wiki_page") {
      const body = {};
      if (args.title != null) body.title = args.title;
      if (args.content != null) body.content = args.content;
      if (args.format != null) body.format = args.format;
      if (Object.keys(body).length === 0) return { content: [{ type: "text", text: "Error: provide at least title or content to update." }] };
      const res = await api.put(`/projects/${encodeURIComponent(args.project_id)}/wikis/${encodeURIComponent(args.slug)}`, body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "delete_wiki_page") {
      await api.delete(`/projects/${encodeURIComponent(args.project_id)}/wikis/${encodeURIComponent(args.slug)}`);
      return { content: [{ type: "text", text: "Wiki page deleted successfully." }] };
    }

    return { content: [{ type: "text", text: "Tool not implemented" }] };
  } catch (e) {
    const errMsg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    return { content: [{ type: "text", text: `Error: ${errMsg}` }] };
  }
});

// 启动 MCP server
const transport = new StdioServerTransport();
await server.connect(transport);
console.log("GitLab MCP Server started.");