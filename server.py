#!/usr/bin/env python3
"""
Kre8 Diagram Builder - WebSocket Server for Claude Code Integration
This server acts as a relay between the web UI and Claude Code terminal via SQLite database
"""

import asyncio
import json
import websockets
import sys
from datetime import datetime
from database import DiagramDatabase

class ClaudeCodeServer:
    def __init__(self):
        self.connected_clients = set()
        self.db = DiagramDatabase()
        print("✓ Database initialized")

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
            user_message = data.get('message', '')
            context = data.get('context', {})

            # Save request to database
            request_id = self.db.add_request(
                message=user_message,
                diagram_type=context.get('diagramType', 'architecture'),
                format_type=context.get('format', 'graphviz'),
                current_code=context.get('currentCode', '')
            )

            # Print the user's message to terminal for Claude Code to see
            print("\n" + "="*60)
            print(f"📥 NEW REQUEST #{request_id} from Web UI:")
            print(f"   Message: {user_message}")
            print(f"   Diagram Type: {context.get('diagramType', 'architecture')}")
            print(f"   Format: {context.get('format', 'graphviz')}")
            print(f"   Saved to database with ID: {request_id}")
            print("="*60)
            print(f"\n💭 Run: python respond.py {request_id} to respond\n")

            # Send acknowledgment to web UI
            await websocket.send(json.dumps({
                'type': 'message',
                'content': f'⏳ Request #{request_id} saved. Waiting for Claude Code response...'
            }))

            # Start polling for response
            asyncio.create_task(self.poll_for_response(websocket, request_id))

        except Exception as e:
            print(f"Error processing message: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def poll_for_response(self, websocket, request_id, timeout=300):
        """Poll database for response to the request"""
        start_time = asyncio.get_event_loop().time()

        while True:
            # Check if timeout reached (5 minutes)
            if asyncio.get_event_loop().time() - start_time > timeout:
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': f'Request #{request_id} timed out after {timeout}s'
                }))
                break

            # Check for response in database
            response = self.db.get_response(request_id)

            if response:
                # Send diagram code to client
                await websocket.send(json.dumps({
                    'type': 'diagram_code',
                    'code': response['diagram_code']
                }))
                print(f"✓ Sent response for request #{request_id} to web UI")
                break

            # Wait before polling again
            await asyncio.sleep(1)

    async def start_server(self, host='localhost', port=8765):
        """Start the WebSocket server"""
        print(f"🚀 Starting Kre8 Diagram Builder WebSocket Server...")
        print(f"📡 Listening on ws://{host}:{port}")
        print(f"💾 Database: kre8_diagrams.db")
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
