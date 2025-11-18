# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kre8 Diagram Builder is a web-based diagram generation tool with Claude AI integration. It consists of three main components:
1. **Frontend** (index.html, app.js, styles.css) - Dark-themed UI for diagram editing
2. **Renderer Server** (renderer.py) - Flask backend for rendering diagrams
3. **WebSocket Server** (server.py) - AI integration for diagram generation via Anthropic API

## Architecture

### Three-Server Architecture
The application requires three concurrent servers:
- **Renderer Server** (port 8000): HTTP server that handles diagram rendering via Graphviz, Mermaid, D2, and PlantUML
- **WebSocket Server** (port 8765): Real-time communication for Claude AI diagram generation
- **Web Server** (port 3000): Static file server for the frontend

### Data Flow
1. User edits code in frontend or sends AI prompts
2. Frontend sends render requests to renderer.py via HTTP (port 8000)
3. Frontend sends AI requests to server.py via WebSocket (port 8765)
4. server.py calls Anthropic API and returns generated diagram code
5. renderer.py processes diagram code and returns SVG/PNG/PDF

## Development Commands

### Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install system dependencies (macOS)
brew install graphviz

# Optional: Install Mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Optional: Install D2
brew install d2

# Set API key
export ANTHROPIC_API_KEY="your-key-here"
```

### Running Servers

**Quick Start (all servers):**
```bash
./start.sh
```

**Manual start (for development):**
```bash
# Terminal 1: Renderer server
python renderer.py

# Terminal 2: WebSocket server
python server.py

# Terminal 3: Web server
python -m http.server 3000
```

### Testing
The application can run in offline mode (without AI features) if the WebSocket server is not available. The renderer server must always be running for diagram previews.

## Code Structure

### server.py (WebSocket Server)
- `ClaudeCodeServer`: Main WebSocket handler
- `handle_client()`: Manages WebSocket connections
- `generate_diagram()`: Calls Anthropic API with diagram generation prompts
- Uses `claude-sonnet-4-5-20250929` model
- Automatically strips markdown code blocks from AI responses

### renderer.py (Rendering Server)
- `DiagramRenderer`: Handles multiple diagram formats
- `render_graphviz()`: Processes DOT syntax via graphviz library
- `render_mermaid()`: Calls mermaid-cli (mmdc) subprocess
- `render_d2()`: Calls d2 CLI subprocess
- `render_plantuml()`: Calls plantuml subprocess
- `convert_to_drawio()`: Converts SVG to Draw.io XML format
- Endpoints: `/render` (POST), `/export` (POST), `/health` (GET)

### app.js (Frontend)
- `DiagramBuilder`: Main application class
- `setupWebSocket()`: Manages WebSocket connection with auto-reconnect
- `renderDiagram()`: Sends code to renderer and displays result
- `sendToClaudeCode()`: Sends prompts to AI via WebSocket
- Real-time preview updates on code editor input
- Zoom controls (scale 0.1 to 3.0)

## Supported Diagram Formats

### Input Formats
- **Graphviz (DOT)**: Default format, best for architecture diagrams
- **Mermaid**: Flowcharts, sequence diagrams, ERDs, class diagrams
- **D2**: Modern declarative diagram language
- **PlantUML**: UML diagrams

### Export Formats
- PNG, SVG, PDF: Standard image formats
- Draw.io XML: Editable diagrams (embeds SVG as image)

## Important Patterns

### AI Prompt Construction
When modifying `server.py` AI prompts:
- System prompt defines output format and styling rules
- Always specify dark theme colors: #5E6AD2 (primary), #26B5CE (secondary), #00D084 (success)
- User prompt includes diagram type, user request, and current code context
- Response parsing strips markdown code blocks automatically

### Error Handling
- Frontend gracefully degrades to offline mode if servers unavailable
- WebSocket auto-reconnects after 5 seconds on disconnect
- Renderer returns JSON errors with HTTP 400/500 status codes
- Terminal displays user-friendly error messages

### Template System
Templates are stored in `app.js` as JavaScript object with diagram type keys. Each template includes:
- Complete, valid diagram code
- Styled nodes/edges with theme colors
- Comments and structure for easy modification

## Environment Variables

- `ANTHROPIC_API_KEY`: Required for AI features (WebSocket server)
- No other environment configuration needed
- Ports are hardcoded but can be changed in respective server files

## Dependencies

### Python (requirements.txt)
- `flask`: HTTP server framework
- `flask-cors`: CORS support for cross-origin requests
- `graphviz`: Graphviz rendering library
- `anthropic`: Anthropic API client
- `websockets`: WebSocket server implementation

### System
- `graphviz`: Required, install via package manager
- `mmdc` (@mermaid-js/mermaid-cli): Optional, for Mermaid support
- `d2`: Optional, for D2 diagram support
- `plantuml`: Optional, for PlantUML support

## Logs

When using `start.sh`, logs are written to:
- `logs/renderer.log`: Renderer server output
- `logs/server.log`: WebSocket server output
- `logs/web.log`: Web server output
- `logs/*.pid`: Process IDs for cleanup
