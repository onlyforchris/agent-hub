#!/bin/bash
set -e

# ============================================================
# start.sh — 启动 Agent智能中台 前端开发服务
# 用法: ./start.sh
# 默认端口: 9001 (Vite 开发服务器)
#
# 后端 API 代理目标: ${VITE_API_TARGET:-http://127.0.0.1:8066}
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---- 打印横幅 ----
echo ""
echo "=============================================="
echo "  Agent智能中台 — 启动前端服务"
echo "=============================================="
echo ""

# ============================================================
# Step 1: 检查环境依赖
# ============================================================
log_info ">>> Step 1/3: 检查环境依赖"

if ! command -v node &>/dev/null; then
  log_error "未找到 Node.js，请先安装 Node.js >= 18"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
log_info "Node.js 版本: $(node -v)"
if [ "$NODE_VERSION" -lt 18 ]; then
  log_error "Node.js 版本过低（当前 $(node -v)），需要 >= 18"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  log_error "未找到 npm"
  exit 1
fi
log_info "npm 版本: $(npm -v)"

if [ ! -d "node_modules" ]; then
  log_warn "node_modules 不存在，正在安装依赖..."
  npm install
fi

log_info "环境依赖检查通过"

# ============================================================
# Step 2: 检查后端服务
# ============================================================
API_TARGET="${VITE_API_TARGET:-http://127.0.0.1:8066}"
log_info ">>> Step 2/3: 检查后端服务 ($API_TARGET)"

if command -v curl &>/dev/null; then
  if curl -s -o /dev/null -w "%{http_code}" "$API_TARGET/actuator/health" 2>/dev/null | grep -q "200"; then
    log_info "后端服务连接正常"
  else
    log_warn "后端服务 ($API_TARGET) 无法访问，请先启动后端服务"
  fi
else
  log_warn "未安装 curl，跳过后端服务检查"
fi

# ============================================================
# Step 3: 启动 Vite 开发服务器
# ============================================================
log_info ">>> Step 3/3: 启动 Vite 开发服务器 (端口 9001)"

echo ""
echo "=============================================="
echo "  前端服务启动中..."
echo "=============================================="
echo "  前端地址:   http://localhost:9001"
echo "  API 代理:   $API_TARGET"
echo "  停止服务:   Ctrl+C"
echo "=============================================="
echo ""

npx vite
