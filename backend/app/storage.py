from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from app.supabase_client import (
    get_supabase_client,
    is_supabase_configured,
    SUPABASE_BUCKET_NAME,
)

logger = logging.getLogger(__name__)


def upload_export_file(
    filename: str,
    content: bytes | str,
    source_type: str,
    conversation_id: int | None = None,
) -> dict[str, Any] | None:
    """
    Upload a raw export file to Supabase storage.
    
    Args:
        filename: Name of the file
        content: File content (bytes or string)
        source_type: Type of export (chatgpt, claude, etc.)
        conversation_id: Optional conversation ID for reference
        
    Returns:
        Dict with upload info or None if Supabase not configured
    """
    if not is_supabase_configured():
        logger.info("Supabase not configured, skipping file upload")
        return None
    
    client = get_supabase_client()
    if not client:
        logger.warning("Failed to get Supabase client")
        return None
    
    try:
        # Convert string to bytes if needed
        if isinstance(content, str):
            content = content.encode('utf-8')
        
        # Create a unique path: source_type/YYYY-MM-DD/filename
        timestamp = datetime.utcnow().strftime("%Y-%m-%d")
        storage_path = f"{source_type}/{timestamp}/{filename}"
        
        # Upload to bucket
        response = client.storage.from_(SUPABASE_BUCKET_NAME).upload(
            path=storage_path,
            file=content,
            file_options={
                "content-type": "application/json",
                "upsert": True  # Allow overwriting if file exists
            }
        )
        
        logger.info(f"Uploaded {filename} to Supabase storage at {storage_path}")
        
        return {
            "success": True,
            "path": storage_path,
            "bucket": SUPABASE_BUCKET_NAME,
            "size": len(content),
        }
    except Exception as e:
        logger.error(f"Failed to upload file to Supabase: {e}")
        return {
            "success": False,
            "error": str(e),
        }


def list_storage_files(
    source_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]] | None:
    """
    List files in Supabase storage bucket.
    
    Args:
        source_type: Optional filter by source type (chatgpt, claude, etc.)
        limit: Maximum number of files to return
        offset: Number of files to skip
        
    Returns:
        List of file metadata dicts or None if Supabase not configured
    """
    if not is_supabase_configured():
        return None
    
    client = get_supabase_client()
    if not client:
        return None
    
    try:
        # List files in bucket
        path = source_type if source_type else ""
        response = client.storage.from_(SUPABASE_BUCKET_NAME).list(
            path=path,
            options={
                "limit": limit,
                "offset": offset,
                "sortBy": {"column": "created_at", "order": "desc"}
            }
        )
        
        return response
    except Exception as e:
        logger.error(f"Failed to list storage files: {e}")
        return None


def download_storage_file(file_path: str) -> bytes | None:
    """
    Download a file from Supabase storage.
    
    Args:
        file_path: Path to the file in the bucket
        
    Returns:
        File content as bytes or None if error
    """
    if not is_supabase_configured():
        return None
    
    client = get_supabase_client()
    if not client:
        return None
    
    try:
        response = client.storage.from_(SUPABASE_BUCKET_NAME).download(file_path)
        return response
    except Exception as e:
        logger.error(f"Failed to download file from Supabase: {e}")
        return None


def delete_storage_file(file_path: str) -> bool:
    """
    Delete a file from Supabase storage.
    
    Args:
        file_path: Path to the file in the bucket
        
    Returns:
        True if successful, False otherwise
    """
    if not is_supabase_configured():
        return False
    
    client = get_supabase_client()
    if not client:
        return False
    
    try:
        client.storage.from_(SUPABASE_BUCKET_NAME).remove([file_path])
        logger.info(f"Deleted file from Supabase storage: {file_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete file from Supabase: {e}")
        return False


def get_storage_url(file_path: str) -> str | None:
    """
    Get a public URL for a file in Supabase storage.
    
    Args:
        file_path: Path to the file in the bucket
        
    Returns:
        Public URL or None if error
    """
    if not is_supabase_configured():
        return None
    
    client = get_supabase_client()
    if not client:
        return None
    
    try:
        response = client.storage.from_(SUPABASE_BUCKET_NAME).get_public_url(file_path)
        return response
    except Exception as e:
        logger.error(f"Failed to get storage URL: {e}")
        return None
