#!/usr/bin/env python
"""
End-to-end verification script for all LLM parsers.

Usage:
    python verify_parsers.py [--test-dir PATH]
    
Options:
    --test-dir PATH    Directory containing test JSON files (default: /tmp/test_imports)
"""
import json
import sys
import argparse
from pathlib import Path

from app.importers.chatgpt import parse_chatgpt_export
from app.importers.claude import parse_claude_export
from app.importers.copilot import parse_copilot_export
from app.importers.gemini import parse_gemini_export

def load_json(filepath):
    """Load JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)

def verify_parser(name, parser_func, filepath, expected_source):
    """Verify a parser works correctly.
    
    Args:
        name: Display name for the parser
        parser_func: Parser function to test
        filepath: Path to test data file
        expected_source: Expected source field value in parsed output
    """
    print(f"\n{'='*60}")
    print(f"Testing {name} Parser")
    print(f"{'='*60}")
    
    try:
        # Load data
        data = load_json(filepath)
        print(f"✓ Loaded {filepath}")
        
        # Parse
        result = parser_func(data)
        print(f"✓ Parsed successfully")
        
        # Verify structure
        assert isinstance(result, list), "Result must be a list"
        assert len(result) > 0, "Result must contain at least one conversation"
        
        conv = result[0]
        print(f"✓ Found {len(result)} conversation(s)")
        
        # Check required fields
        required_fields = ["source", "source_id", "title", "messages", "message_count"]
        for field in required_fields:
            assert field in conv, f"Missing field: {field}"
        print(f"✓ All required fields present")
        
        # Check source
        assert conv["source"] == expected_source, f"Source should be {expected_source}"
        print(f"✓ Source is '{conv['source']}'")
        
        # Check messages
        messages = conv["messages"]
        assert isinstance(messages, list), "Messages must be a list"
        assert len(messages) > 0, "Must have at least one message"
        print(f"✓ Found {len(messages)} message(s)")
        
        # Check message structure
        msg = messages[0]
        required_msg_fields = ["role", "content", "content_type", "order_index"]
        for field in required_msg_fields:
            assert field in msg, f"Missing message field: {field}"
        print(f"✓ Message structure is valid")
        
        # Print summary
        print(f"\n📊 Summary:")
        print(f"   Title: {conv['title']}")
        print(f"   Messages: {conv['message_count']}")
        print(f"   First message role: {messages[0]['role']}")
        print(f"   First message: {messages[0]['content'][:50]}...")
        
        print(f"\n✅ {name} parser verification PASSED\n")
        return True
        
    except Exception as e:
        print(f"\n❌ {name} parser verification FAILED")
        print(f"   Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all parser verifications."""
    parser = argparse.ArgumentParser(
        description="Verify ChatArchive LLM parsers with test data"
    )
    parser.add_argument(
        "--test-dir",
        type=str,
        default="/tmp/test_imports",
        help="Directory containing test JSON files (default: /tmp/test_imports)"
    )
    args = parser.parse_args()
    
    print("="*60)
    print("ChatArchive Multi-LLM Parser End-to-End Verification")
    print("="*60)
    
    test_dir = Path(args.test_dir)
    
    if not test_dir.exists():
        print(f"\n❌ Error: Test directory does not exist: {test_dir}")
        print(f"\nPlease create the directory and add test files:")
        print(f"  mkdir -p {test_dir}")
        print(f"  # Add chatgpt_test.json, claude_test.json, copilot_test.json, gemini_test.json")
        return 1
    
    tests = [
        ("ChatGPT", parse_chatgpt_export, test_dir / "chatgpt_test.json", "chatgpt"),
        ("Claude", parse_claude_export, test_dir / "claude_test.json", "claude"),
        ("Copilot", parse_copilot_export, test_dir / "copilot_test.json", "copilot"),
        ("Gemini", parse_gemini_export, test_dir / "gemini_test.json", "gemini"),
    ]
    
    results = []
    for name, parser, filepath, expected_source in tests:
        success = verify_parser(name, parser, filepath, expected_source)
        results.append((name, success))
    
    # Print final summary
    print("\n" + "="*60)
    print("Final Results")
    print("="*60)
    
    all_passed = True
    for name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{name:20} {status}")
        if not success:
            all_passed = False
    
    print("="*60)
    
    if all_passed:
        print("\n🎉 All parsers verified successfully!")
        print("\nChatArchive now supports importing conversations from:")
        print("  • ChatGPT (OpenAI)")
        print("  • Claude (Anthropic)")
        print("  • GitHub Copilot")
        print("  • Gemini/Bard (Google)")
        return 0
    else:
        print("\n⚠️  Some parsers failed verification")
        return 1

if __name__ == "__main__":
    sys.exit(main())
