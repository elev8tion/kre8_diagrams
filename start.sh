#!/bin/bash

# Kre8 Diagram Builder - Startup Script
# This script starts all required servers

set -e

echo "🎨 Kre8 Diagram Builder - Starting..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠ Python3 not found. Please install Python 3.8+${NC}"
    exit 1
fi

# Check if requirements are installed
if ! python3 -c "import flask" &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
    pip3 install -r requirements.txt
fi

# Check Graphviz
if ! command -v dot &> /dev/null; then
    echo -e "${YELLOW}⚠ Graphviz not installed${NC}"
    echo "  macOS: brew install graphviz"
    echo "  Ubuntu: sudo apt-get install graphviz"
    exit 1
fi

# Check API Key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${YELLOW}⚠ ANTHROPIC_API_KEY not set${NC}"
    echo "  Set it with: export ANTHROPIC_API_KEY='your-key-here'"
    echo "  Continuing without AI features..."
fi

# Create log directory
mkdir -p logs

echo -e "${GREEN}✓ Environment check complete${NC}"
echo ""

# Start servers in background
echo -e "${BLUE}🚀 Starting servers...${NC}"
echo ""

# 1. Start Renderer Server
echo -e "${GREEN}[1/3]${NC} Starting Diagram Renderer (port 8000)..."
python3 renderer.py > logs/renderer.log 2>&1 &
RENDERER_PID=$!
sleep 2

# 2. Start WebSocket Server
echo -e "${GREEN}[2/3]${NC} Starting Claude Code WebSocket (port 8765)..."
python3 server.py > logs/server.log 2>&1 &
WEBSOCKET_PID=$!
sleep 2

# 3. Start Web Server
echo -e "${GREEN}[3/3]${NC} Starting Web Server (port 3000)..."
python3 -m http.server 3000 > logs/web.log 2>&1 &
WEB_PID=$!
sleep 2

echo ""
echo -e "${GREEN}✓ All servers started successfully!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${BLUE}🌐 Open in browser:${NC}"
echo -e "     ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  ${BLUE}📊 Servers:${NC}"
echo "     • Renderer:  http://localhost:8000"
echo "     • WebSocket: ws://localhost:8765"
echo "     • Frontend:  http://localhost:3000"
echo ""
echo -e "  ${BLUE}📝 Logs:${NC}"
echo "     • tail -f logs/renderer.log"
echo "     • tail -f logs/server.log"
echo "     • tail -f logs/web.log"
echo ""
echo -e "  ${BLUE}⏹ Stop servers:${NC}"
echo "     • Press Ctrl+C"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Save PIDs for cleanup
echo $RENDERER_PID > logs/renderer.pid
echo $WEBSOCKET_PID > logs/server.pid
echo $WEB_PID > logs/web.pid

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping servers...${NC}"
    kill $RENDERER_PID 2>/dev/null || true
    kill $WEBSOCKET_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    rm -f logs/*.pid
    echo -e "${GREEN}✓ All servers stopped${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Wait for all background processes
wait
