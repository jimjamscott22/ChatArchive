#!/usr/bin/env python
"""Test import endpoint"""
import asyncio
import json
from app.main import import_chatgpt
from app.database import SessionLocal

class MockFile:
    def __init__(self, filename, content):
        self.filename = filename
        self.content = content
    
    async def read(self):
        return self.content

async def test():
    try:
        # Read the message_feedback.json file
        with open('../message_feedback.json', 'rb') as f:
            content = f.read()
        
        db = SessionLocal()
        result = await import_chatgpt(MockFile("message_feedback.json", content), db)
        print(f"SUCCESS: Imported {len(result)} conversations")
    except Exception as e:
        import traceback
        print(f"ERROR: {type(e).__name__}: {e}")
        traceback.print_exc()

asyncio.run(test())
