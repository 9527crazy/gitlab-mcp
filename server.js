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
    { name: "list_issues", description: "List issues of project", inputSchema: { type: "object", properties: { project_id: { type: "number" } }, required: ["project_id"] } }
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
      const res = await api.get(`/projects/${args.project_id}/issues`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    return { content: [{ type: "text", text: "Tool not implemented" }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }] };
  }
});

// 启动 MCP server
const transport = new StdioServerTransport();
await server.connect(transport);
console.log("GitLab MCP Server started.");