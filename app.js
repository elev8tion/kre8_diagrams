// Kre8 Diagram Builder - Main Application
class DiagramBuilder {
  constructor() {
    this.ws = null;
    this.currentDiagram = null;
    this.diagramType = 'architecture';
    this.format = 'graphviz';
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;
    this.gridEnabled = false;
    this.isFullscreen = false;

    this.init();
  }

  init() {
    this.setupWebSocket();
    this.setupEventListeners();
    this.loadExamples();
  }

  setupWebSocket() {
    // WebSocket connection for Claude Code integration
    const wsUrl = 'ws://localhost:8765';

    console.log('Connecting to Claude Code WebSocket...');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.addTerminalMessage('system', '✓ Connected to Claude Code terminal');
        console.log('WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.addTerminalMessage('system', '⚠ WebSocket connection error. Starting in offline mode.');
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.addTerminalMessage('system', '✗ Disconnected from Claude Code. Reconnecting in 5s...');
        setTimeout(() => this.setupWebSocket(), 5000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.addTerminalMessage('system', 'ℹ Running in offline mode. Start the WebSocket server to enable Claude integration.');
    }
  }

  setupEventListeners() {
    // Diagram type selection
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.diagramType = e.currentTarget.dataset.type;
        this.loadTemplate(this.diagramType);
      });
    });

    // Right panel tab switching
    document.querySelectorAll('.right-panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        document.querySelectorAll('.right-panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.right-panel-view').forEach(v => v.classList.remove('active'));
        document.querySelector(`.right-panel-view[data-view="${view}"]`).classList.add('active');
      });
    });

    // Terminal input
    const terminalInput = document.getElementById('terminalInput');
    terminalInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && terminalInput.value.trim()) {
        this.sendToClaudeCode(terminalInput.value);
        terminalInput.value = '';
      }
    });

    // Code editor
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.addEventListener('input', () => {
      this.renderDiagram();
    });

    // Format selection
    const formatSelect = document.getElementById('formatSelect');
    formatSelect.addEventListener('change', (e) => {
      this.format = e.target.value;
      this.renderDiagram();
    });

    // Generate button
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.addEventListener('click', () => {
      this.renderDiagram();
    });

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.addEventListener('click', () => {
      this.exportDiagram();
    });

    // Enhanced Zoom Controls
    document.getElementById('zoomIn').addEventListener('click', () => this.adjustZoom(10));
    document.getElementById('zoomOut').addEventListener('click', () => this.adjustZoom(-10));
    document.getElementById('resetZoom').addEventListener('click', () => this.resetZoom());

    const zoomSlider = document.getElementById('zoomSlider');
    zoomSlider.addEventListener('input', (e) => {
      this.zoom = parseInt(e.target.value) / 100;
      this.updatePreviewZoom();
    });

    // Fit to Screen
    document.getElementById('fitScreen').addEventListener('click', () => this.fitToScreen());

    // Toggle Grid
    document.getElementById('toggleGrid').addEventListener('click', () => this.toggleGrid());

    // Collapse Code Panel
    document.getElementById('collapseCode').addEventListener('click', () => this.toggleCodePanel());

    // Full Screen
    document.getElementById('fullScreen').addEventListener('click', () => this.toggleFullScreen());

    // Pan functionality
    const previewWrapper = document.getElementById('previewWrapper');
    previewWrapper.addEventListener('mousedown', (e) => this.startPan(e));
    previewWrapper.addEventListener('mousemove', (e) => this.pan(e));
    previewWrapper.addEventListener('mouseup', () => this.endPan());
    previewWrapper.addEventListener('mouseleave', () => this.endPan());

    // Mouse wheel zoom
    const preview = document.getElementById('preview');
    preview.addEventListener('wheel', (e) => this.handleWheelZoom(e), { passive: false });

    // Context menu
    preview.addEventListener('contextmenu', (e) => this.showContextMenu(e));
    document.addEventListener('click', () => this.hideContextMenu());

    // Context menu actions
    document.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleContextMenuAction(item.dataset.action);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

    // Shortcuts overlay
    document.getElementById('closeShortcuts').addEventListener('click', () => {
      document.getElementById('shortcutsOverlay').classList.remove('active');
    });

    // AI prompt buttons
    document.querySelectorAll('.prompt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prompt = e.target.textContent.replace(/[📊🔄🌐📱🗄️]/g, '').trim();
        this.sendToClaudeCode(`Generate a ${prompt} diagram`);
      });
    });

    // New diagram
    document.getElementById('newDiagram').addEventListener('click', () => {
      if (confirm('Create a new diagram? Unsaved changes will be lost.')) {
        document.getElementById('codeEditor').value = '';
        document.getElementById('diagramTitle').value = '';
        this.clearPreview();
      }
    });

    // Draw grid on canvas
    this.setupGridCanvas();
  }

  loadTemplate(type) {
    // Set format based on diagram type
    const formatMap = {
      architecture: 'graphviz',
      flowchart: 'mermaid',
      sequence: 'mermaid',
      erd: 'mermaid',
      network: 'mermaid',
      uml: 'mermaid',
      custom: 'graphviz'
    };

    const format = formatMap[type] || 'graphviz';
    document.getElementById('formatSelect').value = format;
    this.format = format;

    const templates = {
      architecture: `digraph Architecture {
  rankdir=TB;
  graph [fontname="SF Pro Display, -apple-system, Segoe UI, Helvetica", bgcolor="transparent"];
  node [shape=box, style="rounded", fillcolor="none", fontcolor=white, fontname="SF Pro Display, -apple-system, Segoe UI, Helvetica", margin=0.3, penwidth=2];
  edge [color="#26B5CE", penwidth=2.5, arrowsize=0.8];

  User [label="👤 User", color="#5E6AD2:#7B68EE", gradientangle=90];
  LB [label="⚖️ Load Balancer", color="#26B5CE:#00D084", gradientangle=90];
  Web1 [label="🌐 Web Server 1", color="#5E6AD2:#26B5CE", gradientangle=90];
  Web2 [label="🌐 Web Server 2", color="#5E6AD2:#26B5CE", gradientangle=90];
  App [label="⚙️ Application", color="#FFB224:#FF6B6B", gradientangle=90];
  DB [label="🗄️ Database", color="#7B68EE:#5E6AD2", gradientangle=90];
  Cache [label="📦 Redis Cache", color="#00D084:#26B5CE", gradientangle=90];

  User -> LB;
  LB -> Web1;
  LB -> Web2;
  Web1 -> App;
  Web2 -> App;
  App -> Cache;
  App -> DB;
}`,
      flowchart: `%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#5E6AD2','primaryTextColor':'#fff','lineColor':'#26B5CE','secondaryColor':'#FFB224','tertiaryColor':'#00D084'}}}%%
graph TD
    A[Start] --> B{Decision Point}
    B -->|Yes| C[Process 1]
    B -->|No| D[Process 2]
    C --> E[Merge]
    D --> E
    E --> F[End]

    style A fill:transparent,stroke:#5E6AD2,stroke-width:2px,color:#fff
    style F fill:transparent,stroke:#00D084,stroke-width:2px,color:#fff
    style B fill:transparent,stroke:#FFB224,stroke-width:2px,color:#fff
    style C fill:transparent,stroke:#26B5CE,stroke-width:2px,color:#fff
    style D fill:transparent,stroke:#26B5CE,stroke-width:2px,color:#fff
    style E fill:transparent,stroke:#7B68EE,stroke-width:2px,color:#fff
    linkStyle default stroke:#26B5CE,stroke-width:2.5px`,
      sequence: `%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#5E6AD2','primaryTextColor':'#fff','lineColor':'#26B5CE','actorBkg':'#5E6AD2','actorBorder':'#7B68EE','activationBkgColor':'#26B5CE','activationBorderColor':'#00D084'}}}%%
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Database

    User->>Frontend: Login Request
    Frontend->>API: POST /auth/login
    API->>Database: Query User
    Database-->>API: User Data
    API-->>Frontend: JWT Token
    Frontend-->>User: Success`,
      erd: `%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#5E6AD2','primaryTextColor':'#fff','lineColor':'#26B5CE'}}}%%
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"

    CUSTOMER {
        int id PK
        string name
        string email
        string phone
    }
    ORDER {
        int id PK
        int customer_id FK
        date order_date
        string status
    }
    LINE_ITEM {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        float price
    }
    PRODUCT {
        int id PK
        string name
        float price
        string category
    }`,
      network: `%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#5E6AD2','primaryTextColor':'#fff','lineColor':'#26B5CE'}}}%%
graph TB
    Internet((🌍 Internet))
    Router[🔀 Router]
    Firewall[🛡️ Firewall]
    Switch[🔌 Switch]
    Server1[💻 Web Server]
    Server2[💻 App Server]
    DB[(🗄️ Database)]
    PC1[🖥️ Workstation 1]
    PC2[🖥️ Workstation 2]

    Internet --> Router
    Router --> Firewall
    Firewall --> Switch
    Switch --> Server1
    Switch --> Server2
    Switch --> DB
    Switch --> PC1
    Switch --> PC2

    style Internet fill:transparent,stroke:#26B5CE,stroke-width:2px,color:#fff
    style Firewall fill:transparent,stroke:#FF6B6B,stroke-width:2px,color:#fff
    style DB fill:transparent,stroke:#5E6AD2,stroke-width:2px,color:#fff
    style Router fill:transparent,stroke:#FFB224,stroke-width:2px,color:#fff
    style Switch fill:transparent,stroke:#00D084,stroke-width:2px,color:#fff
    style Server1 fill:transparent,stroke:#7B68EE,stroke-width:2px,color:#fff
    style Server2 fill:transparent,stroke:#7B68EE,stroke-width:2px,color:#fff
    style PC1 fill:transparent,stroke:#26B5CE,stroke-width:2px,color:#fff
    style PC2 fill:transparent,stroke:#26B5CE,stroke-width:2px,color:#fff
    linkStyle default stroke:#26B5CE,stroke-width:2.5px`,
      uml: `%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#5E6AD2','primaryTextColor':'#fff','lineColor':'#26B5CE'}}}%%
classDiagram
    class User {
        +int id
        +string name
        +string email
        +login()
        +logout()
        +updateProfile()
    }
    class Product {
        +int id
        +string name
        +float price
        +string description
        +getDetails()
        +updateStock()
    }
    class Order {
        +int id
        +date orderDate
        +string status
        +float total
        +calculateTotal()
        +processPayment()
    }
    class Payment {
        +int id
        +float amount
        +string method
        +process()
        +refund()
    }

    User "1" --> "*" Order : places
    Order "*" --> "*" Product : contains
    Order "1" --> "1" Payment : has`,
      custom: `digraph Custom {
  rankdir=TB;
  graph [fontname="SF Pro Display, -apple-system, Segoe UI, Helvetica", bgcolor="transparent"];
  node [shape=box, style="rounded", fillcolor="none", fontcolor=white, fontname="SF Pro Display, -apple-system, Segoe UI, Helvetica", margin=0.3, penwidth=2];
  edge [color="#26B5CE", penwidth=2.5, arrowsize=0.8];

  // Start building your custom diagram here
  // You can describe any type of diagram to Claude Code in the terminal
  // Examples:
  // - "Create a diagram showing X"
  // - "Add nodes A, B, C with connections"
  // - "Generate a flowchart for Y process"

  Start [label="✨ Custom Diagram", color="#5E6AD2:#7B68EE", gradientangle=90];
  Claude [label="💬 Ask Claude Code", color="#26B5CE:#00D084", gradientangle=90];

  Start -> Claude;
}`
    };

    document.getElementById('codeEditor').value = templates[type] || '';
    this.renderDiagram();
  }

  sendToClaudeCode(message) {
    this.addTerminalMessage('user', message);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'generate',
        message: message,
        context: {
          diagramType: this.diagramType,
          format: this.format,
          currentCode: document.getElementById('codeEditor').value
        }
      }));
      this.addTerminalMessage('system', '⏳ Processing with Claude Code...');
    } else {
      this.addTerminalMessage('system', '⚠ Claude Code is not connected. Please start the WebSocket server.');
      this.generateLocalResponse(message);
    }
  }

  generateLocalResponse(message) {
    setTimeout(() => {
      this.addTerminalMessage('assistant',
        `To enable AI-powered diagram generation:\n\n1. Start the WebSocket server:\n   python server.py\n\n2. Start the render server:\n   python renderer.py\n\n3. Refresh this page`
      );
    }, 500);
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'diagram_code':
        document.getElementById('codeEditor').value = data.code;
        this.renderDiagram();
        this.addTerminalMessage('assistant', '✓ Diagram generated successfully!');
        break;
      case 'message':
        this.addTerminalMessage('assistant', data.content);
        break;
      case 'error':
        this.addTerminalMessage('system', `✗ Error: ${data.message}`);
        break;
    }
  }

  addTerminalMessage(type, content) {
    const output = document.getElementById('terminalOutput');
    const message = document.createElement('div');
    message.className = `terminal-message ${type}`;
    message.textContent = content;
    output.appendChild(message);
    output.scrollTop = output.scrollHeight;
  }

  async renderDiagram() {
    const code = document.getElementById('codeEditor').value;
    if (!code.trim()) {
      this.clearPreview();
      return;
    }

    const wrapper = document.getElementById('previewWrapper');
    wrapper.innerHTML = `
      <div class="preview-placeholder">
        <div class="loading-spinner"></div>
        <p style="margin-top: 16px;">Rendering diagram...</p>
      </div>
    `;

    try {
      const response = await fetch('http://localhost:8000/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          format: this.format,
          theme: 'dark'
        })
      });

      if (response.ok) {
        const data = await response.json();
        wrapper.innerHTML = `<img src="${data.image}" alt="Diagram" class="fade-in">`;
        wrapper.classList.add('pannable');

        // Wait for image to load, then fit to screen
        const img = wrapper.querySelector('img');
        img.onload = () => {
          setTimeout(() => this.fitToScreen(), 100);
        };

        this.updatePreviewZoom();
      } else {
        throw new Error('Failed to render diagram');
      }
    } catch (error) {
      console.error('Render error:', error);
      wrapper.innerHTML = `
        <div class="preview-placeholder">
          <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" style="opacity: 0.3;">
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
          <p style="margin-top: 12px;">⚠ Preview not available in offline mode</p>
          <p style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);">Start the Python backend to render diagrams:</p>
          <pre style="margin-top: 16px; text-align: left; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; font-size: 11px; max-width: 400px;">python renderer.py</pre>
        </div>
      `;
      wrapper.classList.remove('pannable');
    }
  }

  clearPreview() {
    const wrapper = document.getElementById('previewWrapper');
    wrapper.innerHTML = `
      <div class="preview-placeholder">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor">
          <rect x="8" y="8" width="48" height="48" rx="4" stroke-width="2"/>
          <path d="M24 32h16M32 24v16" stroke-width="2"/>
        </svg>
        <p>Generate or paste code to see preview</p>
      </div>
    `;
    wrapper.classList.remove('pannable');
  }

  adjustZoom(delta) {
    const newZoom = Math.max(10, Math.min(200, (this.zoom * 100) + delta));
    this.zoom = newZoom / 100;
    document.getElementById('zoomSlider').value = newZoom;
    this.updatePreviewZoom();
  }

  updatePreviewZoom() {
    const zoomPercent = document.getElementById('zoomPercent');
    zoomPercent.textContent = `${Math.round(this.zoom * 100)}%`;

    const img = document.querySelector('#previewWrapper img');
    if (img) {
      img.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
    }
  }

  resetZoom() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    document.getElementById('zoomSlider').value = 100;
    this.updatePreviewZoom();
  }

  fitToScreen() {
    const wrapper = document.getElementById('previewWrapper');
    const img = document.querySelector('#previewWrapper img');
    if (!img) return;

    const wrapperWidth = wrapper.clientWidth;
    const wrapperHeight = wrapper.clientHeight;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const scaleX = wrapperWidth / imgWidth;
    const scaleY = wrapperHeight / imgHeight;
    const scale = Math.min(scaleX, scaleY, 2) * 0.9;

    this.zoom = scale;
    this.panX = 0;
    this.panY = 0;
    document.getElementById('zoomSlider').value = Math.round(scale * 100);
    this.updatePreviewZoom();
  }

  handleWheelZoom(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? -10 : 10;
    this.adjustZoom(delta);
  }

  // Pan functionality
  startPan(e) {
    if (e.button !== 0) return; // Only left mouse button
    const img = document.querySelector('#previewWrapper img');
    if (!img) return;

    this.isPanning = true;
    this.startX = e.clientX - this.panX;
    this.startY = e.clientY - this.panY;
    document.getElementById('previewWrapper').classList.add('panning');
  }

  pan(e) {
    if (!this.isPanning) return;
    e.preventDefault();

    this.panX = e.clientX - this.startX;
    this.panY = e.clientY - this.startY;
    this.updatePreviewZoom();
  }

  endPan() {
    this.isPanning = false;
    document.getElementById('previewWrapper').classList.remove('panning');
  }

  // Grid overlay
  setupGridCanvas() {
    const canvas = document.getElementById('gridCanvas');
    const resizeCanvas = () => {
      const preview = document.getElementById('preview');
      canvas.width = preview.clientWidth;
      canvas.height = preview.clientHeight;
      if (this.gridEnabled) this.drawGrid();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  toggleGrid() {
    this.gridEnabled = !this.gridEnabled;
    const canvas = document.getElementById('gridCanvas');
    canvas.classList.toggle('active', this.gridEnabled);
    if (this.gridEnabled) {
      this.drawGrid();
    }
  }

  drawGrid() {
    const canvas = document.getElementById('gridCanvas');
    const ctx = canvas.getContext('2d');
    const gridSize = 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(94, 106, 210, 0.2)';
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  // Collapsible panel
  toggleCodePanel() {
    const editorPanel = document.querySelector('.editor-panel');
    editorPanel.classList.toggle('collapsed');

    const icon = document.querySelector('#collapseCode svg path');
    if (editorPanel.classList.contains('collapsed')) {
      icon.setAttribute('d', 'M4.646 1.646a.5.5 0 01.708 0l6 6a.5.5 0 010 .708l-6 6a.5.5 0 01-.708-.708L10.293 8 4.646 2.354a.5.5 0 010-.708z');
    } else {
      icon.setAttribute('d', 'M11.354 1.646a.5.5 0 010 .708L5.707 8l5.647 5.646a.5.5 0 01-.708.708l-6-6a.5.5 0 010-.708l6-6a.5.5 0 01.708 0z');
    }
  }

  // Full screen
  toggleFullScreen() {
    this.isFullscreen = !this.isFullscreen;
    document.body.classList.toggle('fullscreen', this.isFullscreen);

    if (!this.isFullscreen) {
      // Recalculate fit when exiting fullscreen
      setTimeout(() => this.fitToScreen(), 300);
    }
  }

  // Context menu
  showContextMenu(e) {
    e.preventDefault();
    const menu = document.getElementById('contextMenu');
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add('active');
  }

  hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('active');
  }

  async handleContextMenuAction(action) {
    this.hideContextMenu();

    switch (action) {
      case 'copy':
        await this.copyImageToClipboard();
        break;
      case 'download-png':
        await this.exportDiagram('png');
        break;
      case 'download-svg':
        await this.exportDiagram('svg');
        break;
      case 'reset-view':
        this.resetZoom();
        break;
      case 'copy-code':
        await this.copyCodeToClipboard();
        break;
    }
  }

  async copyImageToClipboard() {
    const img = document.querySelector('#previewWrapper img');
    if (!img) return;

    try {
      const blob = await fetch(img.src).then(r => r.blob());
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      this.addTerminalMessage('system', '✓ Image copied to clipboard');
    } catch (error) {
      console.error('Copy failed:', error);
      this.addTerminalMessage('system', '✗ Failed to copy image');
    }
  }

  async copyCodeToClipboard() {
    const code = document.getElementById('codeEditor').value;
    try {
      await navigator.clipboard.writeText(code);
      this.addTerminalMessage('system', '✓ Code copied to clipboard');
    } catch (error) {
      console.error('Copy failed:', error);
      this.addTerminalMessage('system', '✗ Failed to copy code');
    }
  }

  // Keyboard shortcuts
  handleKeyboardShortcuts(e) {
    const isMod = e.ctrlKey || e.metaKey;

    // Prevent default for our shortcuts
    if (isMod && ['=', '-', '0', 'Enter', 's'].includes(e.key)) {
      e.preventDefault();
    }

    // Zoom shortcuts
    if (isMod && e.key === '=') {
      this.adjustZoom(10);
    } else if (isMod && e.key === '-') {
      this.adjustZoom(-10);
    } else if (isMod && e.key === '0') {
      this.resetZoom();
    }

    // Fit to screen
    else if (e.key === 'f' || e.key === 'F') {
      if (!document.activeElement.matches('input, textarea')) {
        e.preventDefault();
        this.fitToScreen();
      }
    }

    // Toggle grid
    else if (e.key === 'g' || e.key === 'G') {
      if (!document.activeElement.matches('input, textarea')) {
        e.preventDefault();
        this.toggleGrid();
      }
    }

    // Show shortcuts
    else if (e.key === '?' && !document.activeElement.matches('input, textarea')) {
      e.preventDefault();
      document.getElementById('shortcutsOverlay').classList.add('active');
    }

    // Exit fullscreen
    else if (e.key === 'Escape') {
      if (this.isFullscreen) {
        this.toggleFullScreen();
      }
      document.getElementById('shortcutsOverlay').classList.remove('active');
    }

    // Render diagram
    else if (isMod && e.key === 'Enter') {
      this.renderDiagram();
    }

    // Export
    else if (isMod && e.key === 's') {
      this.exportDiagram();
    }
  }

  async exportDiagram() {
    const format = prompt('Export format? (png, svg, pdf, drawio)', 'png');
    if (!format) return;

    try {
      const response = await fetch('http://localhost:8000/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: document.getElementById('codeEditor').value,
          format: format,
          diagramFormat: this.format
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diagram.${format}`;
        a.click();
        this.addTerminalMessage('system', `✓ Diagram exported as ${format}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Make sure the Python backend is running.');
    }
  }

  loadExamples() {
    this.loadTemplate('architecture');
    this.addTerminalMessage('system', 'Welcome to Kre8 Diagram Builder! 🎨');
    this.addTerminalMessage('system', 'Type commands in the terminal or use the sidebar to select diagram types.');
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  window.diagramBuilder = new DiagramBuilder();
  console.log('Kre8 Diagram Builder initialized');
});
