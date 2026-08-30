# Agent Hub

Local-first enterprise Agent platform powered by DeepSeek Harness.

Agent Hub is being rebuilt as a Python control plane with a browser UI, SQLite storage, and a native MCP surface. The first release is intentionally small: it proves the deployment shape and the connection boundary before adding orchestration.

## Run locally

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/).

```powershell
uv sync
uv run agent-hub
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765). Local data is stored in `%USERPROFILE%\.agent-hub\agent-hub.db` by default.

## Connect DeepSeek Harness

Add [`examples/dsh.cordis.yml`](examples/dsh.cordis.yml) to your DSH profile, then start Agent Hub before the Harness runtime. The MCP endpoint is:

```text
http://127.0.0.1:8765/mcp
```

Available MCP tools:

- `agenthub_status`
- `workspace_list`
- `workspace_create`

## Current boundary

This is a local foundation, not a production multi-tenant service. It binds to `127.0.0.1` by default and has no authentication yet. Remote binding is refused unless `AGENT_HUB_ALLOW_REMOTE=1` is explicitly set.

The previous Java prototype and its history live in [`agent-hub-java-legacy`](https://github.com/onlyforchris/agent-hub-java-legacy).

## Check

```powershell
uv run python -m unittest discover -s tests -v
```

MIT © Chris
