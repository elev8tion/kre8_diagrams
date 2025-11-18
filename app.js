// Kre8 Diagram Builder - Main Application
class DiagramBuilder {
  constructor() {
    this.ws = null;
    this.currentDiagram = null;
    this.diagramType = 'architecture';
    this.format = 'graphviz';
    this.zoom = 1;

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

        // Update active tab
        document.querySelectorAll('.right-panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active view
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

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => this.adjustZoom(0.1));
    document.getElementById('zoomOut').addEventListener('click', () => this.adjustZoom(-0.1));
    document.getElementById('resetZoom').addEventListener('click', () => {
      this.zoom = 1;
      this.updatePreviewZoom();
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
  graph [fontname="SF Pro Display, -apple-system, Segoe UI, Helvetica"];
  node [shape=box, style="rounded,filled", fillcolor="#5E6AD2:#26B5CE", gradientangle=90, fontcolor=white, fontname="SF Pro Display, -apple-system, Segoe UI, Helvetica", margin=0.3, penwidth=0];
  edge [color="#26B5CE", penwidth=2.5, arrowsize=0.8];

  User [label="👤 User", fillcolor="#5E6AD2:#7B68EE"];
  LB [label="⚖️ Load Balancer", fillcolor="#26B5CE:#00D084"];
  Web1 [label="🌐 Web Server 1", fillcolor="#5E6AD2:#26B5CE"];
  Web2 [label="🌐 Web Server 2", fillcolor="#5E6AD2:#26B5CE"];
  App [label="⚙️ Application", fillcolor="#FFB224:#FF6B6B"];
  DB [label="🗄️ Database", fillcolor="#7B68EE:#5E6AD2"];
  Cache [label="📦 Redis Cache", fillcolor="#00D084:#26B5CE"];

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

    style A fill:#5E6AD2,stroke:#7B68EE,stroke-width:3px,color:#fff
    style F fill:#00D084,stroke:#26B5CE,stroke-width:3px,color:#fff
    style B fill:#FFB224,stroke:#FF6B6B,stroke-width:3px,color:#fff
    style C fill:#26B5CE,stroke:#00D084,stroke-width:2px,color:#fff
    style D fill:#26B5CE,stroke:#00D084,stroke-width:2px,color:#fff
    style E fill:#7B68EE,stroke:#5E6AD2,stroke-width:2px,color:#fff
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

    style Internet fill:#26B5CE,stroke:#00D084,stroke-width:3px,color:#fff
    style Firewall fill:#FF6B6B,stroke:#FFB224,stroke-width:3px,color:#fff
    style DB fill:#5E6AD2,stroke:#7B68EE,stroke-width:3px,color:#fff
    style Router fill:#FFB224,stroke:#FF6B6B,stroke-width:2px,color:#fff
    style Switch fill:#00D084,stroke:#26B5CE,stroke-width:2px,color:#fff
    style Server1 fill:#7B68EE,stroke:#5E6AD2,stroke-width:2px,color:#fff
    style Server2 fill:#7B68EE,stroke:#5E6AD2,stroke-width:2px,color:#fff
    style PC1 fill:#26B5CE,stroke:#00D084,stroke-width:2px,color:#fff
    style PC2 fill:#26B5CE,stroke:#00D084,stroke-width:2px,color:#fff
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
  graph [fontname="SF Pro Display, -apple-system, Segoe UI, Helvetica"];
  node [shape=box, style="rounded,filled", fillcolor="#5E6AD2:#26B5CE", gradientangle=90, fontcolor=white, fontname="SF Pro Display, -apple-system, Segoe UI, Helvetica", margin=0.3, penwidth=0];
  edge [color="#26B5CE", penwidth=2.5, arrowsize=0.8];

  // Start building your custom diagram here
  // You can describe any type of diagram to Claude Code in the terminal
  // Examples:
  // - "Create a diagram showing X"
  // - "Add nodes A, B, C with connections"
  // - "Generate a flowchart for Y process"

  Start [label="✨ Custom Diagram", fillcolor="#5E6AD2:#7B68EE"];
  Claude [label="💬 Ask Claude Code", fillcolor="#26B5CE:#00D084"];

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

    const preview = document.getElementById('preview');
    preview.innerHTML = '<div class="preview-placeholder"><p>⏳ Rendering diagram...</p></div>';

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
        preview.innerHTML = `<img src="${data.image}" alt="Diagram" style="max-width: 100%; height: auto; transform: scale(${this.zoom});">`;
      } else {
        throw new Error('Failed to render diagram');
      }
    } catch (error) {
      console.error('Render error:', error);
      preview.innerHTML = `
        <div class="preview-placeholder">
          <p>⚠ Preview not available in offline mode</p>
          <p style="margin-top: 8px; font-size: 12px;">Start the Python backend to render diagrams:</p>
          <pre style="margin-top: 16px; text-align: left; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; font-size: 11px; max-width: 400px;">python renderer.py</pre>
        </div>
      `;
    }
  }

  clearPreview() {
    document.getElementById('preview').innerHTML = `
      <div class="preview-placeholder">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor">
          <rect x="8" y="8" width="48" height="48" rx="4" stroke-width="2"/>
          <path d="M24 32h16M32 24v16" stroke-width="2"/>
        </svg>
        <p>Generate or paste code to see preview</p>
      </div>
    `;
  }

  adjustZoom(delta) {
    this.zoom = Math.max(0.1, Math.min(3, this.zoom + delta));
    this.updatePreviewZoom();
  }

  updatePreviewZoom() {
    const img = document.querySelector('#preview img');
    if (img) {
      img.style.transform = `scale(${this.zoom})`;
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
