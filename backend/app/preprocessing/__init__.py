"""
ChatArchive preprocessing pipeline for Claude chat exports.

This package provides a modular pipeline for ingesting, parsing, cleaning,
classifying, and preparing Claude export data for database storage.
"""

from app.preprocessing.pipeline import PreprocessingPipeline, PipelineConfig

__all__ = ["PreprocessingPipeline", "PipelineConfig"]
