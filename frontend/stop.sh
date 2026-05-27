#!/bin/bash

# ============================================================
# stop.sh — 停止 Agent智能中台 前端服务
# 用法: ./stop.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

kill_by_port() {
  local port="$1"
  local pids

  pids=$(lsof -ti:"$port" 2>/dev/null) ||
  pids=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K\d+') ||
  pids=$(fuser "$port/tcp" 2>/dev/null) ||
  true

  if [ -z "$pids" ]; then
    return 1
  fi

  for pid in $pids; do
    log_warn "发现端口 $port 被进程 $pid 占用，正在终止..."
    kill -15 "$pid" 2>/dev/null || true
    sleep 1

    if kill -0 "$pid" 2>/dev/null; then
      log_warn "进程 $pid 未响应 SIGTERM，强制终止..."
      kill -9 "$pid" 2>/dev/null || true
      sleep 1
    fi

    if kill -0 "$pid" 2>/dev/null; then
      log_error "无法终止进程 $pid"
    else
      log_info "进程 $pid 已终止"
    fi
  done

  return 0
}

echo "=============================================="
echo "  Agent智能中台 — 停止前端服务"
echo "=============================================="
echo ""

STOPPED_ANY=false

# 停止 Vite 开发服务器 (端口 9001)
if kill_by_port "9001"; then
  STOPPED_ANY=true
else
  log_info "端口 9001 未被占用（Vite 开发服务器）"
fi

# 也检查旧端口 9002
if kill_by_port "9002"; then
  STOPPED_ANY=true
else
  log_info "端口 9002 未被占用"
fi

if [ "$STOPPED_ANY" = true ]; then
  log_info "前端服务已停止"
else
  log_info "没有正在运行的前端服务"
fi
