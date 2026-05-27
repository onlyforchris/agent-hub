# TAI Agent Hub POC (V3)

Agent 中台 + 对账治理 Agent POC（演示脱敏版）。

POC 内置真实的 Agent Runtime（不是查表 Mock）：
1. 接收差异（Connector Hub → DiffRecord）
2. Planner 按规则路由到 Skill
3. Skill Executor 按 DSL 顺序调用 Tool
4. Tool 通过 Connector Hub 从 fixture 取数（模拟 DMS/SAP/帆软/主数据）
5. 规则引擎 Tool 完成确定性比对
6. Model Gateway 接收脱敏摘要生成报告（无 Key 时使用兜底模板）
7. 复核路由 + 全过程写入 Run/Step Trace（可在前端 Trace 页回放）

## 目录结构

```
tai-agent-hub/
├── server.ts                       # 路由层，调用 runAgent()
├── agent/                          # Agent 中台核心
│   ├── runtime/                    # Runtime: types/planner/executor/runtime/trace
│   ├── skills/                     # 3 个 Skill DSL（TypeScript 形式）
│   ├── tools/                      # Tool Registry（9 个 Tool）
│   ├── connectors/                 # Connector Hub
│   │   └── fixtures/*.json         # 6 个 mock 数据集
│   ├── model/                      # Model Gateway（脱敏 + Gemini + 兜底）
│   └── agents/                     # 对账治理 Agent 定义
└── src/                            # React 前端
    ├── App.tsx                     # 侧边栏 + 9 个 Tab
    └── components/views/           # Dashboard/Agents/Models/Skills/Tools/Data/
                                    # Notifications/Rbac + Tasks + Runs
```

## API 总览

| 接口 | 说明 |
| --- | --- |
| `GET  /api/healthz`        | 运行模式 + Agent/Skill/Tool 数量 |
| `GET  /api/poc-readiness`  | POC 边界与上线前缺口 |
| `GET  /api/agents`         | 场景 Agent 元数据 |
| `GET  /api/skills`         | Skill 列表（含步骤摘要） |
| `GET  /api/tools`          | Tool Registry（含 Schema / 数据敏感度 / 副作用） |
| `GET  /api/differences`    | 差异清单（Connector Hub 返回） |
| `POST /api/analyze`        | 触发 Agent 归因，返回 Run 摘要 |
| `GET  /api/runs`           | 列出最近 Run |
| `GET  /api/runs/:id`       | Run 详情（含所有 Step、Tool 输入/输出、规则命中） |

## Implemented Scope

- React + Vite front end for the Agent workbench and platform capability pages（开发端口 9001，Vite proxy 转发 /api 到 API 服务器）。
- Express API server（端口 9002，生产模式同时 serve 前端静态资源）。
- Full Agent Runtime in `agent/runtime/`（Planner / Executor / Trace store）。
- 3 个真实 Skill：`same_settlement_multiple_mdmid`、`revenue_amount_doubled`、`sap_dms_status_mismatch`。
- 9 个 Tool（6 个 data_query + 3 个 rule），全部 `side_effect=none`，对外只读。
- 前端新增「Agent 执行追踪」与「Tool 注册中心」两个视图；旧 dead code 已清理。
- Model Gateway 支持 DeepSeek V4 Flash（默认）和 Qwen（DashScope 兼容 OpenAI 模式），两者 Key 均未配置时自动降级到确定性兜底模板。

## Boundary

This demo does not connect to production SAP, DMS, or Finereport. It does not parse real Excel files, store sessions permanently, repair business data, post accounting entries, or replace SAP/DMS/Finereport.

Before a customer pilot or production technical review, implement:

- Enterprise SSO and authoritative RBAC source.
- Read-only SAP/DMS/Finereport connectors.
- Model gateway with desensitization, provider routing, audit logs, rate limits, and prompt/version governance.
- Persistent storage for Agent configs, analysis sessions, evidence chains, and review feedback.
- Notification or ticketing connector for human follow-up.

## Security Notes

- Model API keys are read only on the server from environment variables.
- Do not expose `DEEPSEEK_API_KEY` / `QWEN_API_KEY` through Vite client environment variables.
- Model prompts use desensitized summaries; raw business evidence should remain inside the platform.
- Production deployment must add auth middleware, request audit logging, and connector-level least-privilege permissions.

## Run Locally

Prerequisite: Node.js 18+ is required, 22+ recommended.

```bash
npm install
npm run dev
```

前端开发服务器 `http://localhost:9001`，API 服务器 `http://localhost:9002`。
前端 `/api` 请求自动通过 Vite proxy 转发到 API 服务器。

### 单独启动

```bash
npm run dev:web    # 仅启动前端 Vite 开发服务器（端口 9001）
npm run dev:api    # 仅启动 API 服务器（端口 9002）
```

### 环境变量配置

```bash
cp .env.example .env
# 编辑 .env 填入真实配置
```

| 变量 | 说明 | 示例 |
|------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（POC 默认 Provider）；不配置则尝试 Qwen，否则降级兜底模板 | `sk-...` |
| `DEEPSEEK_MODEL` | DeepSeek 模型名（可选） | `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | DeepSeek BaseUrl（可选） | `https://api.deepseek.com/v1` |
| `QWEN_API_KEY` | 阿里云 DashScope API 密钥（OpenAI 兼容模式） | `sk-...` |
| `QWEN_MODEL` | Qwen 模型名（可选） | `qwen-max` |
| `QWEN_BASE_URL` | Qwen BaseUrl（可选） | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `MODEL_PROVIDER` | 强制指定：`deepseek` / `qwen` / `auto`（默认） | `auto` |
| `PORT` | API 服务器端口（可选） | `9002` |

## Build And Start

```bash
npm run build    # TypeScript 检查 + Vite 打包前端 + esbuild 打包服务端
npm start        # 生产模式启动（端口 9002，同时 serve 前端静态资源）
```

## 操作示例

### 本地开发

```bash
# 启动开发环境（前端 + API 并行运行）
npm run dev

# 仅前端
npm run dev:web

# 类型检查
npm run lint

# 构建
npm run build

# 生产启动
NODE_ENV=production npm start
```

### 验证服务

```bash
# 健康检查
curl http://localhost:9002/api/healthz

# POC 就绪状态
curl http://localhost:9002/api/poc-readiness

# 获取差异清单
curl http://localhost:9002/api/differences

# 提交归因分析
curl -X POST http://localhost:9002/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"diffId":"DIFF001","billNo":"TCH202604160001","type":"MDM_ID_ANOMALY"}'
```

### 使用启停脚本

```bash
# 启动（默认端口 9002）
./start.sh

# 启动（指定端口）
./start.sh 8080

# 停止
./stop.sh

# 停止（指定端口）
./stop.sh 8080

# 查看运行日志
tail -f logs/app.log
```

## 服务器部署教程

### 1. 环境准备

目标服务器需安装以下依赖：

```bash
# CentOS / RHEL
sudo yum install -y curl lsof

# Ubuntu / Debian
sudo apt install -y curl lsof
```

安装 Node.js 18+（推荐使用 nvm 管理版本）：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 验证
node -v   # 应 >= 18
npm -v
```

### 2. 上传代码

```bash
# 方式一: git clone
git clone <repo-url> /opt/tai-agent-hub
cd /opt/tai-agent-hub

# 方式二: scp 上传
scp -r ./tai-agent-hub user@server:/opt/
ssh user@server
cd /opt/tai-agent-hub
```

### 3. 配置环境变量

```bash
cp .env.example .env
vim .env
```

编辑 `.env`，至少填入其中一个模型 Key（两者都为空时使用本地兜底模板）：

```ini
# 二选一即可（同时配置时按 MODEL_PROVIDER 决定，默认优先 DeepSeek）
DEEPSEEK_API_KEY="你的真实 DeepSeek API Key"
QWEN_API_KEY="你的真实阿里云 DashScope API Key"
PORT=9002
```

### 4. 赋予脚本执行权限

```bash
chmod +x start.sh stop.sh
```

### 5. 启动服务

```bash
# 首次启动会自动 npm install 并构建
./start.sh

# 或指定端口
./start.sh 9002
```

`start.sh` 会自动完成：
1. 检查 Node.js / npm 版本
2. 检查并释放目标端口
3. 清理旧进程
4. 检查 `.env` 配置
5. 构建项目
6. 后台启动服务并写入 PID 文件

启动成功后输出示例：

```
==============================================
  Agent智能中台 已启动
==============================================
  端口:     9002
  PID:      12345
  日志:     logs/app.log
  访问:     http://localhost:9002
  停止:     ./stop.sh 9002
  查看日志: tail -f logs/app.log
==============================================
```

### 6. 验证部署

```bash
# 检查服务是否运行
curl http://localhost:9002/api/healthz
# 返回: {"ok":true,"mode":"production",...}

# 检查前端页面
curl -s http://localhost:9002/ | head -5
```

### 7. 日常运维

```bash
# 查看实时日志
tail -f logs/app.log

# 停止服务
./stop.sh

# 更新代码后重启
git pull
./stop.sh
./start.sh

# 查看进程状态
ps aux | grep "node dist/server.cjs"

# 查看端口监听
lsof -i:9002
```

### 8. 配置开机自启（可选）

使用 systemd 管理服务：

```bash
sudo cat > /etc/systemd/system/tai-agent-hub.service << 'EOF'
[Unit]
Description=Agent智能中台
After=network.target

[Service]
Type=simple
User=www
WorkingDirectory=/opt/tai-agent-hub
Environment=NODE_ENV=production
Environment=PORT=9002
ExecStart=/usr/bin/node dist/server.cjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tai-agent-hub
sudo systemctl start tai-agent-hub

# 常用命令
sudo systemctl status tai-agent-hub
sudo systemctl stop tai-agent-hub
sudo systemctl restart tai-agent-hub
sudo journalctl -u tai-agent-hub -f
```

### 9. 配置 Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:9002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Review Checklist

- `npm run build`
- `npm start`（默认端口 9002）
- `GET  http://localhost:9002/api/healthz`
- `GET  http://localhost:9002/api/poc-readiness`
- `GET  http://localhost:9002/api/differences`
- `POST http://localhost:9002/api/analyze`
