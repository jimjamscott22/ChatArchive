"""
Deterministic tagging engine for ChatArchive.

This module provides keyword-based automatic tagging of conversations based on
title and message content analysis.
"""

from __future__ import annotations

import re
from typing import Dict, List, Set


class TaggingEngine:
    """
    Deterministic tagging engine that classifies conversations into categories
    based on keyword patterns in titles and content.
    
    Tags are assigned based on a scoring system:
    - Title matches: 3 points
    - Content matches: 1 point per match (up to 5 matches)
    - Minimum threshold: 2 points to assign a tag
    """
    
    # Define tag patterns with keywords (lowercase for case-insensitive matching)
    TAG_PATTERNS: Dict[str, Dict[str, List[str]]] = {
        "coding": {
            "description": "Programming, development, and technical topics",
            "color": "#3B82F6",  # Blue
            "keywords": [
                # Programming languages
                "python", "javascript", "java", "c++", "c#", "ruby", "go", "rust", "swift",
                "typescript", "php", "kotlin", "scala", "perl", "r language", "matlab",
                # Web technologies
                "html", "css", "react", "vue", "angular", "node", "django", "flask",
                "fastapi", "express", "next.js", "svelte", "tailwind",
                # Development concepts
                "code", "coding", "programming", "debug", "error", "bug", "function",
                "class", "method", "algorithm", "api", "database", "sql", "nosql",
                "git", "github", "repository", "commit", "merge", "pull request",
                # DevOps and tools
                "docker", "kubernetes", "aws", "azure", "gcp", "ci/cd", "deployment",
                "linux", "bash", "shell", "terminal", "command line",
                # Data structures
                "array", "list", "dictionary", "hash", "tree", "graph", "stack", "queue",
            ]
        },
        "education": {
            "description": "Academic topics, assignments, and learning",
            "color": "#10B981",  # Green
            "keywords": [
                "assignment", "homework", "essay", "thesis", "dissertation", "paper",
                "study", "exam", "test", "quiz", "grade", "course", "class", "lecture",
                "professor", "teacher", "student", "university", "college", "school",
                "research", "citation", "reference", "bibliography", "apa", "mla",
                "learn", "learning", "education", "academic", "scholarship",
                "semester", "curriculum", "syllabus", "textbook", "notes",
            ]
        },
        "writing": {
            "description": "Creative writing, content creation, and documentation",
            "color": "#8B5CF6",  # Purple
            "keywords": [
                "write", "writing", "story", "novel", "fiction", "character",
                "plot", "narrative", "draft", "edit", "revision", "author",
                "article", "blog", "post", "content", "copy", "copywriting",
                "documentation", "readme", "guide", "tutorial", "manual",
                "creative writing", "screenplay", "script", "dialogue",
                "poetry", "poem", "verse", "prose", "chapter",
            ]
        },
        "productivity": {
            "description": "Task management, planning, and organization",
            "color": "#F59E0B",  # Amber
            "keywords": [
                "todo", "task", "schedule", "calendar", "plan", "planning",
                "organize", "organization", "project management", "workflow",
                "productivity", "time management", "deadline", "milestone",
                "goal", "objective", "strategy", "roadmap", "timeline",
                "meeting", "agenda", "notes", "action items", "follow-up",
                "priority", "urgent", "backlog", "sprint",
            ]
        },
        "business": {
            "description": "Business, finance, and professional topics",
            "color": "#EF4444",  # Red
            "keywords": [
                "business", "company", "startup", "entrepreneur", "investment",
                "finance", "financial", "budget", "revenue", "profit", "loss",
                "marketing", "sales", "customer", "client", "contract",
                "strategy", "market", "competitor", "analysis", "roi",
                "professional", "career", "job", "interview", "resume",
                "networking", "leadership", "management", "team",
            ]
        },
        "data-science": {
            "description": "Data analysis, machine learning, and AI",
            "color": "#06B6D4",  # Cyan
            "keywords": [
                "data science", "machine learning", "deep learning", "ai",
                "artificial intelligence", "neural network", "model", "training",
                "dataset", "data analysis", "statistics", "pandas", "numpy",
                "tensorflow", "pytorch", "scikit-learn", "jupyter", "notebook",
                "visualization", "plot", "chart", "graph", "matplotlib",
                "nlp", "computer vision", "classification", "regression",
                "clustering", "prediction", "feature", "accuracy",
            ]
        },
        "tech-support": {
            "description": "Technical support, troubleshooting, and how-to",
            "color": "#EC4899",  # Pink
            "keywords": [
                "how to", "help", "issue", "problem", "fix", "solve",
                "troubleshoot", "error", "not working", "broken", "setup",
                "install", "configuration", "settings", "support",
                "tutorial", "guide", "steps", "instructions", "workaround",
            ]
        },
        "creative": {
            "description": "Creative projects, design, and art",
            "color": "#F97316",  # Orange
            "keywords": [
                "design", "ui", "ux", "interface", "mockup", "prototype",
                "art", "drawing", "painting", "illustration", "graphic",
                "creative", "idea", "brainstorm", "concept", "vision",
                "color", "palette", "layout", "typography", "font",
                "photoshop", "figma", "sketch", "canva", "adobe",
            ]
        },
        "personal": {
            "description": "Personal topics and general conversation",
            "color": "#6B7280",  # Gray
            "keywords": [
                "personal", "life", "advice", "opinion", "thought",
                "feeling", "experience", "story", "friend", "family",
                "relationship", "hobby", "interest", "fun", "entertainment",
                "game", "movie", "book", "music", "travel", "food",
                "health", "fitness", "workout", "exercise", "diet",
            ]
        },
    }
    
    def __init__(self):
        """Initialize the tagging engine with compiled patterns."""
        self.tag_patterns = self.TAG_PATTERNS
    
    def classify_conversation(
        self,
        title: str | None,
        messages: List[Dict[str, str]],
        min_score: int = 2,
        max_tags: int = 3,
    ) -> List[str]:
        """
        Classify a conversation into tags based on content analysis.
        
        Args:
            title: Conversation title
            messages: List of message dictionaries with 'content' and 'role' keys
            min_score: Minimum score required to assign a tag
            max_tags: Maximum number of tags to assign
            
        Returns:
            List of tag names that match the conversation
        """
        # Calculate scores for each tag
        scores: Dict[str, int] = {tag_name: 0 for tag_name in self.tag_patterns}
        
        # Normalize text for matching
        title_text = (title or "").lower()
        
        # Collect all user messages (limit to first 10 for performance)
        user_messages = [
            msg["content"].lower()
            for msg in messages[:10]
            if msg.get("role") == "user" and msg.get("content")
        ]
        
        # Score each tag based on keyword matches
        for tag_name, tag_data in self.tag_patterns.items():
            keywords = tag_data["keywords"]
            
            # Check title matches (weight: 3 points)
            for keyword in keywords:
                if self._match_keyword(keyword, title_text):
                    scores[tag_name] += 3
                    break  # Only count once per tag
            
            # Check message content matches (weight: 1 point per match, max 5)
            content_matches = 0
            for keyword in keywords:
                for message_text in user_messages:
                    if self._match_keyword(keyword, message_text):
                        content_matches += 1
                        if content_matches >= 5:
                            break
                if content_matches >= 5:
                    break
            
            scores[tag_name] += content_matches
        
        # Filter tags by minimum score and sort by score
        qualified_tags = [
            (tag_name, score)
            for tag_name, score in scores.items()
            if score >= min_score
        ]
        qualified_tags.sort(key=lambda x: x[1], reverse=True)
        
        # Return top tags up to max_tags limit
        return [tag_name for tag_name, _ in qualified_tags[:max_tags]]
    
    def _match_keyword(self, keyword: str, text: str) -> bool:
        """
        Check if a keyword matches in the text using word boundary matching.
        
        Args:
            keyword: Keyword to search for
            text: Text to search in
            
        Returns:
            True if keyword is found as a whole word (case-insensitive)
        """
        # Use word boundaries for exact word matching
        # This prevents 'class' from matching 'classical'.
        # Keywords that already end in a non-word character (c++, c#, ci/cd)
        # cannot use a trailing \b — that boundary never matches.
        escaped = re.escape(keyword)
        if re.search(r"\w$", keyword):
            pattern = r"\b" + escaped + r"\b"
        else:
            pattern = r"\b" + escaped
        return bool(re.search(pattern, text, re.IGNORECASE))
    
    def get_tag_info(self, tag_name: str) -> Dict[str, str] | None:
        """
        Get information about a specific tag.
        
        Args:
            tag_name: Name of the tag
            
        Returns:
            Dictionary with tag description and color, or None if not found
        """
        if tag_name not in self.tag_patterns:
            return None
        
        tag_data = self.tag_patterns[tag_name]
        return {
            "name": tag_name,
            "description": tag_data["description"],
            "color": tag_data["color"],
        }
    
    def get_all_tags(self) -> List[Dict[str, str]]:
        """
        Get information about all available tags.
        
        Returns:
            List of dictionaries with tag information
        """
        return [
            {
                "name": tag_name,
                "description": tag_data["description"],
                "color": tag_data["color"],
            }
            for tag_name, tag_data in self.tag_patterns.items()
        ]


# Global instance
_tagging_engine: TaggingEngine | None = None


def get_tagging_engine() -> TaggingEngine:
    """Get or create the global tagging engine instance."""
    global _tagging_engine
    if _tagging_engine is None:
        _tagging_engine = TaggingEngine()
    return _tagging_engine
