"""
Semantic tagging and classification module.

Classifies conversations by topic using the existing TaggingEngine and
extracts key entities (programming languages, frameworks, libraries).
"""

from __future__ import annotations

import re

from app.preprocessing.models import EntityExtraction, ProcessedConversation
from app.tagger import get_tagging_engine

# Entity detection patterns organized by category
_PROGRAMMING_LANGUAGES = [
    "python", "javascript", "typescript", "java", "c\\+\\+", "c#", "ruby",
    "go", "rust", "swift", "kotlin", "scala", "perl", "php", "r",
    "matlab", "lua", "haskell", "elixir", "clojure", "dart", "zig",
    "bash", "shell", "sql", "html", "css",
]

_FRAMEWORKS = [
    "react", "vue", "angular", "svelte", "next\\.js", "nuxt", "django",
    "flask", "fastapi", "express", "spring", "rails", "laravel",
    "asp\\.net", "gin", "echo", "actix", "rocket", "phoenix",
    "tailwind", "bootstrap", "qt", "electron", "flutter", "swiftui",
]

_LIBRARIES = [
    "pandas", "numpy", "scipy", "matplotlib", "seaborn", "plotly",
    "tensorflow", "pytorch", "scikit-learn", "keras", "opencv",
    "requests", "axios", "lodash", "moment", "dayjs",
    "sqlalchemy", "prisma", "sequelize", "mongoose", "pydantic",
    "jest", "pytest", "mocha", "junit", "rspec",
    "docker", "kubernetes", "terraform", "ansible",
    "redis", "postgresql", "mongodb", "elasticsearch",
    "tiktoken", "langchain", "openai",
]

_TECHNOLOGIES = [
    "aws", "azure", "gcp", "heroku", "vercel", "netlify",
    "github", "gitlab", "bitbucket", "ci/cd",
    "rest api", "graphql", "grpc", "websocket",
    "linux", "macos", "windows", "ios", "android",
    "supabase", "firebase", "auth0",
]


def _find_entities(text: str, patterns: list[str]) -> list[str]:
    """Find all matching entity patterns in text (case-insensitive, word boundary)."""
    found: list[str] = []
    text_lower = text.lower()
    for pattern in patterns:
        regex = re.compile(r"\b" + pattern + r"\b", re.IGNORECASE)
        if regex.search(text_lower):
            # Use the pattern itself as the canonical name (un-escape regex chars)
            name = pattern.replace("\\", "")
            if name not in found:
                found.append(name)
    return found


def extract_entities(conversation: ProcessedConversation) -> EntityExtraction:
    """
    Extract programming languages, frameworks, libraries, and technologies
    mentioned across all messages in a conversation.
    """
    # Build a combined text corpus from title + all messages
    parts = []
    if conversation.title:
        parts.append(conversation.title)
    for msg in conversation.messages:
        parts.append(msg.content)
    corpus = "\n".join(parts)

    return EntityExtraction(
        programming_languages=_find_entities(corpus, _PROGRAMMING_LANGUAGES),
        frameworks=_find_entities(corpus, _FRAMEWORKS),
        libraries=_find_entities(corpus, _LIBRARIES),
        technologies=_find_entities(corpus, _TECHNOLOGIES),
    )


def classify_conversation(
    conversation: ProcessedConversation,
) -> ProcessedConversation:
    """
    Classify a conversation using the existing TaggingEngine and extract entities.

    Populates conversation.tags and conversation.entities.
    """
    engine = get_tagging_engine()

    # Prepare messages in the format expected by TaggingEngine
    messages_for_tagger = [
        {"role": msg.role, "content": msg.content}
        for msg in conversation.messages
    ]

    conversation.tags = engine.classify_conversation(
        title=conversation.title,
        messages=messages_for_tagger,
    )

    conversation.entities = extract_entities(conversation)

    return conversation
