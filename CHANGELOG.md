# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-30

首发「Local foundation」版本。故意做得小，先把可运行边界做实。

### Added

- Python 控制面 + 浏览器 UI（`http://127.0.0.1:8765`）。
- SQLite 本地存储（macOS/Linux：`~/.agent-hub/agent-hub.db`；Windows：`%USERPROFILE%\.agent-hub\agent-hub.db`）。
- 原生 MCP 面 `http://127.0.0.1:8765/mcp`，暴露工具：
  - `agenthub_status`
  - `workspace_list`
  - `workspace_create`
- 一条命令启动：`uv run agent-hub`（自动创建环境并安装锁定依赖）。
- 默认只绑定 `127.0.0.1`；未显式设置 `AGENT_HUB_ALLOW_REMOTE=1` 前拒绝远程绑定。

### Notes

- 本版本为本地基础，非生产多租户服务，暂无鉴权。
- 旧的 Java 原型与历史迁移至 `agent-hub-java-legacy`（已归档）。
