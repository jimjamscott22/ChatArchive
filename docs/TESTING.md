# Testing Guide

This document describes how to test the ChatArchive LLM parsers.

## Running Tests

### Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Run All Tests

```bash
cd backend
python -m pytest tests/ -v
```

### Run Specific Test Files

```bash
# ChatGPT parser tests
python -m pytest tests/test_chatgpt_parser.py -v

# Claude parser tests
python -m pytest tests/test_claude_parser.py -v

# Copilot parser tests
python -m pytest tests/test_copilot_parser.py -v

# Gemini parser tests
python -m pytest tests/test_gemini_parser.py -v

# Integration tests
python -m pytest tests/test_integration.py -v
```

### Run with Coverage

```bash
pip install pytest-cov
python -m pytest tests/ --cov=app/importers --cov-report=html
```

## Test Structure

### Unit Tests

Each parser has comprehensive unit tests covering:

- **Basic parsing**: Different input formats and structures
- **Edge cases**: Empty messages, missing fields, malformed data
- **Error handling**: Invalid formats, missing required data
- **Data normalization**: Consistent output format across all parsers
- **Timestamp parsing**: Various timestamp formats (Unix, ISO 8601, etc.)
- **Role mapping**: Different role naming conventions
- **Content extraction**: Nested structures, arrays, special formats

### Integration Tests

Integration tests verify that:
- All parsers return data in the same normalized format
- Parsers can handle multiple conversations
- Empty messages are properly filtered
- Error cases are handled consistently
- Raw JSON is preserved for debugging

## Test Coverage

Total: **78 tests**

- ChatGPT parser: 12 tests
- Claude parser: 13 tests
- Copilot parser: 25 tests
- Gemini parser: 23 tests
- Integration tests: 5 tests

All tests pass ✅

## Verification Script

Run the end-to-end verification script to test all parsers with sample data:

```bash
cd backend
python verify_parsers.py
```

This script:
1. Loads sample JSON files for each platform
2. Parses them using the respective parsers
3. Verifies the output structure and data
4. Reports success/failure for each parser

## Sample Test Data

The verification script looks for sample test files. You can create them in any directory and specify the path:

```bash
# Create test files directory
mkdir -p test_data

# Create sample files (see examples in the repository)
# Then run:
python verify_parsers.py --test-dir ./test_data
```

Sample test files should be JSON files matching each platform's export format:
- `chatgpt_test.json` - ChatGPT export format
- `claude_test.json` - Claude export format
- `copilot_test.json` - Copilot export format
- `gemini_test.json` - Gemini export format

For the exact format examples, see the test files in `backend/tests/test_*.py`.

## Writing New Tests

When adding new features or modifying parsers:

1. Add unit tests for the specific functionality
2. Add integration tests if the change affects multiple parsers
3. Ensure all existing tests still pass
4. Run the verification script to confirm end-to-end functionality

### Test Template

```python
def test_new_feature():
    """Test description."""
    # Arrange
    payload = {...}
    
    # Act
    result = parse_something(payload)
    
    # Assert
    assert result is not None
    assert len(result) == expected_count
```

## Continuous Integration

The test suite is designed to run in CI/CD pipelines. All tests are fast and independent, making them suitable for:

- Pre-commit hooks
- Pull request validation
- Automated deployment pipelines

## Troubleshooting Tests

### Import Errors

If you get import errors, ensure you're running tests from the `backend` directory:
```bash
cd backend
python -m pytest tests/
```

### Missing Dependencies

Install all required dependencies:
```bash
pip install -r requirements.txt
```

### Database Issues

Tests don't require a database. They only test the parser logic, not the API endpoints or database operations.
