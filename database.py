#!/usr/bin/env python3
"""
Database handler for Claude Code communication
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path

class DiagramDatabase:
    def __init__(self, db_path='kre8_diagrams.db'):
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        """Initialize the database with required tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Create requests table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                diagram_type TEXT,
                format_type TEXT,
                current_code TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP
            )
        ''')

        # Create responses table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER,
                diagram_code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES requests(id)
            )
        ''')

        conn.commit()
        conn.close()

    def add_request(self, message, diagram_type='architecture', format_type='graphviz', current_code=''):
        """Add a new diagram request"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO requests (message, diagram_type, format_type, current_code)
            VALUES (?, ?, ?, ?)
        ''', (message, diagram_type, format_type, current_code))

        request_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return request_id

    def get_pending_requests(self):
        """Get all pending requests"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM requests
            WHERE status = 'pending'
            ORDER BY created_at ASC
        ''')

        requests = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return requests

    def get_latest_pending_request(self):
        """Get the most recent pending request"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM requests
            WHERE status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
        ''')

        request = cursor.fetchone()
        conn.close()

        return dict(request) if request else None

    def add_response(self, request_id, diagram_code):
        """Add a response to a request"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Insert response
        cursor.execute('''
            INSERT INTO responses (request_id, diagram_code)
            VALUES (?, ?)
        ''', (request_id, diagram_code))

        # Update request status
        cursor.execute('''
            UPDATE requests
            SET status = 'completed', processed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (request_id,))

        conn.commit()
        conn.close()

    def get_response(self, request_id):
        """Get response for a specific request"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM responses
            WHERE request_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        ''', (request_id,))

        response = cursor.fetchone()
        conn.close()

        return dict(response) if response else None

    def mark_request_processing(self, request_id):
        """Mark a request as being processed"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE requests
            SET status = 'processing'
            WHERE id = ?
        ''', (request_id,))

        conn.commit()
        conn.close()

    def clear_old_requests(self, days=7):
        """Clear requests older than specified days"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            DELETE FROM responses
            WHERE request_id IN (
                SELECT id FROM requests
                WHERE created_at < datetime('now', '-' || ? || ' days')
            )
        ''', (days,))

        cursor.execute('''
            DELETE FROM requests
            WHERE created_at < datetime('now', '-' || ? || ' days')
        ''', (days,))

        conn.commit()
        conn.close()
