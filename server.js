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

const toDateString = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const normalizeDate = (value, fallback) => {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }
  return value;
};

const contributionLevel = (count) => {
  if (count === 0) return 0;
  if (count < 10) return 1;
  if (count < 20) return 2;
  if (count <= 30) return 3;
  return 4;
};

const buildContributionActivity = (events, after, before) => {
  const counts = new Map();

  for (const event of events) {
    if (!event.created_at) continue;
    const date = event.created_at.slice(0, 10);
    counts.set(date, (counts.get(date) || 0) + 1);
  }

  const start = new Date(`${after}T00:00:00.000Z`);
  const end = new Date(`${before}T00:00:00.000Z`);
  const days = [];

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const date = toDateString(cursor);
    const count = counts.get(date) || 0;
    days.push({
      date,
      count,
      level: contributionLevel(count)
    });
  }

  const weeks = [];
  for (const day of days) {
    const dayOfWeek = new Date(`${day.date}T00:00:00.000Z`).getUTCDay();
    if (weeks.length === 0 || dayOfWeek === 0) {
      weeks.push([]);
    }
    weeks[weeks.length - 1].push(day);
  }

  return {
    total_contributions: days.reduce((sum, day) => sum + day.count, 0),
    days,
    weeks
  };
};

const getAuthenticatedUserId = async () => {
  const res = await api.get("/user");
  return res.data.id;
};

const addOptionalFields = (target, source, fields) => {
  for (const field of fields) {
    if (source[field] != null) target[field] = source[field];
  }
  return target;
};

const normalizeArray = (value) => {
  if (value == null) return value;
  return Array.isArray(value) ? value : [value];
};

// 定义 MCP 工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "list_projects", description: "List all GitLab projects", inputSchema: { type: "object" } },
    { name: "create_project", description: "Create a new GitLab project", inputSchema: { type: "object", properties: { name: { type: "string" }, path: { type: "string" }, namespace_id: { type: "number" }, description: { type: "string" }, visibility: { type: "string", description: "private, internal, or public" }, initialize_with_readme: { type: "boolean" }, default_branch: { type: "string" }, topics: { type: "array", items: { type: "string" } }, import_url: { type: "string" } }, required: ["name"] } },
    { name: "update_project", description: "Update an existing GitLab project (provide at least one field besides project_id)", inputSchema: { type: "object", properties: { project_id: { oneOf: [{ type: "number" }, { type: "string" }] }, name: { type: "string" }, path: { type: "string" }, description: { type: "string" }, visibility: { type: "string", description: "private, internal, or public" }, default_branch: { type: "string" }, topics: { type: "array", items: { type: "string" } }, archived: { type: "boolean" } }, required: ["project_id"] } },
    { name: "list_commits", description: "List commits of a project", inputSchema: { type: "object", properties: { project_id: { type: "number" } }, required: ["project_id"] } },
    { name: "get_contribution_activity", description: "Get a user's contribution heatmap activity aggregated by day. Defaults to the authenticated user and the last 12 months.", inputSchema: { type: "object", properties: { user_id: { oneOf: [{ type: "number" }, { type: "string" }], description: "GitLab user ID or username. If omitted, uses the authenticated user." }, after: { type: "string", description: "Start date in YYYY-MM-DD format. Defaults to 12 months ago." }, before: { type: "string", description: "End date in YYYY-MM-DD format. Defaults to today." }, action: { type: "string", description: "Optional GitLab event action filter, such as pushed, created, merged, closed, commented." }, target_type: { type: "string", description: "Optional GitLab event target type filter, such as issue, merge_request, note, project, snippet, milestone, user." }, include_events: { type: "boolean", description: "Include raw GitLab events in the response. Defaults to false." }, max_pages: { type: "number", description: "Maximum event pages to fetch at 100 events per page. Defaults to 20." } } } },
    { name: "get_file", description: "Get a file content", inputSchema: { type: "object", properties: { project_id: { type: "number" }, file_path: { type: "string" }, ref: { type: "string" } }, required: ["project_id","file_path","ref"] } },
    { name: "list_merge_requests", description: "List merge requests of a project", inputSchema: { type: "object", properties: { project_id: { type: "number" }, state: { type: "string" }, source_branch: { type: "string" }, target_branch: { type: "string" }, author_id: { type: "number" }, assignee_id: { type: "number" }, reviewer_id: { type: "number" }, labels: { type: "string" }, search: { type: "string" }, iids: { type: "array", items: { type: "number" } } }, required: ["project_id"] } },
    { name: "create_merge_request", description: "Create a merge request in a project", inputSchema: { type: "object", properties: { project_id: { type: "number" }, source_branch: { type: "string" }, target_branch: { type: "string" }, title: { type: "string" }, description: { type: "string" }, target_project_id: { type: "number" }, assignee_id: { type: "number" }, assignee_ids: { type: "array", items: { type: "number" } }, reviewer_ids: { type: "array", items: { type: "number" } }, labels: { type: "string" }, milestone_id: { type: "number" }, remove_source_branch: { type: "boolean" }, squash: { type: "boolean" }, allow_collaboration: { type: "boolean" }, draft: { type: "boolean" } }, required: ["project_id", "source_branch", "target_branch", "title"] } },
    { name: "get_merge_request", description: "Get a single merge request by project and MR IID", inputSchema: { type: "object", properties: { project_id: { type: "number" }, merge_request_iid: { type: "number" } }, required: ["project_id", "merge_request_iid"] } },
    { name: "update_merge_request", description: "Update a merge request (title, description, target_branch, state_event close/reopen, labels, assignees, reviewers, etc.)", inputSchema: { type: "object", properties: { project_id: { type: "number" }, merge_request_iid: { type: "number" }, target_branch: { type: "string" }, title: { type: "string" }, description: { type: "string" }, state_event: { type: "string" }, assignee_id: { type: "number" }, assignee_ids: { type: "array", items: { type: "number" } }, reviewer_ids: { type: "array", items: { type: "number" } }, labels: { type: "string" }, add_labels: { type: "string" }, remove_labels: { type: "string" }, milestone_id: { type: "number" }, remove_source_branch: { type: "boolean" }, squash: { type: "boolean" }, discussion_locked: { type: "boolean" }, allow_collaboration: { type: "boolean" } }, required: ["project_id", "merge_request_iid"] } },
    { name: "merge_merge_request", description: "Accept/merge a merge request", inputSchema: { type: "object", properties: { project_id: { type: "number" }, merge_request_iid: { type: "number" }, merge_commit_message: { type: "string" }, squash_commit_message: { type: "string" }, squash: { type: "boolean" }, should_remove_source_branch: { type: "boolean" }, auto_merge: { type: "boolean" }, merge_when_pipeline_succeeds: { type: "boolean", description: "Deprecated by GitLab 17.11; use auto_merge for newer GitLab versions." }, sha: { type: "string" } }, required: ["project_id", "merge_request_iid"] } },
    { name: "add_merge_request_note", description: "Add a comment/note to a merge request", inputSchema: { type: "object", properties: { project_id: { type: "number" }, merge_request_iid: { type: "number" }, body: { type: "string" } }, required: ["project_id", "merge_request_iid", "body"] } },
    { name: "list_merge_request_notes", description: "List notes/comments of a merge request", inputSchema: { type: "object", properties: { project_id: { type: "number" }, merge_request_iid: { type: "number" } }, required: ["project_id", "merge_request_iid"] } },
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
  const { name, arguments: rawArgs } = request.params;
  const args = rawArgs || {};

  try {
    if (name === "list_projects") {
      const res = await api.get("/projects?membership=true&per_page=100");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "create_project") {
      if (args.import_url && args.initialize_with_readme === true) {
        return { content: [{ type: "text", text: "Error: import_url and initialize_with_readme cannot both be set." }] };
      }
      const body = { name: args.name };
      addOptionalFields(body, args, ["path", "namespace_id", "description", "visibility", "initialize_with_readme", "default_branch", "import_url"]);
      if (args.topics != null) body.topics = normalizeArray(args.topics);
      const res = await api.post("/projects", body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "update_project") {
      const body = {};
      addOptionalFields(body, args, ["name", "path", "description", "visibility", "default_branch", "archived"]);
      if (args.topics != null) body.topics = normalizeArray(args.topics);
      if (Object.keys(body).length === 0) return { content: [{ type: "text", text: "Error: provide at least one field to update." }] };
      const res = await api.put(`/projects/${encodeURIComponent(args.project_id)}`, body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "list_commits") {
      const res = await api.get(`/projects/${args.project_id}/repository/commits`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "get_contribution_activity") {
      const today = new Date();
      const defaultBefore = toDateString(today);
      const defaultAfter = toDateString(addDays(today, -365));
      const after = normalizeDate(args.after, defaultAfter);
      const before = normalizeDate(args.before, defaultBefore);

      if (after > before) {
        return { content: [{ type: "text", text: "Error: after must be earlier than or equal to before." }] };
      }

      const userId = args.user_id != null && args.user_id !== "" ? args.user_id : await getAuthenticatedUserId();
      const requestedMaxPages = Number(args.max_pages ?? 20);
      if (!Number.isFinite(requestedMaxPages) || requestedMaxPages < 1) {
        return { content: [{ type: "text", text: "Error: max_pages must be a positive number." }] };
      }
      const maxPages = Math.min(Math.floor(requestedMaxPages), 100);
      const params = {
        after,
        before,
        sort: "asc",
        per_page: 100
      };
      if (args.action != null) params.action = args.action;
      if (args.target_type != null) params.target_type = args.target_type;

      const events = [];
      let page = 1;

      while (page <= maxPages) {
        const res = await api.get(`/users/${encodeURIComponent(userId)}/events`, {
          params: { ...params, page }
        });
        events.push(...res.data);

        const nextPage = res.headers["x-next-page"];
        if (!nextPage) break;
        page = Number(nextPage);
      }

      const activity = buildContributionActivity(events, after, before);
      const result = {
        user_id: userId,
        after,
        before,
        fetched_events: events.length,
        truncated: page > maxPages,
        ...activity
      };
      if (args.include_events === true) result.events = events;

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "get_file") {
      const res = await api.get(`/projects/${args.project_id}/repository/files/${encodeURIComponent(args.file_path)}`, { params: { ref: args.ref } });
      const decoded = Buffer.from(res.data.content, 'base64').toString();
      return { content: [{ type: "text", text: decoded }] };
    }

    if (name === "list_merge_requests") {
      const params = {};
      addOptionalFields(params, args, ["state", "source_branch", "target_branch", "author_id", "assignee_id", "reviewer_id", "labels", "search"]);
      if (args.iids != null && args.iids.length) params["iids[]"] = args.iids;
      const res = await api.get(`/projects/${args.project_id}/merge_requests`, { params });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "create_merge_request") {
      const body = {
        source_branch: args.source_branch,
        target_branch: args.target_branch,
        title: args.title
      };
      addOptionalFields(body, args, ["description", "target_project_id", "assignee_id", "labels", "milestone_id", "remove_source_branch", "squash", "allow_collaboration", "draft"]);
      if (args.assignee_ids != null) body.assignee_ids = normalizeArray(args.assignee_ids);
      if (args.reviewer_ids != null) body.reviewer_ids = normalizeArray(args.reviewer_ids);
      const res = await api.post(`/projects/${args.project_id}/merge_requests`, body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "get_merge_request") {
      const res = await api.get(`/projects/${args.project_id}/merge_requests/${args.merge_request_iid}`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "update_merge_request") {
      const body = {};
      addOptionalFields(body, args, ["target_branch", "title", "description", "state_event", "assignee_id", "labels", "add_labels", "remove_labels", "milestone_id", "remove_source_branch", "squash", "discussion_locked", "allow_collaboration"]);
      if (args.assignee_ids != null) body.assignee_ids = normalizeArray(args.assignee_ids);
      if (args.reviewer_ids != null) body.reviewer_ids = normalizeArray(args.reviewer_ids);
      if (Object.keys(body).length === 0) return { content: [{ type: "text", text: "Error: provide at least one field to update." }] };
      const res = await api.put(`/projects/${args.project_id}/merge_requests/${args.merge_request_iid}`, body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "merge_merge_request") {
      const body = {};
      addOptionalFields(body, args, ["merge_commit_message", "squash_commit_message", "squash", "should_remove_source_branch", "auto_merge", "merge_when_pipeline_succeeds", "sha"]);
      const res = await api.put(`/projects/${args.project_id}/merge_requests/${args.merge_request_iid}/merge`, body);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "add_merge_request_note") {
      const res = await api.post(`/projects/${args.project_id}/merge_requests/${args.merge_request_iid}/notes`, { body: args.body });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }

    if (name === "list_merge_request_notes") {
      const res = await api.get(`/projects/${args.project_id}/merge_requests/${args.merge_request_iid}/notes`);
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
      if (args.assignee_ids != null) body.assignee_ids = normalizeArray(args.assignee_ids);
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
      if (args.assignee_ids != null) body.assignee_ids = normalizeArray(args.assignee_ids);
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
