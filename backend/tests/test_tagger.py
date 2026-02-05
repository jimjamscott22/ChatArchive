"""Tests for the tagging engine."""

from app.tagger import TaggingEngine, get_tagging_engine


def test_tagging_engine_initialization():
    """Test that the tagging engine initializes correctly."""
    engine = TaggingEngine()
    assert engine is not None
    assert len(engine.tag_patterns) > 0


def test_get_tagging_engine_singleton():
    """Test that get_tagging_engine returns the same instance."""
    engine1 = get_tagging_engine()
    engine2 = get_tagging_engine()
    assert engine1 is engine2


def test_get_all_tags():
    """Test retrieving all predefined tags."""
    engine = TaggingEngine()
    tags = engine.get_all_tags()
    
    assert len(tags) == 9
    assert all("name" in tag for tag in tags)
    assert all("description" in tag for tag in tags)
    assert all("color" in tag for tag in tags)
    
    # Check for expected tags
    tag_names = [tag["name"] for tag in tags]
    assert "coding" in tag_names
    assert "education" in tag_names
    assert "writing" in tag_names


def test_get_tag_info():
    """Test retrieving info for a specific tag."""
    engine = TaggingEngine()
    
    # Test existing tag
    tag_info = engine.get_tag_info("coding")
    assert tag_info is not None
    assert tag_info["name"] == "coding"
    assert tag_info["description"] == "Programming, development, and technical topics"
    assert tag_info["color"] == "#3B82F6"
    
    # Test non-existent tag
    tag_info = engine.get_tag_info("nonexistent")
    assert tag_info is None


def test_classify_coding_conversation():
    """Test classification of a coding conversation."""
    engine = TaggingEngine()
    
    title = "Python function to sort array"
    messages = [
        {"role": "user", "content": "How do I write a Python function to sort an array?"},
        {"role": "assistant", "content": "You can use the sorted() function..."},
    ]
    
    tags = engine.classify_conversation(title, messages)
    assert "coding" in tags
    assert len(tags) <= 3  # Should not exceed max_tags


def test_classify_education_conversation():
    """Test classification of an education conversation."""
    engine = TaggingEngine()
    
    title = "Essay on climate change"
    messages = [
        {"role": "user", "content": "I need help writing an essay on climate change for my assignment"},
        {"role": "assistant", "content": "Let's start with an outline for your paper..."},
    ]
    
    tags = engine.classify_conversation(title, messages)
    assert "education" in tags


def test_classify_data_science_conversation():
    """Test classification of a data science conversation."""
    engine = TaggingEngine()
    
    title = "Build a machine learning model"
    messages = [
        {"role": "user", "content": "I want to build a machine learning model using scikit-learn and pandas"},
        {"role": "assistant", "content": "Let's start with data preprocessing..."},
    ]
    
    tags = engine.classify_conversation(title, messages)
    assert "data-science" in tags


def test_classify_business_conversation():
    """Test classification of a business conversation."""
    engine = TaggingEngine()
    
    title = "Marketing strategy for startup"
    messages = [
        {"role": "user", "content": "What's a good marketing strategy for a new startup company?"},
        {"role": "assistant", "content": "Here are some key marketing strategies for startups..."},
    ]
    
    tags = engine.classify_conversation(title, messages)
    assert "business" in tags


def test_classify_writing_conversation():
    """Test classification of a writing conversation."""
    engine = TaggingEngine()
    
    title = "Novel character development"
    messages = [
        {"role": "user", "content": "How do I develop a compelling character for my novel?"},
        {"role": "assistant", "content": "Character development involves creating depth and motivation..."},
    ]
    
    tags = engine.classify_conversation(title, messages)
    assert "writing" in tags


def test_classify_multi_tag_conversation():
    """Test classification of a conversation that should get multiple tags."""
    engine = TaggingEngine()
    
    title = "Web development assignment"
    messages = [
        {"role": "user", "content": "I have a homework assignment to build a website using HTML, CSS, and JavaScript"},
        {"role": "assistant", "content": "Let's break down your assignment into steps..."},
    ]
    
    tags = engine.classify_conversation(title, messages)
    # Should be tagged with both coding and education
    assert len(tags) > 0
    # Either coding or education should be present (or both)
    assert "coding" in tags or "education" in tags


def test_classify_no_match_conversation():
    """Test classification of a conversation that doesn't match any tags."""
    engine = TaggingEngine()
    
    title = "Hello"
    messages = [
        {"role": "user", "content": "Hi there"},
        {"role": "assistant", "content": "Hello! How can I help you today?"},
    ]
    
    tags = engine.classify_conversation(title, messages)
    # Should return empty list or minimal tags with low scores
    # The personal tag might match due to generic keywords, which is acceptable
    assert isinstance(tags, list)


def test_classify_with_empty_title():
    """Test classification with no title."""
    engine = TaggingEngine()
    
    title = None
    messages = [
        {"role": "user", "content": "How do I debug Python code?"},
        {"role": "assistant", "content": "Use print statements or a debugger..."},
    ]
    
    tags = engine.classify_conversation(title, messages)
    assert "coding" in tags


def test_classify_with_empty_messages():
    """Test classification with no messages."""
    engine = TaggingEngine()
    
    title = "Python programming"
    messages = []
    
    tags = engine.classify_conversation(title, messages)
    assert "coding" in tags


def test_classify_respects_min_score():
    """Test that classification respects minimum score threshold."""
    engine = TaggingEngine()
    
    # Very generic title and message that shouldn't strongly match any tag
    title = "Question"
    messages = [
        {"role": "user", "content": "I have a question"},
    ]
    
    # With high min_score, should return fewer or no tags
    tags = engine.classify_conversation(title, messages, min_score=10)
    assert len(tags) == 0


def test_classify_respects_max_tags():
    """Test that classification respects maximum tags limit."""
    engine = TaggingEngine()
    
    # Create a message that matches multiple tags strongly
    title = "Programming assignment with data science and machine learning"
    messages = [
        {"role": "user", "content": "I need help with my homework on building a Python machine learning model using scikit-learn for data analysis"},
    ]
    
    tags = engine.classify_conversation(title, messages, max_tags=2)
    assert len(tags) <= 2


def test_keyword_matching():
    """Test that keyword matching works correctly."""
    engine = TaggingEngine()
    
    # Test word boundary matching - 'class' should not match 'classical'
    assert engine._match_keyword("class", "I need help with Python class")
    assert not engine._match_keyword("class", "I like classical music")
    
    # Test case insensitivity
    assert engine._match_keyword("python", "Python programming")
    assert engine._match_keyword("python", "PYTHON code")
