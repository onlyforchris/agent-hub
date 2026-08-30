from __future__ import annotations

import json
import os
from pathlib import Path

import uvicorn
from mcp.server import MCPServer
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse

from agent_hub import __version__
from agent_hub.store import WorkspaceStore


DATA_DIR = Path(os.getenv("AGENT_HUB_DATA_DIR", Path.home() / ".agent-hub"))
store = WorkspaceStore(DATA_DIR / "agent-hub.db")
store.initialize()

mcp = MCPServer(
    "Agent Hub",
    instructions="Manage local Agent Hub workspaces through a small, auditable MCP surface.",
)


@mcp.tool()
def agenthub_status() -> dict[str, object]:
    """Return the local Agent Hub version and workspace count."""
    return {"status": "ok", "version": __version__, "workspaces": len(store.list_workspaces())}


@mcp.tool()
def workspace_list() -> list[dict[str, str]]:
    """List local Agent Hub workspaces, newest first."""
    return store.list_workspaces()


@mcp.tool()
def workspace_create(name: str, description: str = "") -> dict[str, str]:
    """Create a local Agent Hub workspace."""
    return store.create_workspace(name, description)


@mcp.custom_route("/", methods=["GET"])
async def home(_: Request) -> HTMLResponse:
    return HTMLResponse(HOME_PAGE)


@mcp.custom_route("/api/health", methods=["GET"])
async def health(_: Request) -> JSONResponse:
    return JSONResponse(agenthub_status())


@mcp.custom_route("/api/workspaces", methods=["GET", "POST"])
async def workspaces(request: Request) -> JSONResponse:
    if request.method == "GET":
        return JSONResponse(store.list_workspaces())
    try:
        payload = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JSONResponse({"error": "请求体必须是 JSON"}, status_code=400)
    if not isinstance(payload, dict):
        return JSONResponse({"error": "请求体必须是 JSON 对象"}, status_code=400)
    try:
        workspace = store.create_workspace(
            str(payload.get("name", "")), str(payload.get("description", ""))
        )
    except ValueError as error:
        return JSONResponse({"error": str(error)}, status_code=400)
    return JSONResponse(workspace, status_code=201)


app = mcp.streamable_http_app()


def main() -> None:
    host = os.getenv("AGENT_HUB_HOST", "127.0.0.1")
    if host not in {"127.0.0.1", "localhost", "::1"} and os.getenv("AGENT_HUB_ALLOW_REMOTE") != "1":
        raise SystemExit("拒绝无认证的远程监听；确认风险后设置 AGENT_HUB_ALLOW_REMOTE=1")
    try:
        port = int(os.getenv("AGENT_HUB_PORT", "8765"))
    except ValueError:
        raise SystemExit("AGENT_HUB_PORT 必须是整数") from None
    if not 1 <= port <= 65535:
        raise SystemExit("AGENT_HUB_PORT 必须在 1–65535 之间")
    uvicorn.run("agent_hub.app:app", host=host, port=port)


HOME_PAGE = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Agent Hub</title>
  <style>
    :root {
      --ink: #17211d; --muted: #5e6862; --paper: #f7f3ea; --surface: #fffdf8;
      --line: #ded8ca; --brand: #c84f2d; --brand-dark: #9f351b; --forest: #23483b;
      --forest-soft: #dce9df; --focus: #2563eb; --danger: #a31d1d;
      --shadow: 0 20px 60px rgba(36, 43, 38, .09); --radius: 18px;
    }
    * { box-sizing: border-box; }
    html { min-width: 320px; background: var(--paper); }
    body { margin: 0; min-height: 100vh; overflow-x: hidden; color: var(--ink); background:
      radial-gradient(circle at 85% 8%, rgba(200,79,45,.13), transparent 28rem),
      linear-gradient(rgba(35,72,59,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(35,72,59,.035) 1px, transparent 1px), var(--paper);
      background-size: auto, 32px 32px, 32px 32px, auto;
      font: 16px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    button, input, textarea { font: inherit; }
    button { cursor: pointer; touch-action: manipulation; }
    .skip { position: fixed; left: 16px; top: -60px; z-index: 20; padding: 10px 14px; color: white; background: var(--ink); }
    .skip:focus { top: 16px; }
    :focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
    .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 32px 0 64px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 44px; }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 19px; font-weight: 760; letter-spacing: -.02em; }
    .mark { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 14px; color: white; background: var(--forest); box-shadow: 0 8px 24px rgba(35,72,59,.2); }
    .mark svg { width: 23px; height: 23px; }
    .instance { display: flex; align-items: center; gap: 9px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); background: rgba(255,253,248,.8); font-size: 14px; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #2c825a; box-shadow: 0 0 0 5px rgba(44,130,90,.12); animation: breathe 2.6s ease-in-out infinite; }
    @keyframes breathe { 50% { box-shadow: 0 0 0 8px rgba(44,130,90,0); } }
    .hero { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .6fr); gap: 28px; align-items: end; margin-bottom: 32px; }
    .hero > *, .grid > * { min-width: 0; }
    .eyebrow { margin: 0 0 12px; color: var(--brand-dark); font-size: 13px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
    h1 { max-width: 760px; margin: 0; font-family: Georgia, "Noto Serif SC", serif; font-size: clamp(38px, 6vw, 72px); line-height: .99; letter-spacing: -.045em; font-weight: 600; }
    .intro { max-width: 640px; margin: 22px 0 0; color: var(--muted); font-size: 18px; }
    .note { position: relative; width: 100%; max-width: 100%; padding: 22px; overflow: hidden; color: white; background: var(--forest); border-radius: var(--radius); box-shadow: var(--shadow); }
    .note::after { content: ""; position: absolute; width: 110px; height: 110px; right: -36px; bottom: -44px; border: 22px solid rgba(255,255,255,.08); border-radius: 50%; }
    .note small { color: #c9ddd2; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .note strong { display: block; margin: 10px 0 6px; font-size: 23px; }
    .note p { position: relative; z-index: 1; margin: 0; color: #dce9e1; }
    .grid { display: grid; grid-template-columns: minmax(300px, .7fr) minmax(0, 1.3fr); gap: 24px; align-items: start; }
    .card { border: 1px solid var(--line); border-radius: var(--radius); background: rgba(255,253,248,.92); box-shadow: var(--shadow); }
    .form-card { padding: 26px; }
    .card-head { display: flex; justify-content: space-between; align-items: start; gap: 20px; padding: 25px 26px 20px; border-bottom: 1px solid var(--line); }
    h2 { margin: 0; font-size: 20px; letter-spacing: -.02em; }
    .sub { margin: 5px 0 0; color: var(--muted); font-size: 14px; }
    label { display: block; margin: 20px 0 7px; font-size: 14px; font-weight: 700; }
    input, textarea { width: 100%; min-height: 46px; padding: 11px 13px; color: var(--ink); border: 1px solid #c9c2b4; border-radius: 11px; background: white; transition: border-color .18s, box-shadow .18s; }
    textarea { min-height: 100px; resize: vertical; }
    input:focus, textarea:focus { border-color: var(--forest); box-shadow: 0 0 0 3px rgba(35,72,59,.12); outline: none; }
    .help { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
    .primary { width: 100%; min-height: 48px; margin-top: 22px; border: 0; border-radius: 11px; color: white; background: var(--brand); font-weight: 750; transition: background .18s, transform .18s; }
    .primary:hover { background: var(--brand-dark); }
    .primary:active { transform: translateY(1px); }
    .primary:disabled { cursor: wait; opacity: .55; }
    .feedback { min-height: 24px; margin: 10px 0 0; color: var(--danger); font-size: 14px; }
    .count { display: grid; place-items: center; min-width: 42px; height: 42px; border-radius: 12px; color: var(--forest); background: var(--forest-soft); font-variant-numeric: tabular-nums; font-weight: 800; }
    .workspace-list { margin: 0; padding: 0 26px; list-style: none; }
    .workspace { display: grid; grid-template-columns: 44px 1fr auto; gap: 14px; align-items: center; padding: 20px 0; border-bottom: 1px solid var(--line); }
    .workspace:last-child { border-bottom: 0; }
    .initial { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 13px; color: var(--brand-dark); background: #f5e3d9; font: 700 19px Georgia, serif; }
    .workspace strong { display: block; overflow-wrap: anywhere; }
    .workspace p { margin: 3px 0 0; color: var(--muted); font-size: 14px; overflow-wrap: anywhere; }
    time { color: var(--muted); font-size: 12px; white-space: nowrap; }
    .empty { padding: 44px 24px 48px; color: var(--muted); text-align: center; }
    .empty strong { display: block; margin-bottom: 6px; color: var(--ink); }
    footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 26px; color: var(--muted); font-size: 13px; }
    code { padding: 2px 6px; border-radius: 5px; color: var(--forest); background: var(--forest-soft); font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
    @media (max-width: 820px) { .hero, .grid { grid-template-columns: 1fr; } .note { max-width: 520px; } }
    @media (max-width: 560px) { .shell { width: min(100% - 28px, 1180px); padding-top: 20px; } header { margin-bottom: 34px; } .instance span:last-child { display: none; } h1 { font-size: 43px; } .intro { font-size: 16px; } .form-card, .card-head { padding: 21px; } .workspace-list { padding: 0 21px; } .workspace { grid-template-columns: 40px 1fr; } time { grid-column: 2; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition-duration: .01ms !important; } }
  </style>
</head>
<body>
  <a class="skip" href="#main">跳到主要内容</a>
  <div class="shell">
    <header>
      <div class="brand"><span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7.5 12 3l7 4.5v9L12 21l-7-4.5v-9Z" stroke="currentColor" stroke-width="1.7"/><path d="m8.5 10 3.5 2 3.5-2M12 12v4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>Agent Hub</div>
      <div class="instance"><span class="pulse" aria-hidden="true"></span><span>本地实例</span><span>运行中</span></div>
    </header>
    <main id="main">
      <section class="hero" aria-labelledby="hero-title">
        <div><p class="eyebrow">Local-first · Enterprise-ready foundation</p><h1 id="hero-title">让 Agent 工作，<br>让边界清晰。</h1><p class="intro">一个安静、可控的企业 Agent 工作台。工作区、运行时与工具连接都从本地开始，数据留在你选择的位置。</p></div>
        <aside class="note"><small>Runtime bridge</small><strong>MCP 已就绪</strong><p>DeepSeek Harness 可通过 <code>/mcp</code> 接入当前实例。</p></aside>
      </section>
      <section class="grid" aria-label="工作区管理">
        <form class="card form-card" id="create-form">
          <h2>新建工作区</h2><p class="sub">先用一个明确的业务边界组织 Agent。</p>
          <label for="name">名称 <span aria-hidden="true">*</span></label><input id="name" name="name" maxlength="80" required autocomplete="off" placeholder="例如：Finance Ops">
          <label for="description">用途</label><textarea id="description" name="description" maxlength="500" placeholder="这个工作区负责什么？"></textarea><p class="help">最多 500 个字符，可稍后补充。</p>
          <button class="primary" id="submit" type="submit">创建工作区</button><p class="feedback" id="feedback" aria-live="polite"></p>
        </form>
        <div class="card">
          <div class="card-head"><div><h2>你的工作区</h2><p class="sub">数据保存在当前设备的 SQLite 中。</p></div><span class="count" id="count" aria-label="工作区数量">0</span></div>
          <ul class="workspace-list" id="workspace-list"><li class="empty">正在读取…</li></ul>
        </div>
      </section>
    </main>
    <footer><span>Agent Hub v0.1 · local foundation</span><span>MCP endpoint <code>http://127.0.0.1:8765/mcp</code></span></footer>
  </div>
  <script>
    const list = document.querySelector('#workspace-list');
    const count = document.querySelector('#count');
    const form = document.querySelector('#create-form');
    const submit = document.querySelector('#submit');
    const feedback = document.querySelector('#feedback');
    const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
    function render(items) {
      count.textContent = items.length;
      list.innerHTML = items.length ? items.map(item => `<li class="workspace"><span class="initial" aria-hidden="true">${escapeHtml(item.name.slice(0,1).toUpperCase())}</span><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description || '尚未填写用途')}</p></div><time datetime="${escapeHtml(item.created_at)}">${new Date(item.created_at).toLocaleDateString('zh-CN')}</time></li>`).join('') : '<li class="empty"><strong>这里还很安静</strong>创建第一个工作区，开始组织你的 Agent。</li>';
    }
    async function load() {
      try { const response = await fetch('/api/workspaces'); if (!response.ok) throw new Error('读取失败'); render(await response.json()); }
      catch (_) { list.innerHTML = '<li class="empty"><strong>暂时无法读取</strong>请确认本地服务仍在运行后刷新页面。</li>'; }
    }
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true; submit.textContent = '创建中…'; feedback.textContent = '';
      try {
        const response = await fetch('/api/workspaces', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:form.name.value, description:form.description.value})});
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '创建失败');
        form.reset(); feedback.style.color = '#246b49'; feedback.textContent = `“${data.name}”已创建`; await load(); form.name.focus();
      } catch (error) { feedback.style.color = 'var(--danger)'; feedback.textContent = `${error.message}，请修改后重试。`; }
      finally { submit.disabled = false; submit.textContent = '创建工作区'; }
    });
    load();
  </script>
</body>
</html>"""


if __name__ == "__main__":
    main()
