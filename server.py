#!/usr/bin/env python3
"""
Kre8 Diagram Builder - WebSocket Server for Claude Code Integration
"""

import asyncio
import json
import websockets
from anthropic import Anthropic
import os

class ClaudeCodeServer:
    def __init__(self):
        self.api_key = os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            print("Warning: ANTHROPIC_API_KEY not found in environment")
            self.client = None
        else:
            self.client = Anthropic(api_key=self.api_key)

        self.connected_clients = set()

    async def handle_client(self, websocket, path):
        """Handle WebSocket client connection"""
        self.connected_clients.add(websocket)
        print(f"✓ New client connected. Total clients: {len(self.connected_clients)}")

        try:
            await websocket.send(json.dumps({
                'type': 'message',
                'content': 'Connected to Claude Code server'
            }))

            async for message in websocket:
                await self.process_message(websocket, message)

        except websockets.exceptions.ConnectionClosed:
            print("Client disconnected")
        finally:
            self.connected_clients.remove(websocket)

    async def process_message(self, websocket, message):
        """Process incoming WebSocket message"""
        try:
            data = json.loads(message)
            message_type = data.get('type')

            if message_type == 'generate':
                await self.generate_diagram(websocket, data)
            elif message_type == 'modify':
                await self.modify_diagram(websocket, data)
            else:
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                }))

        except Exception as e:
            print(f"Error processing message: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def generate_diagram(self, websocket, data):
        """Generate diagram code using Claude"""
        user_message = data.get('message', '')
        context = data.get('context', {})
        diagram_type = context.get('diagramType', 'architecture')
        format_type = context.get('format', 'graphviz')
        current_code = context.get('currentCode', '')

        if not self.client:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'ANTHROPIC_API_KEY not configured'
            }))
            return

        # Build Claude prompt
        system_prompt = f"""You are an expert diagram generator. Generate {format_type} code for diagrams.

Rules:
- Generate clean, properly formatted {format_type} code
- Use modern best practices
- Include colors and styling for visual appeal
- Make diagrams clear and easy to understand
- For dark themes, use colors like #5E6AD2, #26B5CE, #00D084
- Return ONLY the diagram code, no explanations"""

        user_prompt = f"""Generate a {diagram_type} diagram using {format_type}.

User request: {user_message}

Current code (if modifying):
{current_code if current_code else 'None - create new diagram'}

Generate the complete diagram code."""

        try:
            # Call Claude API
            message = self.client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=2000,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": user_prompt
                }]
            )

            # Extract diagram code
            diagram_code = message.content[0].text.strip()

            # Remove markdown code blocks if present
            if diagram_code.startswith('```'):
                lines = diagram_code.split('\n')
                diagram_code = '\n'.join(lines[1:-1])

            # Send response
            await websocket.send(json.dumps({
                'type': 'diagram_code',
                'code': diagram_code
            }))

        except Exception as e:
            print(f"Claude API error: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': f'Failed to generate diagram: {str(e)}'
            }))

    async def modify_diagram(self, websocket, data):
        """Modify existing diagram code"""
        await self.generate_diagram(websocket, data)

    async def start_server(self, host='localhost', port=8765):
        """Start the WebSocket server"""
        print(f"🚀 Starting Kre8 Diagram Builder WebSocket Server...")
        print(f"📡 Listening on ws://{host}:{port}")
        print(f"🔑 Claude API Key: {'✓ Configured' if self.api_key else '✗ Not configured'}")
        print(f"\nWaiting for connections...\n")

        async with websockets.serve(self.handle_client, host, port):
            await asyncio.Future()  # Run forever

def main():
    """Main entry point"""
    server = ClaudeCodeServer()
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        print("\n\n✓ Server stopped")

if __name__ == '__main__':
    main()
