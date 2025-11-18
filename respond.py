#!/usr/bin/env python3
"""
Claude Code Response Helper
This script helps Claude Code respond to diagram requests from the web UI
"""

import sys
from database import DiagramDatabase

def main():
    db = DiagramDatabase()

    # Check if request ID provided
    if len(sys.argv) < 2:
        print("📋 Pending Requests:")
        print("=" * 60)

        requests = db.get_pending_requests()

        if not requests:
            print("✓ No pending requests")
            print("\nUsage: python respond.py <request_id> '<diagram_code>'")
            return

        for req in requests:
            print(f"\n🆔 Request #{req['id']}")
            print(f"   Message: {req['message']}")
            print(f"   Diagram Type: {req['diagram_type']}")
            print(f"   Format: {req['format_type']}")
            print(f"   Status: {req['status']}")
            print(f"   Created: {req['created_at']}")
            if req['current_code']:
                print(f"   Current Code: {req['current_code'][:100]}...")

        print("\n" + "=" * 60)
        print(f"\n💡 To respond: python respond.py <request_id> '<diagram_code>'")
        print(f"💡 Example: python respond.py 1 'digraph {{ A -> B; }}'")
        return

    request_id = int(sys.argv[1])

    # If no diagram code provided, show the request details
    if len(sys.argv) < 3:
        print(f"\n📋 Request #{request_id} Details:")
        print("=" * 60)

        requests = db.get_pending_requests()
        request = next((r for r in requests if r['id'] == request_id), None)

        if not request:
            print(f"✗ Request #{request_id} not found or already processed")
            return

        print(f"   Message: {request['message']}")
        print(f"   Diagram Type: {request['diagram_type']}")
        print(f"   Format: {request['format_type']}")
        print(f"   Current Code:")
        if request['current_code']:
            print(f"\n{request['current_code']}\n")
        else:
            print("   (none)")

        print("=" * 60)
        print(f"\n💡 To respond: python respond.py {request_id} '<diagram_code>'")
        return

    # Add response
    diagram_code = sys.argv[2]

    try:
        db.add_response(request_id, diagram_code)
        print(f"✓ Response added for request #{request_id}")
        print(f"✓ Web UI will receive the diagram code")
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == '__main__':
    main()
