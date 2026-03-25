# -*- mode: python ; coding: utf-8 -*-
# Run from the project root:  pyinstaller chatarchive.spec

from pathlib import Path

ROOT = Path(SPECPATH)
BACKEND = ROOT / "backend"
FRONTEND_DIST = ROOT / "frontend" / "dist"

block_cipher = None

a = Analysis(
    [str(BACKEND / "app" / "main.py")],
    pathex=[str(BACKEND)],
    binaries=[],
    datas=[
        (str(FRONTEND_DIST), "frontend/dist"),
    ],
    hiddenimports=[
        # uvicorn internals not auto-detected
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        # anyio async backend
        "anyio._backends._asyncio",
        # tiktoken encoding registry
        "tiktoken_ext",
        "tiktoken_ext.openai_public",
        # SQLAlchemy — core + engine + ORM (heavy lazy-loading fools PyInstaller)
        "sqlalchemy",
        "sqlalchemy.orm",
        "sqlalchemy.orm.session",
        "sqlalchemy.orm.relationships",
        "sqlalchemy.orm.attributes",
        "sqlalchemy.orm.mapper",
        "sqlalchemy.orm.strategy_options",
        "sqlalchemy.ext.declarative",
        "sqlalchemy.engine",
        "sqlalchemy.engine.create",
        "sqlalchemy.engine.url",
        "sqlalchemy.engine.reflection",
        "sqlalchemy.pool",
        "sqlalchemy.pool.impl",
        "sqlalchemy.event",
        "sqlalchemy.sql",
        "sqlalchemy.sql.expression",
        "sqlalchemy.sql.sqltypes",
        "sqlalchemy.sql.schema",
        "sqlalchemy.sql.functions",
        "sqlalchemy.sql.operators",
        "sqlalchemy.sql.compiler",
        "sqlalchemy.sql.dml",
        "sqlalchemy.dialects",
        "sqlalchemy.dialects.postgresql",
        "sqlalchemy.dialects.postgresql.psycopg2",
        # multipart form uploads
        "multipart",
        "multipart.multipart",
        # supabase SDK and its sub-packages (all loaded dynamically)
        "supabase",
        "supabase._sync.client",
        "supabase._async.client",
        "gotrue",
        "gotrue._sync.client",
        "gotrue._async.client",
        "gotrue.types",
        "postgrest",
        "postgrest._sync.client",
        "postgrest._async.client",
        "storage3",
        "storage3._sync.client",
        "storage3._async.client",
        "realtime",
        "supafunc",
        # httpx (used by supabase SDK for all HTTP calls)
        "httpx",
        "httpcore",
        "httpcore._async",
        "httpcore._sync",
        # psycopg2 (PostgreSQL adapter, ships as a binary wheel)
        "psycopg2",
        # anyio runtime deps flagged missing by PyInstaller warn file
        "sniffio",
        "exceptiongroup",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "numpy",
        "pandas",
        "PIL",
        "scipy",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="ChatArchive",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # No terminal window — change to True to see logs
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Add a .ico path here if you have one
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="ChatArchive",
)
