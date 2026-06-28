#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "  Công cụ Tài chính Nam Thăng Long"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "[LỖI] Chưa cài đặt Node.js!"
    echo "Vui lòng tải và cài đặt tại: https://nodejs.org"
    exit 1
fi

# Check pnpm
if ! command -v pnpm &>/dev/null; then
    echo "[!] Chưa cài đặt pnpm. Đang cài đặt..."
    npm install -g pnpm
fi

# Install dependencies if missing
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "[1/3] Cài đặt thư viện (lần đầu chạy sẽ mất vài phút)..."
    cd "$SCRIPT_DIR" && pnpm install
fi

echo "[2/3] Khởi động API Server trên cổng 3000..."

# Detect OS and open terminal accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/artifacts/api-server' && pnpm run dev\""
    sleep 5
    echo "[3/3] Khởi động Dashboard trên cổng 5000..."
    osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/artifacts/financial-dashboard' && pnpm run dev\""
    sleep 5
    open "http://localhost:5000"
else
    # Linux
    if command -v gnome-terminal &>/dev/null; then
        gnome-terminal --title="API Server - Nam Thang Long" -- bash -c "cd '$SCRIPT_DIR/artifacts/api-server' && pnpm run dev; exec bash"
        sleep 5
        echo "[3/3] Khởi động Dashboard trên cổng 5000..."
        gnome-terminal --title="Dashboard - Nam Thang Long" -- bash -c "cd '$SCRIPT_DIR/artifacts/financial-dashboard' && pnpm run dev; exec bash"
    elif command -v xterm &>/dev/null; then
        xterm -title "API Server - Nam Thang Long" -e "cd '$SCRIPT_DIR/artifacts/api-server' && pnpm run dev" &
        sleep 5
        echo "[3/3] Khởi động Dashboard trên cổng 5000..."
        xterm -title "Dashboard - Nam Thang Long" -e "cd '$SCRIPT_DIR/artifacts/financial-dashboard' && pnpm run dev" &
    else
        # Fallback: run both in background with logs
        echo "[3/3] Khởi động cả hai dịch vụ nền..."
        cd "$SCRIPT_DIR/artifacts/api-server" && pnpm run dev > "$SCRIPT_DIR/api-server.log" 2>&1 &
        API_PID=$!
        sleep 5
        cd "$SCRIPT_DIR/artifacts/financial-dashboard" && pnpm run dev > "$SCRIPT_DIR/dashboard.log" 2>&1 &
        DASH_PID=$!
        echo ""
        echo "Chạy nền: API PID=$API_PID | Dashboard PID=$DASH_PID"
        echo "Log: $SCRIPT_DIR/api-server.log và $SCRIPT_DIR/dashboard.log"
    fi
    sleep 5
    if command -v xdg-open &>/dev/null; then
        xdg-open "http://localhost:5000"
    fi
fi

echo ""
echo "============================================"
echo "  Ứng dụng đã sẵn sàng!"
echo "  Mở trình duyệt và truy cập:"
echo "  http://localhost:5000"
echo "============================================"
