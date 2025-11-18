#!/usr/bin/env python3
"""
Kre8 Diagram Builder - Diagram Rendering Server
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import graphviz
import os
import tempfile
import base64
from io import BytesIO
import subprocess

app = Flask(__name__)
CORS(app)

class DiagramRenderer:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()

    def render_graphviz(self, code, output_format='svg', theme='dark'):
        """Render Graphviz (DOT) diagram"""
        try:
            # Add graph attributes for dark theme
            if theme == 'dark' and 'bgcolor' not in code.lower():
                # Insert bgcolor and fontcolor into graph definition
                if 'digraph' in code or 'graph' in code:
                    lines = code.split('\n')
                    for i, line in enumerate(lines):
                        if '{' in line and i < 3:  # Find opening brace in first few lines
                            lines.insert(i+1, '  bgcolor="transparent";')
                            lines.insert(i+2, '  fontcolor="white";')
                            break
                    code = '\n'.join(lines)

            src = graphviz.Source(code)
            output_file = os.path.join(self.temp_dir, f'diagram.{output_format}')
            src.render(output_file, format=output_format, cleanup=True)

            with open(f'{output_file}.{output_format}', 'rb') as f:
                return f.read()
        except Exception as e:
            raise Exception(f"Graphviz render error: {str(e)}")

    def render_mermaid(self, code, output_format='svg'):
        """Render Mermaid diagram using mermaid-cli"""
        try:
            input_file = os.path.join(self.temp_dir, 'diagram.mmd')
            output_file = os.path.join(self.temp_dir, f'diagram.{output_format}')

            # Write mermaid code to file
            with open(input_file, 'w') as f:
                f.write(code)

            # Use mermaid-cli (mmdc) if available
            result = subprocess.run(
                ['mmdc', '-i', input_file, '-o', output_file, '-t', 'dark', '-b', 'transparent'],
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                raise Exception(f"Mermaid error: {result.stderr}")

            with open(output_file, 'rb') as f:
                return f.read()
        except FileNotFoundError:
            raise Exception("Mermaid CLI (mmdc) not installed. Install with: npm install -g @mermaid-js/mermaid-cli")
        except Exception as e:
            raise Exception(f"Mermaid render error: {str(e)}")

    def render_d2(self, code, output_format='svg'):
        """Render D2 diagram"""
        try:
            input_file = os.path.join(self.temp_dir, 'diagram.d2')
            output_file = os.path.join(self.temp_dir, f'diagram.{output_format}')

            # Write D2 code to file
            with open(input_file, 'w') as f:
                f.write(code)

            # Use d2 CLI
            result = subprocess.run(
                ['d2', input_file, output_file, '--theme', '200'],
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                raise Exception(f"D2 error: {result.stderr}")

            with open(output_file, 'rb') as f:
                return f.read()
        except FileNotFoundError:
            raise Exception("D2 CLI not installed. Install from: https://d2lang.com/")
        except Exception as e:
            raise Exception(f"D2 render error: {str(e)}")

    def render_plantuml(self, code, output_format='svg'):
        """Render PlantUML diagram"""
        try:
            input_file = os.path.join(self.temp_dir, 'diagram.puml')
            output_file = os.path.join(self.temp_dir, f'diagram.{output_format}')

            # Write PlantUML code to file
            with open(input_file, 'w') as f:
                f.write(code)

            # Use PlantUML
            fmt = 'svg' if output_format == 'svg' else 'png'
            result = subprocess.run(
                ['plantuml', f'-t{fmt}', input_file, '-o', self.temp_dir],
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                raise Exception(f"PlantUML error: {result.stderr}")

            with open(output_file, 'rb') as f:
                return f.read()
        except FileNotFoundError:
            raise Exception("PlantUML not installed. Install from: https://plantuml.com/")
        except Exception as e:
            raise Exception(f"PlantUML render error: {str(e)}")

    def convert_to_drawio(self, code, format_type):
        """Convert diagram to Draw.io XML format"""
        try:
            # First render as SVG
            if format_type == 'graphviz':
                svg_data = self.render_graphviz(code, 'svg')
            elif format_type == 'mermaid':
                svg_data = self.render_mermaid(code, 'svg')
            else:
                raise Exception(f"Draw.io conversion not supported for {format_type}")

            # Convert SVG to Draw.io XML (simplified)
            drawio_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="Kre8 Diagram Builder" modified="2025-01-01T00:00:00.000Z" version="22.0.0">
  <diagram name="Page-1" id="diagram">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="" style="shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;aspect=fixed;imageAspect=0;image=data:image/svg+xml,{base64.b64encode(svg_data).decode()}" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="760" height="600" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>"""
            return drawio_xml.encode()
        except Exception as e:
            raise Exception(f"Draw.io conversion error: {str(e)}")

renderer = DiagramRenderer()

@app.route('/render', methods=['POST'])
def render_diagram():
    """Render diagram endpoint"""
    try:
        data = request.json
        code = data.get('code', '')
        format_type = data.get('format', 'graphviz')
        theme = data.get('theme', 'dark')

        if not code:
            return jsonify({'error': 'No code provided'}), 400

        # Render based on format
        if format_type == 'graphviz':
            diagram_data = renderer.render_graphviz(code, 'svg', theme)
        elif format_type == 'mermaid':
            diagram_data = renderer.render_mermaid(code, 'svg')
        elif format_type == 'd2':
            diagram_data = renderer.render_d2(code, 'svg')
        elif format_type == 'plantuml':
            diagram_data = renderer.render_plantuml(code, 'svg')
        else:
            return jsonify({'error': f'Unsupported format: {format_type}'}), 400

        # Return as base64 data URL
        b64_data = base64.b64encode(diagram_data).decode()
        return jsonify({
            'success': True,
            'image': f'data:image/svg+xml;base64,{b64_data}'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/export', methods=['POST'])
def export_diagram():
    """Export diagram endpoint"""
    try:
        data = request.json
        code = data.get('code', '')
        export_format = data.get('format', 'png')
        diagram_format = data.get('diagramFormat', 'graphviz')

        if not code:
            return jsonify({'error': 'No code provided'}), 400

        # Render based on format
        if export_format == 'drawio':
            diagram_data = renderer.convert_to_drawio(code, diagram_format)
            mimetype = 'application/xml'
        else:
            if diagram_format == 'graphviz':
                diagram_data = renderer.render_graphviz(code, export_format)
            elif diagram_format == 'mermaid':
                diagram_data = renderer.render_mermaid(code, export_format)
            elif diagram_format == 'd2':
                diagram_data = renderer.render_d2(code, export_format)
            elif diagram_format == 'plantuml':
                diagram_data = renderer.render_plantuml(code, export_format)
            else:
                return jsonify({'error': f'Unsupported format: {diagram_format}'}), 400

            mimetype = f'image/{export_format}'

        # Send file
        return send_file(
            BytesIO(diagram_data),
            mimetype=mimetype,
            as_attachment=True,
            download_name=f'diagram.{export_format}'
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Kre8 Diagram Renderer is running'
    })

def main():
    """Main entry point"""
    print("🚀 Starting Kre8 Diagram Renderer Server...")
    print("📡 Listening on http://localhost:8000")
    print("\nEndpoints:")
    print("  POST /render  - Render diagram")
    print("  POST /export  - Export diagram")
    print("  GET  /health  - Health check")
    print("\nWaiting for requests...\n")

    app.run(host='0.0.0.0', port=8000, debug=True)

if __name__ == '__main__':
    main()
