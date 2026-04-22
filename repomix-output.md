This file is a merged representation of the entire codebase, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
.claude/
  settings.local.json
.github/
  workflows/
    supabase-keepalive.yml
backend/
  app/
    database/
      init_db.py
    db_scripts/
      __init__.py
      init_db.py
    importers/
      __init__.py
      chatgpt.py
      claude.py
      copilot.py
      gemini.py
    preprocessing/
      __init__.py
      classifier.py
      cleaner.py
      deduplication.py
      extractor.py
      models.py
      parser.py
      pipeline.py
      token_counter.py
    __init__.py
    database.py
    main.py
    models.py
    query_filters.py
    schemas.py
    storage.py
    supabase_client.py
    tagger.py
  tests/
    __init__.py
    test_chatgpt_parser.py
    test_claude_parser.py
    test_copilot_parser.py
    test_gemini_parser.py
    test_integration.py
    test_preprocessing.py
    test_query_filters.py
    test_tagger.py
  check_schema.py
  init_db.py
  keepalive_supabase.py
  migrate_add_fulltext_search.py
  migrate_add_projects.py
  migrate_add_tags.py
  migrate_import_history.py
  migrate_messages.py
  migrate_to_supabase.py
  pyproject.toml
  requirements.txt
  test_import.py
  verify_parsers.py
docs/
  API.md
  BROWSER_EXTENSION_IMPLEMENTATION_PLAN.md
  DEVELOPMENT.md
  IMPORT_GUIDE.md
  PROJECT_FOLDERS_IMPLEMENTATION.md
  TAGGING.md
  TESTING.md
frontend/
  public/
    favicon.svg
  src/
    components/
      ModalShell.tsx
    test/
      setup.ts
    App.test.tsx
    App.tsx
    main.tsx
    styles.css
  index.html
  package.json
  tsconfig.json
  vite.config.ts
scripts/
  dev.ps1
  dev.sh
.codex
.gitignore
build.ps1
ChatArchive.desktop
chatarchive.spec
CLAUDE.md
IMPLEMENTATION_SUMMARY.md
LICENSE
README.md
run-chatarchive.sh
```

# Files

## File: backend/app/database/init_db.py
````python
from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path to import from app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.database import engine
from app.models import Base


def init_db() -> None:
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized successfully at: {engine.url}")


if __name__ == "__main__":
    init_db()
````

## File: backend/app/db_scripts/__init__.py
````python
# Database package
````

## File: backend/app/db_scripts/init_db.py
````python
from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path to import from app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.database import engine
from app.models import Base


def init_db() -> None:
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized successfully at: {engine.url}")


if __name__ == "__main__":
    init_db()
````

## File: backend/app/importers/__init__.py
````python
# Importers package
````

## File: backend/app/importers/chatgpt.py
````python
from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def extract_messages_from_mapping(mapping: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Extract messages from ChatGPT's tree-based mapping structure.
    Traverses parent->child relationships to get messages in order.
    """
    if not mapping:
        return []
    
    # Build the message chain by following parent-child relationships
    messages = []
    
    # Find root node (has no parent or parent is null)
    root_id = None
    for node_id, node in mapping.items():
        if node.get("parent") is None:
            root_id = node_id
            break
    
    if not root_id:
        # Fallback: just iterate through all nodes
        root_id = list(mapping.keys())[0]
    
    # Traverse the tree depth-first
    def traverse(node_id: str, order: int) -> int:
        node = mapping.get(node_id)
        if not node:
            return order
        
        message = node.get("message")
        if message and should_include_message(message):
            msg_data = parse_message(message, order)
            if msg_data:
                messages.append(msg_data)
                order += 1
        
        # Follow children
        for child_id in node.get("children", []):
            order = traverse(child_id, order)
        
        return order
    
    traverse(root_id, 0)
    return messages


def should_include_message(message: dict[str, Any]) -> bool:
    """Determine if a message should be included (skip hidden system messages)."""
    if not message:
        return False
    
    metadata = message.get("metadata", {})
    
    # Skip visually hidden messages
    if metadata.get("is_visually_hidden_from_conversation"):
        return False
    
    # Get content
    content = message.get("content", {})
    content_type = content.get("content_type", "")
    
    # Skip certain content types that aren't displayable
    if content_type in ("user_editable_context", "system_error"):
        return False
    
    # Get author role
    author = message.get("author", {})
    role = author.get("role", "")
    
    # Include user and assistant messages
    if role in ("user", "assistant"):
        return True
    
    # Include tool messages (for function calls)
    if role == "tool":
        return True
    
    return False


def parse_message(message: dict[str, Any], order: int) -> dict[str, Any] | None:
    """Parse a single message into our normalized format."""
    author = message.get("author", {})
    role = author.get("role", "unknown")
    
    content = message.get("content", {})
    content_type = content.get("content_type", "text")
    
    # Extract text content
    parts = content.get("parts", [])
    text_content = ""
    if parts:
        # Join all text parts
        text_parts = [p for p in parts if isinstance(p, str)]
        text_content = "\n".join(text_parts)
    
    # Skip empty messages
    if not text_content.strip():
        return None
    
    # Parse timestamp
    create_time = message.get("create_time")
    created_at = None
    if create_time:
        try:
            created_at = datetime.fromtimestamp(create_time)
        except (OSError, TypeError, ValueError):
            pass
    
    # Extract model info
    metadata = message.get("metadata", {})
    model = metadata.get("model_slug")
    
    return {
        "source_id": message.get("id"),
        "role": role,
        "content": text_content,
        "content_type": content_type if content_type == "text" else content_type,
        "created_at": created_at,
        "order_index": order,
        "model": model,
    }


def parse_chatgpt_export(payload: Any) -> list[dict[str, Any]]:
    """Parse a ChatGPT export file into conversations with messages."""
    conversations = None
    if isinstance(payload, dict):
        conversations = payload.get("conversations")
    elif isinstance(payload, list):
        conversations = payload

    if conversations is None:
        raise ValueError("Unrecognized ChatGPT export format")

    parsed = []
    for item in conversations:
        title = item.get("title")
        
        # Parse timestamps
        create_time = item.get("create_time")
        update_time = item.get("update_time")
        
        created_at = None
        if create_time is not None:
            try:
                created_at = datetime.fromtimestamp(create_time)
            except (OSError, TypeError, ValueError):
                pass
        
        updated_at = None
        if update_time is not None:
            try:
                updated_at = datetime.fromtimestamp(update_time)
            except (OSError, TypeError, ValueError):
                pass
        
        # Extract messages from mapping
        mapping = item.get("mapping", {})
        messages = extract_messages_from_mapping(mapping)
        
        parsed.append({
            "source": "chatgpt",
            "source_id": item.get("id") or item.get("conversation_id"),
            "title": title,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,  # Include parsed messages
        })
    
    return parsed
````

## File: backend/app/__init__.py
````python

````

## File: backend/migrate_messages.py
````python
#!/usr/bin/env python
"""
Migration script to parse existing raw_json data and populate the messages table.
Run this after updating the database schema.
"""

import json
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import Base, Conversation, Message
from app.importers.chatgpt import extract_messages_from_mapping


def add_missing_columns():
    """Add new columns to existing tables if they don't exist."""
    print("Checking for missing columns...")
    
    with engine.connect() as conn:
        # Check conversations table columns
        result = conn.execute(text("PRAGMA table_info(conversations)"))
        existing_cols = {row[1] for row in result.fetchall()}
        
        # Add missing columns to conversations
        new_cols = {
            "source_id": "VARCHAR(255)",
            "updated_at": "DATETIME",
            "message_count": "INTEGER DEFAULT 0",
        }
        
        for col, col_type in new_cols.items():
            if col not in existing_cols:
                print(f"  Adding column: conversations.{col}")
                conn.execute(text(f"ALTER TABLE conversations ADD COLUMN {col} {col_type}"))
        
        conn.commit()
        
    # Create messages table if it doesn't exist
    Base.metadata.create_all(bind=engine)
    print("Schema updated.")


def migrate_messages():
    """Parse raw_json from existing conversations and create message records."""
    
    # First, add missing columns
    add_missing_columns()
    
    db = SessionLocal()
    
    try:
        # Check if messages already exist
        existing_count = db.query(Message).count()
        if existing_count > 0:
            print(f"⚠️  Messages table already has {existing_count} records.")
            response = input("Do you want to clear and re-import? (y/N): ")
            if response.lower() != 'y':
                print("Aborted.")
                return
            db.query(Message).delete()
            db.commit()
            print("Cleared existing messages.")
        
        # Get all conversations
        conversations = db.query(Conversation).all()
        total = len(conversations)
        print(f"Processing {total} conversations...")
        
        total_messages = 0
        errors = 0
        
        for i, convo in enumerate(conversations, 1):
            try:
                # Parse raw_json
                data = json.loads(convo.raw_json)
                
                # Handle different sources
                if convo.source == "chatgpt":
                    mapping = data.get("mapping", {})
                    messages = extract_messages_from_mapping(mapping)
                else:
                    # Skip unsupported sources for now
                    messages = []
                
                # Create message records
                for msg_data in messages:
                    message = Message(conversation_id=convo.id, **msg_data)
                    db.add(message)
                
                # Update conversation message count
                convo.message_count = len(messages)
                
                # Update source_id if missing
                if not convo.source_id:
                    convo.source_id = data.get("id") or data.get("conversation_id")
                
                # Update updated_at if missing
                if not convo.updated_at:
                    update_time = data.get("update_time")
                    if update_time:
                        try:
                            from datetime import datetime
                            convo.updated_at = datetime.fromtimestamp(update_time)
                        except (OSError, TypeError, ValueError):
                            pass
                
                total_messages += len(messages)
                
                # Progress indicator
                if i % 100 == 0 or i == total:
                    print(f"  Processed {i}/{total} conversations ({total_messages} messages)")
                    db.commit()
                    
            except Exception as e:
                errors += 1
                print(f"  ⚠️  Error processing conversation {convo.id}: {e}")
                continue
        
        db.commit()
        
        print(f"\n✓ Migration complete!")
        print(f"  Conversations: {total}")
        print(f"  Messages extracted: {total_messages}")
        if errors:
            print(f"  Errors: {errors}")
            
    finally:
        db.close()


if __name__ == "__main__":
    migrate_messages()
````

## File: frontend/src/main.tsx
````typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
````

## File: frontend/tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
````

## File: LICENSE
````
GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The GNU General Public License is a free, copyleft license for
software and other kinds of works.

  The licenses for most software and other practical works are designed
to take away your freedom to share and change the works.  By contrast,
the GNU General Public License is intended to guarantee your freedom to
share and change all versions of a program--to make sure it remains free
software for all its users.  We, the Free Software Foundation, use the
GNU General Public License for most of our software; it applies also to
any other work released this way by its authors.  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
them if you wish), that you receive source code or can get it if you
want it, that you can change the software or use pieces of it in new
free programs, and that you know you can do these things.

  To protect your rights, we need to prevent others from denying you
these rights or asking you to surrender the rights.  Therefore, you have
certain responsibilities if you distribute copies of the software, or if
you modify it: responsibilities to respect the freedom of others.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must pass on to the recipients the same
freedoms that you received.  You must make sure that they, too, receive
or can get the source code.  And you must show them these terms so they
know their rights.

  Developers that use the GNU GPL protect your rights with two steps:
(1) assert copyright on the software, and (2) offer you this License
giving you legal permission to copy, distribute and/or modify it.

  For the developers' and authors' protection, the GPL clearly explains
that there is no warranty for this free software.  For both users' and
authors' sake, the GPL requires that modified versions be marked as
changed, so that their problems will not be attributed erroneously to
authors of previous versions.

  Some devices are designed to deny users access to install or run
modified versions of the software inside them, although the manufacturer
can do so.  This is fundamentally incompatible with the aim of
protecting users' freedom to change the software.  The systematic
pattern of such abuse occurs in the area of products for individuals to
use, which is precisely where it is most unacceptable.  Therefore, we
have designed this version of the GPL to prohibit the practice for those
products.  If such problems arise substantially in other domains, we
stand ready to extend this provision to those domains in future versions
of the GPL, as needed to protect the freedom of users.

  Finally, every program is threatened constantly by software patents.
States should not allow patents to restrict development and use of
software on general-purpose computers, but in those that do, we wish to
avoid the special danger that patents applied to a free program could
make it effectively proprietary.  To prevent this, the GPL assures that
patents cannot be used to render the program non-free.

  The precise terms and conditions for copying, distribution and
modification follow.

                       TERMS AND CONDITIONS

  0. Definitions.

  "This License" refers to version 3 of the GNU General Public License.

  "Copyright" also means copyright-like laws that apply to other kinds of
works, such as semiconductor masks.

  "The Program" refers to any copyrightable work licensed under this
License.  Each licensee is addressed as "you".  "Licensees" and
"recipients" may be individuals or organizations.

  To "modify" a work means to copy from or adapt all or part of the work
in a fashion requiring copyright permission, other than the making of an
exact copy.  The resulting work is called a "modified version" of the
earlier work or a work "based on" the earlier work.

  A "covered work" means either the unmodified Program or a work based
on the Program.

  To "propagate" a work means to do anything with it that, without
permission, would make you directly or secondarily liable for
infringement under applicable copyright law, except executing it on a
computer or modifying a private copy.  Propagation includes copying,
distribution (with or without modification), making available to the
public, and in some countries other activities as well.

  To "convey" a work means any kind of propagation that enables other
parties to make or receive copies.  Mere interaction with a user through
a computer network, with no transfer of a copy, is not conveying.

  An interactive user interface displays "Appropriate Legal Notices"
to the extent that it includes a convenient and prominently visible
feature that (1) displays an appropriate copyright notice, and (2)
tells the user that there is no warranty for the work (except to the
extent that warranties are provided), that licensees may convey the
work under this License, and how to view a copy of this License.  If
the interface presents a list of user commands or options, such as a
menu, a prominent item in the list meets this criterion.

  1. Source Code.

  The "source code" for a work means the preferred form of the work
for making modifications to it.  "Object code" means any non-source
form of a work.

  A "Standard Interface" means an interface that either is an official
standard defined by a recognized standards body, or, in the case of
interfaces specified for a particular programming language, one that
is widely used among developers working in that language.

  The "System Libraries" of an executable work include anything, other
than the work as a whole, that (a) is included in the normal form of
packaging a Major Component, but which is not part of that Major
Component, and (b) serves only to enable use of the work with that
Major Component, or to implement a Standard Interface for which an
implementation is available to the public in source code form.  A
"Major Component", in this context, means a major essential component
(kernel, window system, and so on) of the specific operating system
(if any) on which the executable work runs, or a compiler used to
produce the work, or an object code interpreter used to run it.

  The "Corresponding Source" for a work in object code form means all
the source code needed to generate, install, and (for an executable
work) run the object code and to modify the work, including scripts to
control those activities.  However, it does not include the work's
System Libraries, or general-purpose tools or generally available free
programs which are used unmodified in performing those activities but
which are not part of the work.  For example, Corresponding Source
includes interface definition files associated with source files for
the work, and the source code for shared libraries and dynamically
linked subprograms that the work is specifically designed to require,
such as by intimate data communication or control flow between those
subprograms and other parts of the work.

  The Corresponding Source need not include anything that users
can regenerate automatically from other parts of the Corresponding
Source.

  The Corresponding Source for a work in source code form is that
same work.

  2. Basic Permissions.

  All rights granted under this License are granted for the term of
copyright on the Program, and are irrevocable provided the stated
conditions are met.  This License explicitly affirms your unlimited
permission to run the unmodified Program.  The output from running a
covered work is covered by this License only if the output, given its
content, constitutes a covered work.  This License acknowledges your
rights of fair use or other equivalent, as provided by copyright law.

  You may make, run and propagate covered works that you do not
convey, without conditions so long as your license otherwise remains
in force.  You may convey covered works to others for the sole purpose
of having them make modifications exclusively for you, or provide you
with facilities for running those works, provided that you comply with
the terms of this License in conveying all material for which you do
not control copyright.  Those thus making or running the covered works
for you must do so exclusively on your behalf, under your direction
and control, on terms that prohibit them from making any copies of
your copyrighted material outside their relationship with you.

  Conveying under any other circumstances is permitted solely under
the conditions stated below.  Sublicensing is not allowed; section 10
makes it unnecessary.

  3. Protecting Users' Legal Rights From Anti-Circumvention Law.

  No covered work shall be deemed part of an effective technological
measure under any applicable law fulfilling obligations under article
11 of the WIPO copyright treaty adopted on 20 December 1996, or
similar laws prohibiting or restricting circumvention of such
measures.

  When you convey a covered work, you waive any legal power to forbid
circumvention of technological measures to the extent such circumvention
is effected by exercising rights under this License with respect to
the covered work, and you disclaim any intention to limit operation or
modification of the work as a means of enforcing, against the work's
users, your or third parties' legal rights to forbid circumvention of
technological measures.

  4. Conveying Verbatim Copies.

  You may convey verbatim copies of the Program's source code as you
receive it, in any medium, provided that you conspicuously and
appropriately publish on each copy an appropriate copyright notice;
keep intact all notices stating that this License and any
non-permissive terms added in accord with section 7 apply to the code;
keep intact all notices of the absence of any warranty; and give all
recipients a copy of this License along with the Program.

  You may charge any price or no price for each copy that you convey,
and you may offer support or warranty protection for a fee.

  5. Conveying Modified Source Versions.

  You may convey a work based on the Program, or the modifications to
produce it from the Program, in the form of source code under the
terms of section 4, provided that you also meet all of these conditions:

    a) The work must carry prominent notices stating that you modified
    it, and giving a relevant date.

    b) The work must carry prominent notices stating that it is
    released under this License and any conditions added under section
    7.  This requirement modifies the requirement in section 4 to
    "keep intact all notices".

    c) You must license the entire work, as a whole, under this
    License to anyone who comes into possession of a copy.  This
    License will therefore apply, along with any applicable section 7
    additional terms, to the whole of the work, and all its parts,
    regardless of how they are packaged.  This License gives no
    permission to license the work in any other way, but it does not
    invalidate such permission if you have separately received it.

    d) If the work has interactive user interfaces, each must display
    Appropriate Legal Notices; however, if the Program has interactive
    interfaces that do not display Appropriate Legal Notices, your
    work need not make them do so.

  A compilation of a covered work with other separate and independent
works, which are not by their nature extensions of the covered work,
and which are not combined with it such as to form a larger program,
in or on a volume of a storage or distribution medium, is called an
"aggregate" if the compilation and its resulting copyright are not
used to limit the access or legal rights of the compilation's users
beyond what the individual works permit.  Inclusion of a covered work
in an aggregate does not cause this License to apply to the other
parts of the aggregate.

  6. Conveying Non-Source Forms.

  You may convey a covered work in object code form under the terms
of sections 4 and 5, provided that you also convey the
machine-readable Corresponding Source under the terms of this License,
in one of these ways:

    a) Convey the object code in, or embodied in, a physical product
    (including a physical distribution medium), accompanied by the
    Corresponding Source fixed on a durable physical medium
    customarily used for software interchange.

    b) Convey the object code in, or embodied in, a physical product
    (including a physical distribution medium), accompanied by a
    written offer, valid for at least three years and valid for as
    long as you offer spare parts or customer support for that product
    model, to give anyone who possesses the object code either (1) a
    copy of the Corresponding Source for all the software in the
    product that is covered by this License, on a durable physical
    medium customarily used for software interchange, for a price no
    more than your reasonable cost of physically performing this
    conveying of source, or (2) access to copy the
    Corresponding Source from a network server at no charge.

    c) Convey individual copies of the object code with a copy of the
    written offer to provide the Corresponding Source.  This
    alternative is allowed only occasionally and noncommercially, and
    only if you received the object code with such an offer, in accord
    with subsection 6b.

    d) Convey the object code by offering access from a designated
    place (gratis or for a charge), and offer equivalent access to the
    Corresponding Source in the same way through the same place at no
    further charge.  You need not require recipients to copy the
    Corresponding Source along with the object code.  If the place to
    copy the object code is a network server, the Corresponding Source
    may be on a different server (operated by you or a third party)
    that supports equivalent copying facilities, provided you maintain
    clear directions next to the object code saying where to find the
    Corresponding Source.  Regardless of what server hosts the
    Corresponding Source, you remain obligated to ensure that it is
    available for as long as needed to satisfy these requirements.

    e) Convey the object code using peer-to-peer transmission, provided
    you inform other peers where the object code and Corresponding
    Source of the work are being offered to the general public at no
    charge under subsection 6d.

  A separable portion of the object code, whose source code is excluded
from the Corresponding Source as a System Library, need not be
included in conveying the object code work.

  A "User Product" is either (1) a "consumer product", which means any
tangible personal property which is normally used for personal, family,
or household purposes, or (2) anything designed or sold for incorporation
into a dwelling.  In determining whether a product is a consumer product,
doubtful cases shall be resolved in favor of coverage.  For a particular
product received by a particular user, "normally used" refers to a
typical or common use of that class of product, regardless of the status
of the particular user or of the way in which the particular user
actually uses, or expects or is expected to use, the product.  A product
is a consumer product regardless of whether the product has substantial
commercial, industrial or non-consumer uses, unless such uses represent
the only significant mode of use of the product.

  "Installation Information" for a User Product means any methods,
procedures, authorization keys, or other information required to install
and execute modified versions of a covered work in that User Product from
a modified version of its Corresponding Source.  The information must
suffice to ensure that the continued functioning of the modified object
code is in no case prevented or interfered with solely because
modification has been made.

  If you convey an object code work under this section in, or with, or
specifically for use in, a User Product, and the conveying occurs as
part of a transaction in which the right of possession and use of the
User Product is transferred to the recipient in perpetuity or for a
fixed term (regardless of how the transaction is characterized), the
Corresponding Source conveyed under this section must be accompanied
by the Installation Information.  But this requirement does not apply
if neither you nor any third party retains the ability to install
modified object code on the User Product (for example, the work has
been installed in ROM).

  The requirement to provide Installation Information does not include a
requirement to continue to provide support service, warranty, or updates
for a work that has been modified or installed by the recipient, or for
the User Product in which it has been modified or installed.  Access to a
network may be denied when the modification itself materially and
adversely affects the operation of the network or violates the rules and
protocols for communication across the network.

  Corresponding Source conveyed, and Installation Information provided,
in accord with this section must be in a format that is publicly
documented (and with an implementation available to the public in
source code form), and must require no special password or key for
unpacking, reading or copying.

  7. Additional Terms.

  "Additional permissions" are terms that supplement the terms of this
License by making exceptions from one or more of its conditions.
Additional permissions that are applicable to the entire Program shall
be treated as though they were included in this License, to the extent
that they are valid under applicable law.  If additional permissions
apply only to part of the Program, that part may be used separately
under those permissions, but the entire Program remains governed by
this License without regard to the additional permissions.

  When you convey a copy of a covered work, you may at your option
remove any additional permissions from that copy, or from any part of
it.  (Additional permissions may be written to require their own
removal in certain cases when you modify the work.)  You may place
additional permissions on material, added by you to a covered work,
for which you have or can give appropriate copyright permission.

  Notwithstanding any other provision of this License, for material you
add to a covered work, you may (if authorized by the copyright holders of
that material) supplement the terms of this License with terms:

    a) Disclaiming warranty or limiting liability differently from the
    terms of sections 15 and 16 of this License; or

    b) Requiring preservation of specified reasonable legal notices or
    author attributions in that material or in the Appropriate Legal
    Notices displayed by works containing it; or

    c) Prohibiting misrepresentation of the origin of that material, or
    requiring that modified versions of such material be marked in
    reasonable ways as different from the original version; or

    d) Limiting the use for publicity purposes of names of licensors or
    authors of the material; or

    e) Declining to grant rights under trademark law for use of some
    trade names, trademarks, or service marks; or

    f) Requiring indemnification of licensors and authors of that
    material by anyone who conveys the material (or modified versions of
    it) with contractual assumptions of liability to the recipient, for
    any liability that these contractual assumptions directly impose on
    those licensors and authors.

  All other non-permissive additional terms are considered "further
restrictions" within the meaning of section 10.  If the Program as you
received it, or any part of it, contains a notice stating that it is
governed by this License along with a term that is a further
restriction, you may remove that term.  If a license document contains
a further restriction but permits relicensing or conveying under this
License, you may add to a covered work material governed by the terms
of that license document, provided that the further restriction does
not survive such relicensing or conveying.

  If you add terms to a covered work in accord with this section, you
must place, in the relevant source files, a statement of the
additional terms that apply to those files, or a notice indicating
where to find the applicable terms.

  Additional terms, permissive or non-permissive, may be stated in the
form of a separately written license, or stated as exceptions;
the above requirements apply either way.

  8. Termination.

  You may not propagate or modify a covered work except as expressly
provided under this License.  Any attempt otherwise to propagate or
modify it is void, and will automatically terminate your rights under
this License (including any patent licenses granted under the third
paragraph of section 11).

  However, if you cease all violation of this License, then your
license from a particular copyright holder is reinstated (a)
provisionally, unless and until the copyright holder explicitly and
finally terminates your license, and (b) permanently, if the copyright
holder fails to notify you of the violation by some reasonable means
prior to 60 days after the cessation.

  Moreover, your license from a particular copyright holder is
reinstated permanently if the copyright holder notifies you of the
violation by some reasonable means, this is the first time you have
received notice of violation of this License (for any work) from that
copyright holder, and you cure the violation prior to 30 days after
your receipt of the notice.

  Termination of your rights under this section does not terminate the
licenses of parties who have received copies or rights from you under
this License.  If your rights have been terminated and not permanently
reinstated, you do not qualify to receive new licenses for the same
material under section 10.

  9. Acceptance Not Required for Having Copies.

  You are not required to accept this License in order to receive or
run a copy of the Program.  Ancillary propagation of a covered work
occurring solely as a consequence of using peer-to-peer transmission
to receive a copy likewise does not require acceptance.  However,
nothing other than this License grants you permission to propagate or
modify any covered work.  These actions infringe copyright if you do
not accept this License.  Therefore, by modifying or propagating a
covered work, you indicate your acceptance of this License to do so.

  10. Automatic Licensing of Downstream Recipients.

  Each time you convey a covered work, the recipient automatically
receives a license from the original licensors, to run, modify and
propagate that work, subject to this License.  You are not responsible
for enforcing compliance by third parties with this License.

  An "entity transaction" is a transaction transferring control of an
organization, or substantially all assets of one, or subdividing an
organization, or merging organizations.  If propagation of a covered
work results from an entity transaction, each party to that
transaction who receives a copy of the work also receives whatever
licenses to the work the party's predecessor in interest had or could
give under the previous paragraph, plus a right to possession of the
Corresponding Source of the work from the predecessor in interest, if
the predecessor has it or can get it with reasonable efforts.

  You may not impose any further restrictions on the exercise of the
rights granted or affirmed under this License.  For example, you may
not impose a license fee, royalty, or other charge for exercise of
rights granted under this License, and you may not initiate litigation
(including a cross-claim or counterclaim in a lawsuit) alleging that
any patent claim is infringed by making, using, selling, offering for
sale, or importing the Program or any portion of it.

  11. Patents.

  A "contributor" is a copyright holder who authorizes use under this
License of the Program or a work on which the Program is based.  The
work thus licensed is called the contributor's "contributor version".

  A contributor's "essential patent claims" are all patent claims
owned or controlled by the contributor, whether already acquired or
hereafter acquired, that would be infringed by some manner, permitted
by this License, of making, using, or selling its contributor version,
but do not include claims that would be infringed only as a
consequence of further modification of the contributor version.  For
purposes of this definition, "control" includes the right to grant
patent sublicenses in a manner consistent with the requirements of
this License.

  Each contributor grants you a non-exclusive, worldwide, royalty-free
patent license under the contributor's essential patent claims, to
make, use, sell, offer for sale, import and otherwise run, modify and
propagate the contents of its contributor version.

  In the following three paragraphs, a "patent license" is any express
agreement or commitment, however denominated, not to enforce a patent
(such as an express permission to practice a patent or covenant not to
sue for patent infringement).  To "grant" such a patent license to a
party means to make such an agreement or commitment not to enforce a
patent against the party.

  If you convey a covered work, knowingly relying on a patent license,
and the Corresponding Source of the work is not available for anyone
to copy, free of charge and under the terms of this License, through a
publicly available network server or other readily accessible means,
then you must either (1) cause the Corresponding Source to be so
available, or (2) arrange to deprive yourself of the benefit of the
patent license for this particular work, or (3) arrange, in a manner
consistent with the requirements of this License, to extend the patent
license to downstream recipients.  "Knowingly relying" means you have
actual knowledge that, but for the patent license, your conveying the
covered work in a country, or your recipient's use of the covered work
in a country, would infringe one or more identifiable patents in that
country that you have reason to believe are valid.

  If, pursuant to or in connection with a single transaction or
arrangement, you convey, or propagate by procuring conveyance of, a
covered work, and grant a patent license to some of the parties
receiving the covered work authorizing them to use, propagate, modify
or convey a specific copy of the covered work, then the patent license
you grant is automatically extended to all recipients of the covered
work and works based on it.

  A patent license is "discriminatory" if it does not include within
the scope of its coverage, prohibits the exercise of, or is
conditioned on the non-exercise of one or more of the rights that are
specifically granted under this License.  You may not convey a covered
work if you are a party to an arrangement with a third party that is
in the business of distributing software, under which you make payment
to the third party based on the extent of your activity of conveying
the work, and under which the third party grants, to any of the
parties who would receive the covered work from you, a discriminatory
patent license (a) in connection with copies of the covered work
conveyed by you (or copies made from those copies), or (b) primarily
for and in connection with specific products or compilations that
contain the covered work, unless you entered into that arrangement,
or that patent license was granted, prior to 28 March 2007.

  Nothing in this License shall be construed as excluding or limiting
any implied license or other defenses to infringement that may
otherwise be available to you under applicable patent law.

  12. No Surrender of Others' Freedom.

  If conditions are imposed on you (whether by court order, agreement or
otherwise) that contradict the conditions of this License, they do not
excuse you from the conditions of this License.  If you cannot convey a
covered work so as to satisfy simultaneously your obligations under this
License and any other pertinent obligations, then as a consequence you may
not convey it at all.  For example, if you agree to terms that obligate you
to collect a royalty for further conveying from those to whom you convey
the Program, the only way you could satisfy both those terms and this
License would be to refrain entirely from conveying the Program.

  13. Use with the GNU Affero General Public License.

  Notwithstanding any other provision of this License, you have
permission to link or combine any covered work with a work licensed
under version 3 of the GNU Affero General Public License into a single
combined work, and to convey the resulting work.  The terms of this
License will continue to apply to the part which is the covered work,
but the special requirements of the GNU Affero General Public License,
section 13, concerning interaction through a network will apply to the
combination as such.

  14. Revised Versions of this License.

  The Free Software Foundation may publish revised and/or new versions of
the GNU General Public License from time to time.  Such new versions will
be similar in spirit to the present version, but may differ in detail to
address new problems or concerns.

  Each version is given a distinguishing version number.  If the
Program specifies that a certain numbered version of the GNU General
Public License "or any later version" applies to it, you have the
option of following the terms and conditions either of that numbered
version or of any later version published by the Free Software
Foundation.  If the Program does not specify a version number of the
GNU General Public License, you may choose any version ever published
by the Free Software Foundation.

  If the Program specifies that a proxy can decide which future
versions of the GNU General Public License can be used, that proxy's
public statement of acceptance of a version permanently authorizes you
to choose that version for the Program.

  Later license versions may give you additional or different
permissions.  However, no additional obligations are imposed on any
author or copyright holder as a result of your choosing to follow a
later version.

  15. Disclaimer of Warranty.

  THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY
APPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT
HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY
OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM
IS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF
ALL NECESSARY SERVICING, REPAIR OR CORRECTION.

  16. Limitation of Liability.

  IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING
WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MODIFIES AND/OR CONVEYS
THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES, INCLUDING ANY
GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE
USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED TO LOSS OF
DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY YOU OR THIRD
PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER PROGRAMS),
EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF
SUCH DAMAGES.

  17. Interpretation of Sections 15 and 16.

  If the disclaimer of warranty and limitation of liability provided
above cannot be given local legal effect according to their terms,
reviewing courts shall apply local law that most closely approximates
an absolute waiver of all civil liability in connection with the
Program, unless a warranty or assumption of liability accompanies a
copy of the Program in return for a fee.

                     END OF TERMS AND CONDITIONS

            How to Apply These Terms to Your New Programs

  If you develop a new program, and you want it to be of the greatest
possible use to the public, the best way to achieve this is to make it
free software which everyone can redistribute and change under these terms.

  To do so, attach the following notices to the program.  It is safest
to attach them to the start of each source file to most effectively
state the exclusion of warranty; and each file should have at least
the "copyright" line and a pointer to where the full notice is found.

    <one line to give the program's name and a brief idea of what it does.>
    Copyright (C) <year>  <name of author>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

Also add information on how to contact you by electronic and paper mail.

  If the program does terminal interaction, make it output a short
notice like this when it starts in an interactive mode:

    <program>  Copyright (C) <year>  <name of author>
    This program comes with ABSOLUTELY NO WARRANTY; for details type `show w'.
    This is free software, and you are welcome to redistribute it
    under certain conditions; type `show c' for details.

The hypothetical commands `show w' and `show c' should show the appropriate
parts of the General Public License.  Of course, your program's commands
might be different; for a GUI interface, you would use an "about box".

  You should also get your employer (if you work as a programmer) or school,
if any, to sign a "copyright disclaimer" for the program, if necessary.
For more information on this, and how to apply and follow the GNU GPL, see
<https://www.gnu.org/licenses/>.

  The GNU General Public License does not permit incorporating your program
into proprietary programs.  If your program is a subroutine library, you
may consider it more useful to permit linking proprietary applications with
the library.  If this is what you want to do, use the GNU Lesser General
Public License instead of this License.  But first, please read
<https://www.gnu.org/licenses/why-not-lgpl.html>.
````

## File: backend/app/importers/copilot.py
````python
from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def parse_copilot_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a GitHub Copilot Chat export file into conversations with messages.
    
    Copilot exports may include:
    - VS Code chat history
    - GitHub.com chat conversations
    """
    conversations = None
    
    # Detect format
    if isinstance(payload, list):
        conversations = payload
    elif isinstance(payload, dict):
        # Check for various Copilot export formats
        conversations = (
            payload.get("conversations") or
            payload.get("sessions") or
            payload.get("chats") or
            [payload]
        )
    
    if not conversations:
        raise ValueError("Unrecognized Copilot export format")
    
    parsed = []
    for item in conversations:
        # Extract conversation metadata
        conv_id = item.get("id") or item.get("sessionId") or item.get("conversationId")
        title = item.get("title") or item.get("name") or extract_title_from_first_message(item)
        
        # Parse timestamps
        created_at = parse_timestamp(
            item.get("createdAt") or 
            item.get("created_at") or
            item.get("startTime") or
            item.get("timestamp")
        )
        updated_at = parse_timestamp(
            item.get("updatedAt") or 
            item.get("updated_at") or
            item.get("lastMessageTime")
        )
        
        # Extract messages
        messages_data = (
            item.get("messages") or
            item.get("exchanges") or
            item.get("turns") or
            []
        )
        
        messages = []
        for idx, msg in enumerate(messages_data):
            # Determine role
            role = determine_role(msg)
            
            # Get content
            content = extract_content(msg)
            if not content.strip():
                continue
            
            # Parse message timestamp
            msg_created = parse_timestamp(
                msg.get("timestamp") or
                msg.get("createdAt") or
                msg.get("created_at")
            )
            
            messages.append({
                "source_id": msg.get("id") or msg.get("messageId"),
                "role": role,
                "content": content,
                "content_type": detect_content_type(msg),
                "created_at": msg_created or created_at,
                "order_index": idx,
                "model": msg.get("model") or "copilot",
            })
        
        # If no title, generate from first user message
        if not title or title == "Untitled":
            title = generate_title_from_messages(messages)
        
        parsed.append({
            "source": "copilot",
            "source_id": conv_id,
            "title": title,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,
        })
    
    return parsed


def determine_role(msg: dict[str, Any]) -> str:
    """Determine message role from Copilot message format."""
    role = msg.get("role") or msg.get("author") or msg.get("sender") or msg.get("type")
    
    if role:
        role_lower = str(role).lower()
        if role_lower in ("user", "human", "question"):
            return "user"
        elif role_lower in ("assistant", "copilot", "ai", "answer", "response"):
            return "assistant"
        elif role_lower in ("system", "context"):
            return "system"
    
    # Check if it's a request vs response
    if msg.get("request") or msg.get("query") or msg.get("prompt"):
        return "user"
    
    return "assistant"


def extract_content(msg: dict[str, Any]) -> str:
    """Extract text content from Copilot message format."""
    # Try multiple possible content fields
    content = (
        msg.get("content") or
        msg.get("text") or
        msg.get("message") or
        msg.get("response") or
        msg.get("request") or
        msg.get("query") or
        ""
    )
    
    # Handle nested content structures
    if isinstance(content, dict):
        content = (
            content.get("text") or
            content.get("value") or
            content.get("content") or
            ""
        )
    elif isinstance(content, list):
        # Join multiple content parts
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text") or part.get("value") or "")
        content = "\n".join(parts)
    
    return str(content)


def detect_content_type(msg: dict[str, Any]) -> str:
    """Detect if message contains code or is plain text."""
    content = extract_content(msg)
    
    # Check for code indicators
    if "```" in content or msg.get("hasCode") or msg.get("isCode"):
        return "code"
    
    return "text"


def extract_title_from_first_message(item: dict[str, Any]) -> str:
    """Extract title from the first user message."""
    messages = item.get("messages") or item.get("exchanges") or []
    
    for msg in messages:
        if determine_role(msg) == "user":
            content = extract_content(msg)
            if content:
                # Take first 60 chars
                return content[:60] + ("..." if len(content) > 60 else "")
    
    return "Untitled Conversation"


def generate_title_from_messages(messages: list[dict[str, Any]]) -> str:
    """Generate a title from the first user message."""
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if content:
                # Clean and truncate
                title = content.strip().split("\n")[0]
                return title[:60] + ("..." if len(title) > 60 else "")
    
    return "Untitled Conversation"


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Copilot."""
    if not timestamp:
        return None
    
    try:
        # Try ISO format
        if isinstance(timestamp, str):
            # Handle ISO 8601 with timezone
            timestamp = timestamp.replace("Z", "+00:00")
            try:
                return datetime.fromisoformat(timestamp.replace("+00:00", ""))
            except ValueError:
                # Try other formats
                for fmt in ["%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"]:
                    try:
                        return datetime.strptime(timestamp.split("+")[0].split("Z")[0], fmt)
                    except ValueError:
                        continue
        # Try Unix timestamp
        elif isinstance(timestamp, (int, float)):
            if timestamp > 1e12:  # Milliseconds
                timestamp = timestamp / 1000
            return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError, TypeError):
        pass
    
    return None
````

## File: backend/app/importers/gemini.py
````python
from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def parse_gemini_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a Gemini/Bard export file into conversations with messages.
    
    Google Takeout format typically has conversations in a structured format.
    Gemini exports may include:
    - conversations array
    - individual chat history items
    """
    conversations = None
    
    # Detect format
    if isinstance(payload, list):
        conversations = payload
    elif isinstance(payload, dict):
        # Check for various Google export formats
        conversations = (
            payload.get("conversations") or 
            payload.get("chats") or
            payload.get("history") or
            [payload]
        )
    
    if not conversations:
        raise ValueError("Unrecognized Gemini export format")
    
    parsed = []
    for item in conversations:
        # Extract conversation metadata
        conv_id = item.get("id") or item.get("conversation_id")
        title = item.get("title") or item.get("name") or "Untitled"
        
        # Parse timestamps
        created_at = parse_timestamp(
            item.get("create_time") or 
            item.get("created_at") or 
            item.get("timestamp")
        )
        updated_at = parse_timestamp(
            item.get("update_time") or 
            item.get("updated_at")
        )
        
        # Extract messages - handle multiple possible structures
        messages_data = (
            item.get("messages") or 
            item.get("turns") or 
            item.get("content") or
            []
        )
        
        messages = []
        for idx, msg in enumerate(messages_data):
            # Determine role
            role = determine_role(msg)
            
            # Get content - Gemini may use different keys
            content = extract_content(msg)
            if not content.strip():
                continue
            
            # Parse message timestamp
            msg_created = parse_timestamp(
                msg.get("timestamp") or 
                msg.get("created_at") or
                msg.get("create_time")
            )
            
            messages.append({
                "source_id": msg.get("id") or msg.get("message_id"),
                "role": role,
                "content": content,
                "content_type": "text",
                "created_at": msg_created or created_at,
                "order_index": idx,
                "model": msg.get("model") or item.get("model") or "gemini",
            })
        
        parsed.append({
            "source": "gemini",
            "source_id": conv_id,
            "title": title,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,
        })
    
    return parsed


def determine_role(msg: dict[str, Any]) -> str:
    """Determine message role from various Gemini message formats."""
    # Check common role fields
    role = msg.get("role") or msg.get("author") or msg.get("sender")
    
    if role:
        role_lower = str(role).lower()
        if role_lower in ("user", "human"):
            return "user"
        elif role_lower in ("model", "assistant", "ai", "gemini", "bard"):
            return "assistant"
    
    # Fallback: check if it's marked as user content
    if msg.get("user_input") or msg.get("prompt"):
        return "user"
    
    return "assistant"


def extract_content(msg: dict[str, Any]) -> str:
    """Extract text content from various Gemini message formats."""
    # Try multiple possible content fields
    content = (
        msg.get("text") or
        msg.get("content") or
        msg.get("message") or
        msg.get("prompt") or
        msg.get("response") or
        ""
    )
    
    # Handle nested content structures
    if isinstance(content, dict):
        content = content.get("text") or content.get("parts", [""])[0]
    elif isinstance(content, list):
        # Join multiple parts
        content = "\n".join(str(part) for part in content if part)
    
    return str(content)


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Gemini."""
    if not timestamp:
        return None
    
    try:
        # Try ISO format
        if isinstance(timestamp, str):
            # Handle various ISO formats
            timestamp = timestamp.replace("Z", "+00:00")
            for fmt in ["%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
                try:
                    return datetime.strptime(timestamp.split("+")[0], fmt)
                except ValueError:
                    continue
        # Try Unix timestamp (seconds or milliseconds)
        elif isinstance(timestamp, (int, float)):
            if timestamp > 1e12:  # Likely milliseconds
                timestamp = timestamp / 1000
            return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError, TypeError):
        pass
    
    return None
````

## File: backend/app/preprocessing/__init__.py
````python
"""
ChatArchive preprocessing pipeline for Claude chat exports.

This package provides a modular pipeline for ingesting, parsing, cleaning,
classifying, and preparing Claude export data for database storage.
"""

from app.preprocessing.pipeline import PreprocessingPipeline, PipelineConfig

__all__ = ["PreprocessingPipeline", "PipelineConfig"]
````

## File: backend/app/preprocessing/classifier.py
````python
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
````

## File: backend/app/preprocessing/cleaner.py
````python
"""
Text cleaning and normalization module.

Normalizes whitespace, handles encoding issues, and optionally generates
truncated previews. Full conversation content is always preserved.
"""

from __future__ import annotations

import re
import unicodedata

from app.preprocessing.models import ProcessedConversation, ProcessedMessage

# Patterns for whitespace normalization
_EXCESSIVE_NEWLINES_RE = re.compile(r"\n{4,}")
_TRAILING_WHITESPACE_RE = re.compile(r"[ \t]+$", re.MULTILINE)
_LEADING_TRAILING_BLANK_RE = re.compile(r"^\s+|\s+$")

# Common encoding replacement characters
_REPLACEMENT_CHAR = "\ufffd"

# Default preview length in characters
DEFAULT_PREVIEW_LENGTH = 300


def normalize_unicode(text: str) -> str:
    """Normalize unicode to NFC form and strip replacement characters."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace(_REPLACEMENT_CHAR, "")
    return text


def normalize_whitespace(text: str) -> str:
    """
    Normalize whitespace while preserving intentional formatting.

    - Collapses runs of 4+ newlines down to 3 (preserves paragraph breaks)
    - Strips trailing whitespace per line
    - Does NOT collapse spaces within lines (preserves code indentation)
    """
    text = _TRAILING_WHITESPACE_RE.sub("", text)
    text = _EXCESSIVE_NEWLINES_RE.sub("\n\n\n", text)
    return text


def clean_text(text: str) -> str:
    """Apply all non-destructive cleaning steps to text."""
    text = normalize_unicode(text)
    text = normalize_whitespace(text)
    return text


def generate_preview(text: str, max_length: int = DEFAULT_PREVIEW_LENGTH) -> str:
    """
    Generate a truncated preview of text for display purposes.

    Truncates at a word boundary and appends an ellipsis if needed.
    """
    # Strip leading/trailing whitespace for the preview
    preview = text.strip()
    if len(preview) <= max_length:
        return preview

    # Find last space before the limit
    truncated = preview[:max_length]
    last_space = truncated.rfind(" ")
    if last_space > max_length // 2:
        truncated = truncated[:last_space]

    return truncated.rstrip() + "..."


def clean_message(message: ProcessedMessage) -> ProcessedMessage:
    """Clean the text content of a single message."""
    message.content = clean_text(message.content)
    return message


def clean_conversation(
    conversation: ProcessedConversation,
    preview_length: int = DEFAULT_PREVIEW_LENGTH,
) -> ProcessedConversation:
    """
    Clean all messages in a conversation and generate a preview.

    Args:
        conversation: The conversation to clean.
        preview_length: Max character length for the preview field.

    Returns:
        The conversation with cleaned messages and a preview.
    """
    for msg in conversation.messages:
        clean_message(msg)

    if conversation.title:
        conversation.title = clean_text(conversation.title).strip()

    # Generate preview from the first user message
    for msg in conversation.messages:
        if msg.role == "user" and msg.content.strip():
            conversation.preview = generate_preview(
                msg.content, max_length=preview_length
            )
            break

    return conversation
````

## File: backend/app/preprocessing/deduplication.py
````python
"""
Deduplication and linking module.

Detects duplicate conversations across exports using content hashing
and source ID matching. Tracks import metadata for re-import handling.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime

from app.preprocessing.models import ProcessedConversation

logger = logging.getLogger(__name__)


def compute_content_hash(conversation: ProcessedConversation) -> str:
    """
    Compute a SHA-256 hash of the conversation's meaningful content.

    Hashes source_id + title + sorted message contents to detect duplicates
    even when timestamps differ between exports.
    """
    hasher = hashlib.sha256()

    if conversation.source_id:
        hasher.update(conversation.source_id.encode("utf-8"))
    if conversation.title:
        hasher.update(conversation.title.encode("utf-8"))

    for msg in conversation.messages:
        hasher.update(msg.role.encode("utf-8"))
        hasher.update(msg.content.encode("utf-8"))

    return hasher.hexdigest()


def mark_content_hash(
    conversation: ProcessedConversation,
) -> ProcessedConversation:
    """Compute and set the content_hash on a conversation."""
    conversation.content_hash = compute_content_hash(conversation)
    return conversation


def deduplicate_conversations(
    new_conversations: list[ProcessedConversation],
    existing_source_ids: set[str] | None = None,
    existing_hashes: set[str] | None = None,
) -> tuple[list[ProcessedConversation], list[ProcessedConversation]]:
    """
    Deduplicate a list of conversations against existing data and within the batch.

    Args:
        new_conversations: Newly parsed conversations to check.
        existing_source_ids: Set of source_ids already in the database.
        existing_hashes: Set of content hashes already in the database.

    Returns:
        Tuple of (unique_conversations, duplicate_conversations).
    """
    existing_source_ids = existing_source_ids or set()
    existing_hashes = existing_hashes or set()

    unique: list[ProcessedConversation] = []
    duplicates: list[ProcessedConversation] = []

    seen_source_ids: set[str] = set()
    seen_hashes: set[str] = set()

    for conv in new_conversations:
        # Ensure content hash is computed
        if not conv.content_hash:
            mark_content_hash(conv)

        is_duplicate = False

        # Check by source_id
        if conv.source_id:
            if conv.source_id in existing_source_ids or conv.source_id in seen_source_ids:
                is_duplicate = True

        # Check by content hash
        if conv.content_hash:
            if conv.content_hash in existing_hashes or conv.content_hash in seen_hashes:
                is_duplicate = True

        if is_duplicate:
            duplicates.append(conv)
            logger.debug(
                "Duplicate detected: %s (source_id=%s)",
                conv.title,
                conv.source_id,
            )
        else:
            unique.append(conv)
            if conv.source_id:
                seen_source_ids.add(conv.source_id)
            if conv.content_hash:
                seen_hashes.add(conv.content_hash)

    if duplicates:
        logger.info(
            "Deduplication: %d unique, %d duplicates skipped",
            len(unique),
            len(duplicates),
        )

    return unique, duplicates
````

## File: backend/app/preprocessing/extractor.py
````python
"""
Content extraction and segmentation module.

Identifies and extracts code blocks, tables, and artifacts from
Claude conversation messages. Preserves original formatting while
enabling structured queries.
"""

from __future__ import annotations

import re
from typing import Any

from app.preprocessing.models import (
    CodeBlock,
    ExtractedArtifact,
    ExtractedTable,
    ProcessedConversation,
    ProcessedMessage,
)

# Fenced code block: ```lang\ncode\n```
_CODE_BLOCK_RE = re.compile(
    r"```(\w+)?\s*\n(.*?)```",
    re.DOTALL,
)

# Markdown table: lines starting with |
_TABLE_ROW_RE = re.compile(r"^\|(.+)\|$", re.MULTILINE)
_TABLE_SEP_RE = re.compile(r"^\|[\s\-:|]+\|$", re.MULTILINE)

# Claude artifact tags: <antArtifact identifier="..." type="..." title="...">content</antArtifact>
_ARTIFACT_RE = re.compile(
    r"<antArtifact\b([^>]*)>(.*?)</antArtifact>",
    re.DOTALL,
)
_ATTR_RE = re.compile(r'(\w+)="([^"]*)"')


def extract_code_blocks(text: str) -> list[CodeBlock]:
    """
    Extract fenced code blocks from markdown text.

    Preserves language tags and records line positions within the text.
    """
    blocks: list[CodeBlock] = []
    for match in _CODE_BLOCK_RE.finditer(text):
        language = match.group(1) or None
        code = match.group(2).rstrip("\n")
        start = text[:match.start()].count("\n")
        end = start + code.count("\n")
        blocks.append(
            CodeBlock(language=language, code=code, start_line=start, end_line=end)
        )
    return blocks


def extract_tables(text: str) -> list[ExtractedTable]:
    """
    Extract markdown tables from text.

    Returns parsed headers and rows along with the raw markdown.
    """
    tables: list[ExtractedTable] = []
    lines = text.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i].strip()
        # Look for a line that looks like a table row
        if _TABLE_ROW_RE.match(line):
            table_lines = [line]
            j = i + 1

            # Collect consecutive table lines
            while j < len(lines):
                next_line = lines[j].strip()
                if _TABLE_ROW_RE.match(next_line) or _TABLE_SEP_RE.match(next_line):
                    table_lines.append(next_line)
                    j += 1
                else:
                    break

            # Need at least header + separator + one row
            if len(table_lines) >= 3:
                raw = "\n".join(table_lines)

                # Parse header row
                header_cells = [
                    c.strip() for c in table_lines[0].strip("|").split("|")
                ]

                # Skip separator row(s), parse data rows
                rows: list[list[str]] = []
                for tl in table_lines[2:]:
                    if _TABLE_SEP_RE.match(tl):
                        continue
                    cells = [c.strip() for c in tl.strip("|").split("|")]
                    rows.append(cells)

                if rows:
                    tables.append(
                        ExtractedTable(
                            headers=header_cells, rows=rows, raw_markdown=raw
                        )
                    )

            i = j
        else:
            i += 1

    return tables


def extract_artifacts(text: str) -> list[ExtractedArtifact]:
    """Extract Claude artifacts from message content."""
    artifacts: list[ExtractedArtifact] = []
    for match in _ARTIFACT_RE.finditer(text):
        attrs_str = match.group(1)
        content = match.group(2).strip()

        attrs: dict[str, str] = {}
        for attr_match in _ATTR_RE.finditer(attrs_str):
            attrs[attr_match.group(1)] = attr_match.group(2)

        artifacts.append(
            ExtractedArtifact(
                identifier=attrs.get("identifier"),
                artifact_type=attrs.get("type"),
                title=attrs.get("title"),
                content=content,
            )
        )
    return artifacts


def extract_message_content(message: ProcessedMessage) -> ProcessedMessage:
    """
    Extract structured content from a single message.

    Populates the message's code_blocks and tables fields.
    """
    message.code_blocks = extract_code_blocks(message.content)
    message.tables = extract_tables(message.content)

    # If the message contains code blocks, mark content_type accordingly
    if message.code_blocks and not message.tables:
        message.content_type = "code"
    elif message.tables and not message.code_blocks:
        message.content_type = "text"

    return message


def extract_conversation_content(
    conversation: ProcessedConversation,
) -> ProcessedConversation:
    """
    Extract structured content from all messages in a conversation.

    Populates conversation-level code_blocks and artifacts lists.
    """
    all_code_blocks: list[CodeBlock] = []
    all_artifacts: list[ExtractedArtifact] = []

    for msg in conversation.messages:
        extract_message_content(msg)
        all_code_blocks.extend(msg.code_blocks)

        # Only extract artifacts from assistant messages
        if msg.role == "assistant":
            msg_artifacts = extract_artifacts(msg.content)
            all_artifacts.extend(msg_artifacts)

    conversation.code_blocks = all_code_blocks
    conversation.artifacts = all_artifacts

    return conversation
````

## File: backend/app/preprocessing/models.py
````python
"""Pydantic models for the preprocessing pipeline."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ContentType(str, Enum):
    TEXT = "text"
    CODE = "code"
    TABLE = "table"
    IMAGE = "image"


class CodeBlock(BaseModel):
    """An extracted code block from a conversation message."""

    language: str | None = None
    code: str
    start_line: int = 0
    end_line: int = 0


class ExtractedTable(BaseModel):
    """A table extracted from markdown content."""

    headers: list[str] = []
    rows: list[list[str]] = []
    raw_markdown: str = ""


class ExtractedArtifact(BaseModel):
    """An artifact extracted from a Claude response."""

    identifier: str | None = None
    artifact_type: str | None = None
    title: str | None = None
    content: str = ""


class EntityExtraction(BaseModel):
    """Entities extracted from conversation content."""

    programming_languages: list[str] = []
    frameworks: list[str] = []
    libraries: list[str] = []
    project_names: list[str] = []
    technologies: list[str] = []


class TokenMetrics(BaseModel):
    """Token count metrics for a conversation."""

    total_tokens: int = 0
    user_tokens: int = 0
    assistant_tokens: int = 0
    avg_tokens_per_message: float = 0.0


class ProcessedMessage(BaseModel):
    """A single message after preprocessing."""

    source_id: str | None = None
    role: str
    content: str
    content_type: str = "text"
    created_at: datetime | None = None
    order_index: int = 0
    model: str | None = None
    code_blocks: list[CodeBlock] = []
    tables: list[ExtractedTable] = []
    token_count: int = 0


class ProcessedConversation(BaseModel):
    """A fully processed conversation ready for database storage."""

    # Core fields (match existing DB schema)
    source: str = "claude"
    source_id: str | None = None
    title: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    message_count: int = 0
    raw_json: str = ""

    # Processed messages
    messages: list[ProcessedMessage] = []

    # Extracted metadata
    duration_seconds: float | None = None
    code_blocks: list[CodeBlock] = []
    artifacts: list[ExtractedArtifact] = []
    entities: EntityExtraction = Field(default_factory=EntityExtraction)

    # Classification
    tags: list[str] = []

    # Token metrics
    token_metrics: TokenMetrics = Field(default_factory=TokenMetrics)

    # Preview
    preview: str | None = None

    # Deduplication
    content_hash: str | None = None

    def to_db_dict(self) -> dict[str, Any]:
        """Convert to a dictionary compatible with the existing DB models."""
        return {
            "source": self.source,
            "source_id": self.source_id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "message_count": self.message_count,
            "raw_json": self.raw_json,
            "messages": [
                {
                    "source_id": msg.source_id,
                    "role": msg.role,
                    "content": msg.content,
                    "content_type": msg.content_type,
                    "created_at": msg.created_at,
                    "order_index": msg.order_index,
                    "model": msg.model,
                }
                for msg in self.messages
            ],
        }


class ImportResult(BaseModel):
    """Result of processing a batch of conversations."""

    total_conversations: int = 0
    processed_conversations: int = 0
    skipped_duplicates: int = 0
    failed_conversations: int = 0
    conversations: list[ProcessedConversation] = []
    errors: list[str] = []


class PipelineProgress(BaseModel):
    """Progress tracking for the pipeline."""

    stage: str = ""
    current: int = 0
    total: int = 0
    message: str = ""

    @property
    def percentage(self) -> float:
        if self.total == 0:
            return 0.0
        return (self.current / self.total) * 100.0
````

## File: backend/app/preprocessing/parser.py
````python
"""
Conversation parsing module for Claude exports.

Parses the nested JSON structure from Claude's official export format,
extracts individual messages, and normalizes the conversation structure.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from app.preprocessing.models import ProcessedConversation, ProcessedMessage

logger = logging.getLogger(__name__)


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Claude exports."""
    if not timestamp:
        return None

    try:
        if isinstance(timestamp, str):
            cleaned = timestamp.replace("Z", "+00:00")
            return datetime.fromisoformat(cleaned.replace("+00:00", ""))
        elif isinstance(timestamp, (int, float)):
            return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError, TypeError):
        pass

    return None


def _compute_duration(messages: list[ProcessedMessage]) -> float | None:
    """Compute duration in seconds between first and last message timestamps."""
    timestamps = [m.created_at for m in messages if m.created_at is not None]
    if len(timestamps) < 2:
        return None
    timestamps.sort()
    delta = timestamps[-1] - timestamps[0]
    return delta.total_seconds()


def parse_single_conversation(item: dict[str, Any]) -> ProcessedConversation:
    """
    Parse a single conversation object from a Claude export.

    Args:
        item: A conversation dictionary from the export JSON.

    Returns:
        A ProcessedConversation with parsed messages and metadata.
    """
    conv_id = item.get("uuid") or item.get("id")
    name = item.get("name") or item.get("title")

    created_at = parse_timestamp(item.get("created_at"))
    updated_at = parse_timestamp(item.get("updated_at"))

    chat_messages = item.get("chat_messages", [])
    messages: list[ProcessedMessage] = []

    for idx, msg in enumerate(chat_messages):
        sender = msg.get("sender", "unknown")
        role = "user" if sender == "human" else "assistant"

        content = msg.get("text", "")
        if not content.strip():
            continue

        msg_created = parse_timestamp(msg.get("created_at"))

        messages.append(
            ProcessedMessage(
                source_id=msg.get("uuid") or msg.get("id"),
                role=role,
                content=content,
                content_type="text",
                created_at=msg_created,
                order_index=idx,
                model=item.get("model") or "claude",
            )
        )

    duration = _compute_duration(messages)

    return ProcessedConversation(
        source="claude",
        source_id=conv_id,
        title=name,
        created_at=created_at,
        updated_at=updated_at,
        message_count=len(messages),
        raw_json=json.dumps(item),
        messages=messages,
        duration_seconds=duration,
    )


def parse_claude_export_to_conversations(
    payload: Any,
) -> list[ProcessedConversation]:
    """
    Parse a Claude export payload into a list of ProcessedConversation objects.

    Handles multiple export formats:
    1. Array of conversation objects
    2. Single conversation object
    3. Object with 'conversations' or 'data' key

    Args:
        payload: The parsed JSON from a Claude export file.

    Returns:
        List of ProcessedConversation objects.

    Raises:
        ValueError: If the export format is not recognized.
    """
    conversations_raw: list[dict[str, Any]] | None = None

    if isinstance(payload, list):
        conversations_raw = payload
    elif isinstance(payload, dict):
        if "uuid" in payload or "created_at" in payload:
            conversations_raw = [payload]
        else:
            conversations_raw = payload.get(
                "conversations", payload.get("data")
            )

    if not conversations_raw:
        raise ValueError("Unrecognized Claude export format")

    results: list[ProcessedConversation] = []
    for idx, item in enumerate(conversations_raw):
        try:
            conv = parse_single_conversation(item)
            results.append(conv)
        except Exception:
            logger.warning("Failed to parse conversation at index %d", idx, exc_info=True)

    return results
````

## File: backend/app/preprocessing/pipeline.py
````python
"""
Main preprocessing pipeline orchestrator.

Composes the individual preprocessing steps into a configurable pipeline
with progress tracking, error handling, and dry-run support.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable

from pydantic import BaseModel

from app.preprocessing.classifier import classify_conversation
from app.preprocessing.cleaner import clean_conversation
from app.preprocessing.deduplication import (
    deduplicate_conversations,
    mark_content_hash,
)
from app.preprocessing.extractor import extract_conversation_content
from app.preprocessing.models import (
    ImportResult,
    PipelineProgress,
    ProcessedConversation,
)
from app.preprocessing.parser import parse_claude_export_to_conversations
from app.preprocessing.token_counter import count_conversation_tokens

logger = logging.getLogger(__name__)


class PipelineConfig(BaseModel):
    """Configuration for the preprocessing pipeline."""

    # Toggle individual pipeline steps
    enable_cleaning: bool = True
    enable_extraction: bool = True
    enable_classification: bool = True
    enable_token_counting: bool = True
    enable_deduplication: bool = True

    # Cleaning options
    preview_length: int = 300

    # Deduplication data (source IDs and hashes from existing DB)
    existing_source_ids: set[str] = set()
    existing_hashes: set[str] = set()

    # Dry-run: process everything but return results without committing
    dry_run: bool = False

    model_config = {"arbitrary_types_allowed": True}


# Type for progress callback
ProgressCallback = Callable[[PipelineProgress], None] | None


def _process_single(
    conversation: ProcessedConversation,
    config: PipelineConfig,
) -> ProcessedConversation:
    """Run all enabled pipeline steps on a single conversation."""
    if config.enable_cleaning:
        clean_conversation(conversation, preview_length=config.preview_length)

    if config.enable_extraction:
        extract_conversation_content(conversation)

    if config.enable_classification:
        classify_conversation(conversation)

    if config.enable_token_counting:
        count_conversation_tokens(conversation)

    # Always compute content hash (needed for deduplication check)
    mark_content_hash(conversation)

    return conversation


def process_export(
    payload: Any,
    config: PipelineConfig | None = None,
    progress_callback: ProgressCallback = None,
) -> ImportResult:
    """
    Run the full preprocessing pipeline on a Claude export payload.

    Args:
        payload: Parsed JSON from a Claude export file.
        config: Pipeline configuration. Uses defaults if None.
        progress_callback: Optional callback for progress updates.

    Returns:
        ImportResult with processed conversations and statistics.
    """
    if config is None:
        config = PipelineConfig()

    result = ImportResult()

    # --- Stage 1: Parse ---
    if progress_callback:
        progress_callback(PipelineProgress(stage="parsing", message="Parsing export file..."))

    try:
        conversations = parse_claude_export_to_conversations(payload)
    except ValueError as e:
        result.errors.append(f"Parsing failed: {e}")
        return result

    result.total_conversations = len(conversations)

    if not conversations:
        return result

    # --- Stage 2: Process each conversation ---
    processed: list[ProcessedConversation] = []
    for idx, conv in enumerate(conversations):
        if progress_callback:
            progress_callback(
                PipelineProgress(
                    stage="processing",
                    current=idx + 1,
                    total=len(conversations),
                    message=f"Processing: {conv.title or 'Untitled'}",
                )
            )

        try:
            _process_single(conv, config)
            processed.append(conv)
        except Exception as e:
            logger.warning(
                "Failed to process conversation %s: %s",
                conv.source_id,
                e,
                exc_info=True,
            )
            result.errors.append(
                f"Failed to process '{conv.title or conv.source_id}': {e}"
            )
            result.failed_conversations += 1

    # --- Stage 3: Deduplicate ---
    if config.enable_deduplication:
        if progress_callback:
            progress_callback(
                PipelineProgress(stage="deduplication", message="Checking for duplicates...")
            )

        unique, duplicates = deduplicate_conversations(
            processed,
            existing_source_ids=config.existing_source_ids,
            existing_hashes=config.existing_hashes,
        )
        result.skipped_duplicates = len(duplicates)
        processed = unique

    # --- Done ---
    result.processed_conversations = len(processed)
    result.conversations = processed

    if progress_callback:
        progress_callback(
            PipelineProgress(
                stage="complete",
                current=len(processed),
                total=result.total_conversations,
                message=f"Done. {len(processed)} conversations processed.",
            )
        )

    return result


async def process_export_async(
    payload: Any,
    config: PipelineConfig | None = None,
    progress_callback: ProgressCallback = None,
) -> ImportResult:
    """
    Async wrapper for process_export.

    Runs the CPU-bound processing in a thread pool executor so it
    doesn't block the event loop during large imports.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, process_export, payload, config, progress_callback
    )


class PreprocessingPipeline:
    """
    High-level pipeline interface for use in FastAPI endpoints.

    Provides a stateful wrapper around process_export with
    convenience methods for common operations.
    """

    def __init__(self, config: PipelineConfig | None = None):
        self.config = config or PipelineConfig()
        self._progress: PipelineProgress | None = None

    def _on_progress(self, progress: PipelineProgress) -> None:
        self._progress = progress
        logger.info(
            "[%s] %s (%d/%d)",
            progress.stage,
            progress.message,
            progress.current,
            progress.total,
        )

    @property
    def progress(self) -> PipelineProgress | None:
        return self._progress

    def run(self, payload: Any) -> ImportResult:
        """Run the pipeline synchronously."""
        return process_export(
            payload, config=self.config, progress_callback=self._on_progress
        )

    async def run_async(self, payload: Any) -> ImportResult:
        """Run the pipeline asynchronously."""
        return await process_export_async(
            payload, config=self.config, progress_callback=self._on_progress
        )

    def dry_run(self, payload: Any) -> ImportResult:
        """Preview what would be imported without committing."""
        original = self.config.dry_run
        self.config.dry_run = True
        try:
            return self.run(payload)
        finally:
            self.config.dry_run = original
````

## File: backend/app/preprocessing/token_counter.py
````python
"""
Token counting module.

Provides token estimation for conversations using tiktoken (when available)
with a character-based fallback.
"""

from __future__ import annotations

import logging

from app.preprocessing.models import ProcessedConversation, TokenMetrics

logger = logging.getLogger(__name__)

_encoder = None
_tiktoken_available = False


def _get_encoder():
    """Lazily load the tiktoken encoder."""
    global _encoder, _tiktoken_available
    if _encoder is not None:
        return _encoder

    try:
        import tiktoken

        _encoder = tiktoken.get_encoding("cl100k_base")
        _tiktoken_available = True
        logger.info("Using tiktoken cl100k_base encoding for token counting")
    except (ImportError, Exception) as e:
        logger.info(
            "tiktoken not available (%s), using character-based estimation", e
        )
        _tiktoken_available = False
        _encoder = False  # Sentinel to avoid retrying

    return _encoder


def count_tokens(text: str) -> int:
    """
    Count tokens in text.

    Uses tiktoken cl100k_base if available, otherwise estimates
    ~4 characters per token as a rough approximation.
    """
    encoder = _get_encoder()
    if encoder and encoder is not False:
        return len(encoder.encode(text))

    # Fallback: ~4 chars per token is a rough heuristic for English text
    return max(1, len(text) // 4)


def count_conversation_tokens(
    conversation: ProcessedConversation,
) -> ProcessedConversation:
    """
    Count tokens for all messages in a conversation and populate token metrics.

    Updates each message's token_count and the conversation-level token_metrics.
    """
    total = 0
    user_tokens = 0
    assistant_tokens = 0

    for msg in conversation.messages:
        tokens = count_tokens(msg.content)
        msg.token_count = tokens
        total += tokens

        if msg.role == "user":
            user_tokens += tokens
        else:
            assistant_tokens += tokens

    msg_count = len(conversation.messages)
    conversation.token_metrics = TokenMetrics(
        total_tokens=total,
        user_tokens=user_tokens,
        assistant_tokens=assistant_tokens,
        avg_tokens_per_message=round(total / msg_count, 1) if msg_count else 0.0,
    )

    return conversation
````

## File: backend/app/query_filters.py
````python
from __future__ import annotations

from sqlalchemy.orm import Query

from app.models import Conversation, Tag


def apply_conversation_filters(
    query: Query,
    *,
    source: str | None = None,
    tag: str | None = None,
    project_id: int | None = None,
) -> Query:
    """Apply shared conversation filters to list and search queries."""

    if source:
        query = query.filter(Conversation.source == source)

    if tag:
        query = query.join(Conversation.tags).filter(Tag.name == tag)

    if project_id is not None:
        if project_id == -1:
            query = query.filter(Conversation.project_id.is_(None))
        else:
            query = query.filter(Conversation.project_id == project_id)

    return query
````

## File: backend/app/supabase_client.py
````python
from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env file
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "chatarchive-exports")

# Initialize Supabase client if credentials are provided
_supabase_client: Client | None = None

def get_supabase_client() -> Client | None:
    """Get or create Supabase client instance."""
    global _supabase_client
    
    if _supabase_client is None and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    return _supabase_client


def is_supabase_configured() -> bool:
    """Check if Supabase is properly configured."""
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_project_id() -> str | None:
    """Extract project ID from Supabase URL."""
    if not SUPABASE_URL:
        return None
    
    # URL format: https://<project-id>.supabase.co
    try:
        # Remove protocol
        url_without_protocol = SUPABASE_URL.replace("https://", "").replace("http://", "")
        # Extract project ID (first part before .supabase.co)
        project_id = url_without_protocol.split(".")[0]
        return project_id
    except Exception:
        return None


def get_dashboard_url() -> str | None:
    """Get the Supabase dashboard URL for the current project."""
    project_id = get_supabase_project_id()
    if not project_id:
        return None
    
    return f"https://supabase.com/dashboard/project/{project_id}"


def get_connection_info() -> dict[str, Any]:
    """Get Supabase connection information (without exposing keys)."""
    return {
        "configured": is_supabase_configured(),
        "url": SUPABASE_URL if SUPABASE_URL else None,
        "project_id": get_supabase_project_id(),
        "bucket_name": SUPABASE_BUCKET_NAME,
        "dashboard_url": get_dashboard_url(),
    }
````

## File: backend/tests/__init__.py
````python
# Tests package
````

## File: backend/tests/test_chatgpt_parser.py
````python
"""Unit tests for ChatGPT parser."""
from __future__ import annotations

import json
from datetime import datetime
from app.importers.chatgpt import parse_chatgpt_export, extract_messages_from_mapping, parse_message, should_include_message


def test_parse_chatgpt_export_with_conversations_key():
    """Test parsing ChatGPT export with conversations key."""
    payload = {
        "conversations": [
            {
                "id": "conv-123",
                "title": "Test Conversation",
                "create_time": 1704067200.0,  # 2024-01-01
                "update_time": 1704153600.0,  # 2024-01-02
                "mapping": {
                    "root": {
                        "id": "root",
                        "parent": None,
                        "children": ["msg1"],
                        "message": None
                    },
                    "msg1": {
                        "id": "msg1",
                        "parent": "root",
                        "children": ["msg2"],
                        "message": {
                            "id": "msg1",
                            "author": {"role": "user"},
                            "create_time": 1704067200.0,
                            "content": {
                                "content_type": "text",
                                "parts": ["Hello, how are you?"]
                            },
                            "metadata": {}
                        }
                    },
                    "msg2": {
                        "id": "msg2",
                        "parent": "msg1",
                        "children": [],
                        "message": {
                            "id": "msg2",
                            "author": {"role": "assistant"},
                            "create_time": 1704067210.0,
                            "content": {
                                "content_type": "text",
                                "parts": ["I'm doing well, thank you!"]
                            },
                            "metadata": {"model_slug": "gpt-4"}
                        }
                    }
                }
            }
        ]
    }
    
    result = parse_chatgpt_export(payload)
    
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "chatgpt"
    assert conv["source_id"] == "conv-123"
    assert conv["title"] == "Test Conversation"
    assert conv["message_count"] == 2
    assert len(conv["messages"]) == 2
    
    # Verify messages
    msg1 = conv["messages"][0]
    assert msg1["role"] == "user"
    assert msg1["content"] == "Hello, how are you?"
    assert msg1["order_index"] == 0
    
    msg2 = conv["messages"][1]
    assert msg2["role"] == "assistant"
    assert msg2["content"] == "I'm doing well, thank you!"
    assert msg2["order_index"] == 1
    assert msg2["model"] == "gpt-4"


def test_parse_chatgpt_export_list_format():
    """Test parsing ChatGPT export as a list."""
    payload = [
        {
            "conversation_id": "conv-456",
            "title": "Another Test",
            "create_time": 1704067200.0,
            "mapping": {
                "root": {
                    "id": "root",
                    "parent": None,
                    "children": ["msg1"],
                    "message": None
                },
                "msg1": {
                    "id": "msg1",
                    "parent": "root",
                    "children": [],
                    "message": {
                        "id": "msg1",
                        "author": {"role": "user"},
                        "create_time": 1704067200.0,
                        "content": {
                            "content_type": "text",
                            "parts": ["Test message"]
                        },
                        "metadata": {}
                    }
                }
            }
        }
    ]
    
    result = parse_chatgpt_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "conv-456"
    assert result[0]["title"] == "Another Test"


def test_parse_chatgpt_export_invalid_format():
    """Test parsing ChatGPT export with invalid format."""
    payload = {"invalid": "format"}
    
    try:
        parse_chatgpt_export(payload)
        assert False, "Should raise ValueError"
    except ValueError as e:
        assert "Unrecognized ChatGPT export format" in str(e)


def test_should_include_message_user():
    """Test should_include_message for user messages."""
    message = {
        "author": {"role": "user"},
        "content": {"content_type": "text", "parts": ["Hello"]},
        "metadata": {}
    }
    assert should_include_message(message) is True


def test_should_include_message_assistant():
    """Test should_include_message for assistant messages."""
    message = {
        "author": {"role": "assistant"},
        "content": {"content_type": "text", "parts": ["Hi"]},
        "metadata": {}
    }
    assert should_include_message(message) is True


def test_should_include_message_hidden():
    """Test should_include_message for hidden messages."""
    message = {
        "author": {"role": "user"},
        "content": {"content_type": "text", "parts": ["Hidden"]},
        "metadata": {"is_visually_hidden_from_conversation": True}
    }
    assert should_include_message(message) is False


def test_should_include_message_system_error():
    """Test should_include_message for system error messages."""
    message = {
        "author": {"role": "assistant"},
        "content": {"content_type": "system_error", "parts": ["Error"]},
        "metadata": {}
    }
    assert should_include_message(message) is False


def test_parse_message_basic():
    """Test parse_message with basic message."""
    message = {
        "id": "msg1",
        "author": {"role": "user"},
        "create_time": 1704067200.0,
        "content": {
            "content_type": "text",
            "parts": ["Test content"]
        },
        "metadata": {}
    }
    
    result = parse_message(message, 0)
    
    assert result["source_id"] == "msg1"
    assert result["role"] == "user"
    assert result["content"] == "Test content"
    assert result["content_type"] == "text"
    assert result["order_index"] == 0
    assert isinstance(result["created_at"], datetime)


def test_parse_message_empty_content():
    """Test parse_message with empty content."""
    message = {
        "id": "msg1",
        "author": {"role": "user"},
        "content": {
            "content_type": "text",
            "parts": [""]
        },
        "metadata": {}
    }
    
    result = parse_message(message, 0)
    assert result is None


def test_parse_message_multiple_parts():
    """Test parse_message with multiple content parts."""
    message = {
        "id": "msg1",
        "author": {"role": "user"},
        "content": {
            "content_type": "text",
            "parts": ["Part 1", "Part 2", "Part 3"]
        },
        "metadata": {}
    }
    
    result = parse_message(message, 0)
    assert result["content"] == "Part 1\nPart 2\nPart 3"


def test_extract_messages_from_mapping_empty():
    """Test extract_messages_from_mapping with empty mapping."""
    result = extract_messages_from_mapping({})
    assert result == []


def test_extract_messages_from_mapping_tree():
    """Test extract_messages_from_mapping with tree structure."""
    mapping = {
        "root": {
            "id": "root",
            "parent": None,
            "children": ["msg1", "msg3"],
            "message": None
        },
        "msg1": {
            "id": "msg1",
            "parent": "root",
            "children": ["msg2"],
            "message": {
                "id": "msg1",
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Message 1"]},
                "metadata": {}
            }
        },
        "msg2": {
            "id": "msg2",
            "parent": "msg1",
            "children": [],
            "message": {
                "id": "msg2",
                "author": {"role": "assistant"},
                "content": {"content_type": "text", "parts": ["Message 2"]},
                "metadata": {}
            }
        },
        "msg3": {
            "id": "msg3",
            "parent": "root",
            "children": [],
            "message": {
                "id": "msg3",
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Message 3"]},
                "metadata": {}
            }
        }
    }
    
    result = extract_messages_from_mapping(mapping)
    
    # Should extract messages in depth-first order
    assert len(result) == 3
    assert result[0]["content"] == "Message 1"
    assert result[1]["content"] == "Message 2"
    assert result[2]["content"] == "Message 3"
````

## File: backend/tests/test_claude_parser.py
````python
"""Unit tests for Claude parser."""
from __future__ import annotations

from datetime import datetime
from app.importers.claude import parse_claude_export, parse_timestamp


def test_parse_claude_export_list_format():
    """Test parsing Claude export as a list."""
    payload = [
        {
            "uuid": "claude-123",
            "name": "Test Conversation",
            "created_at": "2024-01-01T12:00:00Z",
            "updated_at": "2024-01-02T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg1",
                    "sender": "human",
                    "text": "Hello Claude",
                    "created_at": "2024-01-01T12:00:00Z"
                },
                {
                    "uuid": "msg2",
                    "sender": "assistant",
                    "text": "Hello! How can I help you today?",
                    "created_at": "2024-01-01T12:00:05Z"
                }
            ],
            "model": "claude-3"
        }
    ]
    
    result = parse_claude_export(payload)
    
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "claude"
    assert conv["source_id"] == "claude-123"
    assert conv["title"] == "Test Conversation"
    assert conv["message_count"] == 2
    assert len(conv["messages"]) == 2
    
    # Verify messages
    msg1 = conv["messages"][0]
    assert msg1["role"] == "user"
    assert msg1["content"] == "Hello Claude"
    assert msg1["order_index"] == 0
    
    msg2 = conv["messages"][1]
    assert msg2["role"] == "assistant"
    assert msg2["content"] == "Hello! How can I help you today?"
    assert msg2["order_index"] == 1
    assert msg2["model"] == "claude-3"


def test_parse_claude_export_single_conversation():
    """Test parsing Claude export with single conversation."""
    payload = {
        "uuid": "claude-456",
        "title": "Single Conversation",
        "created_at": "2024-01-01T12:00:00Z",
        "chat_messages": [
            {
                "uuid": "msg1",
                "sender": "human",
                "text": "Test message",
                "created_at": "2024-01-01T12:00:00Z"
            }
        ]
    }
    
    result = parse_claude_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "claude-456"
    assert result[0]["title"] == "Single Conversation"


def test_parse_claude_export_with_conversations_key():
    """Test parsing Claude export with conversations key."""
    payload = {
        "conversations": [
            {
                "id": "claude-789",
                "name": "Nested Conversation",
                "created_at": "2024-01-01T12:00:00Z",
                "chat_messages": [
                    {
                        "id": "msg1",
                        "sender": "human",
                        "text": "Nested message",
                        "created_at": "2024-01-01T12:00:00Z"
                    }
                ]
            }
        ]
    }
    
    result = parse_claude_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "claude-789"
    assert result[0]["title"] == "Nested Conversation"


def test_parse_claude_export_empty_messages():
    """Test parsing Claude export skips empty messages."""
    payload = [
        {
            "uuid": "claude-empty",
            "name": "Conversation with Empty",
            "created_at": "2024-01-01T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg1",
                    "sender": "human",
                    "text": "Valid message",
                    "created_at": "2024-01-01T12:00:00Z"
                },
                {
                    "uuid": "msg2",
                    "sender": "assistant",
                    "text": "   ",
                    "created_at": "2024-01-01T12:00:05Z"
                },
                {
                    "uuid": "msg3",
                    "sender": "human",
                    "text": "Another valid message",
                    "created_at": "2024-01-01T12:00:10Z"
                }
            ]
        }
    ]
    
    result = parse_claude_export(payload)
    
    assert len(result[0]["messages"]) == 2
    assert result[0]["messages"][0]["content"] == "Valid message"
    assert result[0]["messages"][1]["content"] == "Another valid message"


def test_parse_claude_export_invalid_format():
    """Test parsing Claude export with invalid format."""
    payload = {"conversations": None}
    
    try:
        parse_claude_export(payload)
        assert False, "Should raise ValueError"
    except ValueError as e:
        assert "Unrecognized Claude export format" in str(e)


def test_parse_timestamp_iso_format():
    """Test parse_timestamp with ISO format."""
    timestamp = "2024-01-01T12:00:00Z"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024
    assert result.month == 1
    assert result.day == 1


def test_parse_timestamp_iso_with_timezone():
    """Test parse_timestamp with ISO format and timezone."""
    timestamp = "2024-01-01T12:00:00+00:00"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix():
    """Test parse_timestamp with Unix timestamp."""
    timestamp = 1704110400  # 2024-01-01 12:00:00
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_none():
    """Test parse_timestamp with None."""
    result = parse_timestamp(None)
    assert result is None


def test_parse_timestamp_invalid():
    """Test parse_timestamp with invalid format."""
    result = parse_timestamp("invalid-date")
    assert result is None


def test_parse_claude_sender_mapping():
    """Test that sender 'human' maps to 'user' role."""
    payload = [
        {
            "uuid": "test",
            "name": "Test",
            "created_at": "2024-01-01T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg1",
                    "sender": "human",
                    "text": "Human message",
                    "created_at": "2024-01-01T12:00:00Z"
                },
                {
                    "uuid": "msg2",
                    "sender": "assistant",
                    "text": "Assistant message",
                    "created_at": "2024-01-01T12:00:00Z"
                },
                {
                    "uuid": "msg3",
                    "sender": "unknown",
                    "text": "Unknown message",
                    "created_at": "2024-01-01T12:00:00Z"
                }
            ]
        }
    ]
    
    result = parse_claude_export(payload)
    messages = result[0]["messages"]
    
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert messages[2]["role"] == "assistant"  # Unknown defaults to assistant


def test_parse_claude_multiple_conversations():
    """Test parsing multiple Claude conversations."""
    payload = [
        {
            "uuid": "conv1",
            "name": "First",
            "created_at": "2024-01-01T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg1",
                    "sender": "human",
                    "text": "Message 1",
                    "created_at": "2024-01-01T12:00:00Z"
                }
            ]
        },
        {
            "uuid": "conv2",
            "name": "Second",
            "created_at": "2024-01-02T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg2",
                    "sender": "human",
                    "text": "Message 2",
                    "created_at": "2024-01-02T12:00:00Z"
                }
            ]
        }
    ]
    
    result = parse_claude_export(payload)
    
    assert len(result) == 2
    assert result[0]["title"] == "First"
    assert result[1]["title"] == "Second"
````

## File: backend/tests/test_copilot_parser.py
````python
"""Unit tests for Copilot parser."""
from __future__ import annotations

from datetime import datetime
from app.importers.copilot import (
    parse_copilot_export,
    determine_role,
    extract_content,
    detect_content_type,
    parse_timestamp,
    generate_title_from_messages,
)


def test_parse_copilot_export_list_format():
    """Test parsing Copilot export as a list."""
    payload = [
        {
            "id": "copilot-123",
            "title": "VS Code Chat",
            "createdAt": "2024-01-01T12:00:00Z",
            "updatedAt": "2024-01-02T12:00:00Z",
            "messages": [
                {
                    "id": "msg1",
                    "role": "user",
                    "content": "How do I write a for loop in Python?",
                    "timestamp": "2024-01-01T12:00:00Z"
                },
                {
                    "id": "msg2",
                    "role": "assistant",
                    "content": "Here's how to write a for loop:\n```python\nfor i in range(10):\n    print(i)\n```",
                    "timestamp": "2024-01-01T12:00:05Z",
                    "model": "copilot"
                }
            ]
        }
    ]
    
    result = parse_copilot_export(payload)
    
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "copilot"
    assert conv["source_id"] == "copilot-123"
    assert conv["title"] == "VS Code Chat"
    assert conv["message_count"] == 2
    assert len(conv["messages"]) == 2
    
    # Verify messages
    msg1 = conv["messages"][0]
    assert msg1["role"] == "user"
    assert msg1["content"] == "How do I write a for loop in Python?"
    assert msg1["order_index"] == 0
    
    msg2 = conv["messages"][1]
    assert msg2["role"] == "assistant"
    assert "for i in range(10)" in msg2["content"]
    assert msg2["order_index"] == 1


def test_parse_copilot_export_dict_format():
    """Test parsing Copilot export as a dict with conversations key."""
    payload = {
        "conversations": [
            {
                "sessionId": "session-456",
                "name": "GitHub Chat",
                "startTime": "2024-01-01T12:00:00Z",
                "exchanges": [
                    {
                        "messageId": "msg1",
                        "author": "user",
                        "message": "Explain async/await",
                        "timestamp": "2024-01-01T12:00:00Z"
                    },
                    {
                        "messageId": "msg2",
                        "author": "copilot",
                        "message": "async/await is used for asynchronous programming...",
                        "timestamp": "2024-01-01T12:00:05Z"
                    }
                ]
            }
        ]
    }
    
    result = parse_copilot_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "session-456"
    assert result[0]["title"] == "GitHub Chat"
    assert len(result[0]["messages"]) == 2


def test_parse_copilot_export_alternative_keys():
    """Test parsing Copilot export with alternative key names."""
    payload = {
        "chats": [
            {
                "conversationId": "conv-789",
                "timestamp": 1704110400,  # Unix timestamp
                "turns": [
                    {
                        "type": "question",
                        "text": "What is REST?",
                        "createdAt": 1704110400
                    },
                    {
                        "type": "answer",
                        "text": "REST is an architectural style...",
                        "createdAt": 1704110405
                    }
                ]
            }
        ]
    }
    
    result = parse_copilot_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "conv-789"
    assert len(result[0]["messages"]) == 2
    assert result[0]["messages"][0]["role"] == "user"
    assert result[0]["messages"][1]["role"] == "assistant"


def test_determine_role_user_variants():
    """Test determine_role with various user role indicators."""
    assert determine_role({"role": "user"}) == "user"
    assert determine_role({"author": "human"}) == "user"
    assert determine_role({"sender": "question"}) == "user"
    assert determine_role({"type": "user"}) == "user"
    assert determine_role({"request": "some query"}) == "user"
    assert determine_role({"query": "some query"}) == "user"


def test_determine_role_assistant_variants():
    """Test determine_role with various assistant role indicators."""
    assert determine_role({"role": "assistant"}) == "assistant"
    assert determine_role({"author": "copilot"}) == "assistant"
    assert determine_role({"sender": "ai"}) == "assistant"
    assert determine_role({"type": "answer"}) == "assistant"
    assert determine_role({"response": "some response"}) == "assistant"


def test_determine_role_system():
    """Test determine_role with system role."""
    assert determine_role({"role": "system"}) == "system"
    assert determine_role({"type": "context"}) == "system"


def test_extract_content_simple_string():
    """Test extract_content with simple string content."""
    assert extract_content({"content": "Hello"}) == "Hello"
    assert extract_content({"text": "World"}) == "World"
    assert extract_content({"message": "Test"}) == "Test"


def test_extract_content_nested_dict():
    """Test extract_content with nested dict."""
    msg = {"content": {"text": "Nested content"}}
    assert extract_content(msg) == "Nested content"
    
    msg = {"content": {"value": "Another nested"}}
    assert extract_content(msg) == "Another nested"


def test_extract_content_list():
    """Test extract_content with list of parts."""
    msg = {"content": ["Part 1", "Part 2", "Part 3"]}
    assert extract_content(msg) == "Part 1\nPart 2\nPart 3"
    
    msg = {"content": [{"text": "P1"}, {"text": "P2"}]}
    assert extract_content(msg) == "P1\nP2"


def test_extract_content_request_response():
    """Test extract_content with request/response/query fields."""
    assert extract_content({"request": "Question"}) == "Question"
    assert extract_content({"response": "Answer"}) == "Answer"
    assert extract_content({"query": "Search"}) == "Search"


def test_detect_content_type_text():
    """Test detect_content_type for plain text."""
    msg = {"content": "Just plain text"}
    assert detect_content_type(msg) == "text"


def test_detect_content_type_code():
    """Test detect_content_type for code content."""
    msg = {"content": "Here's the code:\n```python\nprint('hello')\n```"}
    assert detect_content_type(msg) == "code"
    
    msg = {"hasCode": True, "content": "Some code"}
    assert detect_content_type(msg) == "code"
    
    msg = {"isCode": True, "content": "More code"}
    assert detect_content_type(msg) == "code"


def test_parse_timestamp_iso_format():
    """Test parse_timestamp with ISO format."""
    timestamp = "2024-01-01T12:00:00Z"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix_seconds():
    """Test parse_timestamp with Unix timestamp in seconds."""
    timestamp = 1704110400  # 2024-01-01 12:00:00
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix_milliseconds():
    """Test parse_timestamp with Unix timestamp in milliseconds."""
    timestamp = 1704110400000  # 2024-01-01 12:00:00
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_none():
    """Test parse_timestamp with None."""
    result = parse_timestamp(None)
    assert result is None


def test_generate_title_from_messages():
    """Test generate_title_from_messages."""
    messages = [
        {"role": "user", "content": "This is a long user message that should be truncated because it exceeds sixty characters"},
        {"role": "assistant", "content": "Response"}
    ]
    
    title = generate_title_from_messages(messages)
    assert len(title) <= 63  # 60 chars + "..."
    assert "This is a long user message" in title


def test_generate_title_from_messages_multiline():
    """Test generate_title_from_messages with multiline content."""
    messages = [
        {"role": "user", "content": "First line\nSecond line\nThird line"},
        {"role": "assistant", "content": "Response"}
    ]
    
    title = generate_title_from_messages(messages)
    assert title == "First line"


def test_generate_title_from_messages_no_user():
    """Test generate_title_from_messages with no user messages."""
    messages = [
        {"role": "assistant", "content": "Only assistant message"}
    ]
    
    title = generate_title_from_messages(messages)
    assert title == "Untitled Conversation"


def test_parse_copilot_export_empty_messages():
    """Test parsing Copilot export skips empty messages."""
    payload = [
        {
            "id": "test",
            "messages": [
                {"role": "user", "content": "Valid"},
                {"role": "assistant", "content": "   "},
                {"role": "user", "content": "Also valid"}
            ]
        }
    ]
    
    result = parse_copilot_export(payload)
    assert len(result[0]["messages"]) == 2


def test_parse_copilot_export_title_generation():
    """Test that titles are generated when missing."""
    payload = [
        {
            "id": "test",
            "messages": [
                {"role": "user", "content": "First user message should become title"},
                {"role": "assistant", "content": "Response"}
            ]
        }
    ]
    
    result = parse_copilot_export(payload)
    assert "First user message" in result[0]["title"]


def test_parse_copilot_export_invalid_format():
    """Test parsing Copilot export with invalid format."""
    payload = []  # Empty list should raise ValueError
    
    try:
        parse_copilot_export(payload)
        assert False, "Should raise ValueError for empty list"
    except ValueError as e:
        assert "Unrecognized Copilot export format" in str(e)
````

## File: backend/tests/test_gemini_parser.py
````python
"""Unit tests for Gemini parser."""
from __future__ import annotations

from datetime import datetime
from app.importers.gemini import (
    parse_gemini_export,
    determine_role,
    extract_content,
    parse_timestamp,
)


def test_parse_gemini_export_list_format():
    """Test parsing Gemini export as a list."""
    payload = [
        {
            "id": "gemini-123",
            "title": "Gemini Conversation",
            "create_time": 1704110400,  # Unix timestamp
            "update_time": 1704196800,
            "messages": [
                {
                    "id": "msg1",
                    "role": "user",
                    "text": "What is machine learning?",
                    "timestamp": 1704110400
                },
                {
                    "id": "msg2",
                    "role": "model",
                    "text": "Machine learning is a branch of AI...",
                    "timestamp": 1704110405,
                    "model": "gemini-pro"
                }
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "gemini"
    assert conv["source_id"] == "gemini-123"
    assert conv["title"] == "Gemini Conversation"
    assert conv["message_count"] == 2
    assert len(conv["messages"]) == 2
    
    # Verify messages
    msg1 = conv["messages"][0]
    assert msg1["role"] == "user"
    assert msg1["content"] == "What is machine learning?"
    assert msg1["order_index"] == 0
    
    msg2 = conv["messages"][1]
    assert msg2["role"] == "assistant"
    assert "Machine learning" in msg2["content"]
    assert msg2["order_index"] == 1
    assert msg2["model"] == "gemini-pro"


def test_parse_gemini_export_dict_with_conversations():
    """Test parsing Gemini export as dict with conversations key."""
    payload = {
        "conversations": [
            {
                "conversation_id": "conv-456",
                "name": "Bard Chat",
                "created_at": "2024-01-01T12:00:00.000",
                "turns": [
                    {
                        "message_id": "msg1",
                        "author": "user",
                        "prompt": "Explain quantum computing",
                        "create_time": 1704110400
                    },
                    {
                        "message_id": "msg2",
                        "author": "bard",
                        "response": "Quantum computing uses quantum bits...",
                        "create_time": 1704110405
                    }
                ]
            }
        ]
    }
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "conv-456"
    assert result[0]["title"] == "Bard Chat"
    assert len(result[0]["messages"]) == 2


def test_parse_gemini_export_single_conversation():
    """Test parsing Gemini export with single conversation."""
    payload = {
        "id": "single-789",
        "title": "Single Chat",
        "create_time": 1704110400,
        "messages": [
            {
                "id": "msg1",
                "role": "user",
                "text": "Test message"
            }
        ]
    }
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "single-789"


def test_parse_gemini_export_history_key():
    """Test parsing Gemini export with history key."""
    payload = {
        "history": [
            {
                "id": "hist-001",
                "name": "History Chat",
                "timestamp": 1704110400,
                "content": [
                    {
                        "sender": "human",
                        "message": "Message from history"
                    }
                ]
            }
        ]
    }
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "hist-001"


def test_determine_role_user():
    """Test determine_role with user indicators."""
    assert determine_role({"role": "user"}) == "user"
    assert determine_role({"author": "human"}) == "user"
    assert determine_role({"sender": "USER"}) == "user"


def test_determine_role_assistant():
    """Test determine_role with assistant indicators."""
    assert determine_role({"role": "model"}) == "assistant"
    assert determine_role({"author": "assistant"}) == "assistant"
    assert determine_role({"sender": "ai"}) == "assistant"
    assert determine_role({"author": "gemini"}) == "assistant"
    assert determine_role({"author": "bard"}) == "assistant"


def test_determine_role_with_user_input():
    """Test determine_role with user_input field."""
    assert determine_role({"user_input": "some text"}) == "user"
    assert determine_role({"prompt": "some prompt"}) == "user"


def test_determine_role_default():
    """Test determine_role defaults to assistant."""
    assert determine_role({"unknown": "field"}) == "assistant"


def test_extract_content_text():
    """Test extract_content with text field."""
    assert extract_content({"text": "Hello"}) == "Hello"


def test_extract_content_content():
    """Test extract_content with content field."""
    assert extract_content({"content": "World"}) == "World"


def test_extract_content_message():
    """Test extract_content with message field."""
    assert extract_content({"message": "Test"}) == "Test"


def test_extract_content_prompt_response():
    """Test extract_content with prompt/response fields."""
    assert extract_content({"prompt": "Question"}) == "Question"
    assert extract_content({"response": "Answer"}) == "Answer"


def test_extract_content_nested_dict():
    """Test extract_content with nested dict structure."""
    msg = {"content": {"text": "Nested text"}}
    assert extract_content(msg) == "Nested text"
    
    msg = {"content": {"parts": ["Part 1"]}}
    assert extract_content(msg) == "Part 1"


def test_extract_content_list():
    """Test extract_content with list of parts."""
    msg = {"text": ["Part 1", "Part 2", "Part 3"]}
    assert extract_content(msg) == "Part 1\nPart 2\nPart 3"
    
    msg = {"content": [None, "Valid", "", "Also valid"]}
    assert extract_content(msg) == "Valid\nAlso valid"


def test_parse_timestamp_iso_with_milliseconds():
    """Test parse_timestamp with ISO format including milliseconds."""
    timestamp = "2024-01-01T12:00:00.000"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_iso_basic():
    """Test parse_timestamp with basic ISO format."""
    timestamp = "2024-01-01T12:00:00"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_with_z():
    """Test parse_timestamp with Z timezone indicator."""
    timestamp = "2024-01-01T12:00:00.000Z"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix_seconds():
    """Test parse_timestamp with Unix timestamp in seconds."""
    timestamp = 1704110400
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix_milliseconds():
    """Test parse_timestamp with Unix timestamp in milliseconds."""
    timestamp = 1704110400000
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_none():
    """Test parse_timestamp with None."""
    result = parse_timestamp(None)
    assert result is None


def test_parse_timestamp_invalid():
    """Test parse_timestamp with invalid value."""
    result = parse_timestamp("not-a-date")
    assert result is None


def test_parse_gemini_export_empty_messages():
    """Test parsing Gemini export skips empty messages."""
    payload = [
        {
            "id": "test",
            "title": "Test",
            "messages": [
                {"role": "user", "text": "Valid message"},
                {"role": "model", "text": "   "},
                {"role": "user", "text": "Another valid"}
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    assert len(result[0]["messages"]) == 2


def test_parse_gemini_export_message_timestamp_fallback():
    """Test that message timestamps fall back to conversation timestamp."""
    payload = [
        {
            "id": "test",
            "title": "Test",
            "create_time": 1704110400,
            "messages": [
                {"role": "user", "text": "Message without timestamp"}
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    msg = result[0]["messages"][0]
    
    assert msg["created_at"] is not None
    assert isinstance(msg["created_at"], datetime)


def test_parse_gemini_export_model_fallback():
    """Test that model defaults to 'gemini' when not specified."""
    payload = [
        {
            "id": "test",
            "title": "Test",
            "messages": [
                {"role": "user", "text": "Message"}
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    assert result[0]["messages"][0]["model"] == "gemini"


def test_parse_gemini_export_model_inheritance():
    """Test that messages inherit model from conversation."""
    payload = [
        {
            "id": "test",
            "title": "Test",
            "model": "gemini-pro",
            "messages": [
                {"role": "user", "text": "Message"}
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    assert result[0]["messages"][0]["model"] == "gemini-pro"


def test_parse_gemini_export_multiple_conversations():
    """Test parsing multiple Gemini conversations."""
    payload = [
        {
            "id": "conv1",
            "title": "First",
            "messages": [{"role": "user", "text": "Msg 1"}]
        },
        {
            "id": "conv2",
            "title": "Second",
            "messages": [{"role": "user", "text": "Msg 2"}]
        }
    ]
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 2
    assert result[0]["title"] == "First"
    assert result[1]["title"] == "Second"


def test_parse_gemini_export_invalid_format():
    """Test parsing Gemini export with invalid format."""
    payload = []  # Empty list should raise ValueError
    
    try:
        parse_gemini_export(payload)
        assert False, "Should raise ValueError for empty list"
    except ValueError as e:
        assert "Unrecognized Gemini export format" in str(e)
````

## File: backend/tests/test_integration.py
````python
"""Integration tests for all parsers."""
from __future__ import annotations

import json
from app.importers.chatgpt import parse_chatgpt_export
from app.importers.claude import parse_claude_export
from app.importers.copilot import parse_copilot_export
from app.importers.gemini import parse_gemini_export


def test_all_parsers_return_consistent_format():
    """Test that all parsers return data in the same normalized format."""
    
    # ChatGPT data
    chatgpt_data = {
        "conversations": [{
            "id": "chatgpt-1",
            "title": "Test Chat",
            "create_time": 1704110400,
            "mapping": {
                "root": {"id": "root", "parent": None, "children": ["msg1"], "message": None},
                "msg1": {
                    "id": "msg1",
                    "parent": "root",
                    "children": [],
                    "message": {
                        "id": "msg1",
                        "author": {"role": "user"},
                        "content": {"content_type": "text", "parts": ["Test"]},
                        "metadata": {}
                    }
                }
            }
        }]
    }
    
    # Claude data
    claude_data = [{
        "uuid": "claude-1",
        "name": "Test Chat",
        "created_at": "2024-01-01T12:00:00Z",
        "chat_messages": [{
            "uuid": "msg1",
            "sender": "human",
            "text": "Test",
            "created_at": "2024-01-01T12:00:00Z"
        }]
    }]
    
    # Copilot data
    copilot_data = [{
        "id": "copilot-1",
        "title": "Test Chat",
        "createdAt": "2024-01-01T12:00:00Z",
        "messages": [{
            "id": "msg1",
            "role": "user",
            "content": "Test",
            "timestamp": "2024-01-01T12:00:00Z"
        }]
    }]
    
    # Gemini data
    gemini_data = [{
        "id": "gemini-1",
        "title": "Test Chat",
        "create_time": 1704110400,
        "messages": [{
            "id": "msg1",
            "role": "user",
            "text": "Test",
            "timestamp": 1704110400
        }]
    }]
    
    # Parse all
    chatgpt_result = parse_chatgpt_export(chatgpt_data)
    claude_result = parse_claude_export(claude_data)
    copilot_result = parse_copilot_export(copilot_data)
    gemini_result = parse_gemini_export(gemini_data)
    
    # All should return lists
    assert isinstance(chatgpt_result, list)
    assert isinstance(claude_result, list)
    assert isinstance(copilot_result, list)
    assert isinstance(gemini_result, list)
    
    # All should have one conversation
    assert len(chatgpt_result) == 1
    assert len(claude_result) == 1
    assert len(copilot_result) == 1
    assert len(gemini_result) == 1
    
    # Check required keys for all parsers
    required_keys = {"source", "source_id", "title", "message_count", "messages", "raw_json"}
    
    for result, source_name in [
        (chatgpt_result[0], "chatgpt"),
        (claude_result[0], "claude"),
        (copilot_result[0], "copilot"),
        (gemini_result[0], "gemini")
    ]:
        assert set(result.keys()).issuperset(required_keys), f"Missing keys in {source_name}"
        assert result["source"] == source_name
        assert isinstance(result["messages"], list)
        assert len(result["messages"]) > 0
        
        # Check message format
        msg = result["messages"][0]
        required_msg_keys = {"role", "content", "content_type", "order_index"}
        assert set(msg.keys()).issuperset(required_msg_keys), f"Missing message keys in {source_name}"


def test_all_parsers_handle_multiple_conversations():
    """Test that all parsers can handle multiple conversations."""
    
    # ChatGPT
    chatgpt_data = [
        {
            "id": "conv1",
            "title": "First",
            "mapping": {
                "root": {"id": "root", "parent": None, "children": ["msg1"], "message": None},
                "msg1": {
                    "id": "msg1",
                    "parent": "root",
                    "children": [],
                    "message": {
                        "author": {"role": "user"},
                        "content": {"content_type": "text", "parts": ["Test"]},
                        "metadata": {}
                    }
                }
            }
        },
        {
            "id": "conv2",
            "title": "Second",
            "mapping": {
                "root": {"id": "root", "parent": None, "children": ["msg1"], "message": None},
                "msg1": {
                    "id": "msg1",
                    "parent": "root",
                    "children": [],
                    "message": {
                        "author": {"role": "user"},
                        "content": {"content_type": "text", "parts": ["Test"]},
                        "metadata": {}
                    }
                }
            }
        }
    ]
    
    # Claude
    claude_data = [
        {
            "uuid": "conv1",
            "name": "First",
            "chat_messages": [{"sender": "human", "text": "Test"}]
        },
        {
            "uuid": "conv2",
            "name": "Second",
            "chat_messages": [{"sender": "human", "text": "Test"}]
        }
    ]
    
    # Copilot
    copilot_data = [
        {
            "id": "conv1",
            "title": "First",
            "messages": [{"role": "user", "content": "Test"}]
        },
        {
            "id": "conv2",
            "title": "Second",
            "messages": [{"role": "user", "content": "Test"}]
        }
    ]
    
    # Gemini
    gemini_data = [
        {
            "id": "conv1",
            "title": "First",
            "messages": [{"role": "user", "text": "Test"}]
        },
        {
            "id": "conv2",
            "title": "Second",
            "messages": [{"role": "user", "text": "Test"}]
        }
    ]
    
    # All should parse 2 conversations
    assert len(parse_chatgpt_export(chatgpt_data)) == 2
    assert len(parse_claude_export(claude_data)) == 2
    assert len(parse_copilot_export(copilot_data)) == 2
    assert len(parse_gemini_export(gemini_data)) == 2


def test_all_parsers_skip_empty_messages():
    """Test that all parsers skip empty messages."""
    
    # ChatGPT
    chatgpt_data = [{
        "id": "test",
        "mapping": {
            "root": {"id": "root", "parent": None, "children": ["msg1", "msg2"], "message": None},
            "msg1": {
                "id": "msg1",
                "parent": "root",
                "children": [],
                "message": {
                    "author": {"role": "user"},
                    "content": {"content_type": "text", "parts": ["Valid"]},
                    "metadata": {}
                }
            },
            "msg2": {
                "id": "msg2",
                "parent": "root",
                "children": [],
                "message": {
                    "author": {"role": "user"},
                    "content": {"content_type": "text", "parts": [""]},
                    "metadata": {}
                }
            }
        }
    }]
    
    # Claude
    claude_data = [{
        "uuid": "test",
        "chat_messages": [
            {"sender": "human", "text": "Valid"},
            {"sender": "human", "text": "   "}
        ]
    }]
    
    # Copilot
    copilot_data = [{
        "id": "test",
        "messages": [
            {"role": "user", "content": "Valid"},
            {"role": "user", "content": ""}
        ]
    }]
    
    # Gemini
    gemini_data = [{
        "id": "test",
        "messages": [
            {"role": "user", "text": "Valid"},
            {"role": "user", "text": "   "}
        ]
    }]
    
    # All should parse only 1 message
    assert len(parse_chatgpt_export(chatgpt_data)[0]["messages"]) == 1
    assert len(parse_claude_export(claude_data)[0]["messages"]) == 1
    assert len(parse_copilot_export(copilot_data)[0]["messages"]) == 1
    assert len(parse_gemini_export(gemini_data)[0]["messages"]) == 1


def test_all_parsers_handle_error_cases():
    """Test that all parsers raise appropriate errors for invalid input."""
    
    # ChatGPT should raise ValueError for truly invalid format
    try:
        parse_chatgpt_export({"invalid": "format"})
        assert False, "ChatGPT parser should raise ValueError"
    except ValueError:
        pass
    
    # Claude should raise ValueError for empty conversations list
    try:
        parse_claude_export({"conversations": []})
        assert False, "Claude parser should raise ValueError"
    except ValueError:
        pass
    
    # Copilot should raise ValueError for empty list
    try:
        parse_copilot_export([])
        assert False, "Copilot parser should raise ValueError"
    except ValueError:
        pass
    
    # Gemini should raise ValueError for empty list
    try:
        parse_gemini_export([])
        assert False, "Gemini parser should raise ValueError"
    except ValueError:
        pass


def test_raw_json_is_preserved():
    """Test that all parsers preserve raw JSON for debugging."""
    
    # Test with ChatGPT
    chatgpt_data = [{
        "id": "test",
        "custom_field": "custom_value",
        "mapping": {
            "root": {"id": "root", "parent": None, "children": ["msg1"], "message": None},
            "msg1": {
                "id": "msg1",
                "parent": "root",
                "children": [],
                "message": {
                    "author": {"role": "user"},
                    "content": {"content_type": "text", "parts": ["Test"]},
                    "metadata": {}
                }
            }
        }
    }]
    
    result = parse_chatgpt_export(chatgpt_data)
    raw_json = json.loads(result[0]["raw_json"])
    
    assert "custom_field" in raw_json
    assert raw_json["custom_field"] == "custom_value"
````

## File: backend/tests/test_preprocessing.py
````python
"""Comprehensive tests for the preprocessing pipeline."""

from __future__ import annotations

import json
from datetime import datetime

import pytest

from app.preprocessing.cleaner import (
    clean_conversation,
    clean_text,
    generate_preview,
    normalize_unicode,
    normalize_whitespace,
)
from app.preprocessing.classifier import (
    classify_conversation,
    extract_entities,
)
from app.preprocessing.deduplication import (
    compute_content_hash,
    deduplicate_conversations,
    mark_content_hash,
)
from app.preprocessing.extractor import (
    extract_artifacts,
    extract_code_blocks,
    extract_conversation_content,
    extract_tables,
)
from app.preprocessing.models import (
    EntityExtraction,
    ImportResult,
    ProcessedConversation,
    ProcessedMessage,
    TokenMetrics,
)
from app.preprocessing.parser import (
    parse_claude_export_to_conversations,
    parse_single_conversation,
    parse_timestamp,
)
from app.preprocessing.pipeline import (
    PipelineConfig,
    PreprocessingPipeline,
    process_export,
)
from app.preprocessing.token_counter import count_conversation_tokens, count_tokens


# ============================================================================
# Fixtures / helpers
# ============================================================================

def _make_export_payload(conversations=None):
    """Build a minimal Claude export payload."""
    if conversations is None:
        conversations = [_make_raw_conversation()]
    return conversations


def _make_raw_conversation(
    uuid="conv-001",
    name="Test Conversation",
    messages=None,
    model="claude-3",
):
    if messages is None:
        messages = [
            {
                "uuid": "msg-001",
                "sender": "human",
                "text": "Hello, can you help me with Python?",
                "created_at": "2024-06-01T10:00:00Z",
            },
            {
                "uuid": "msg-002",
                "sender": "assistant",
                "text": "Of course! I'd be happy to help you with Python. What do you need?",
                "created_at": "2024-06-01T10:00:05Z",
            },
        ]
    return {
        "uuid": uuid,
        "name": name,
        "created_at": "2024-06-01T10:00:00Z",
        "updated_at": "2024-06-01T10:30:00Z",
        "chat_messages": messages,
        "model": model,
    }


def _make_code_conversation():
    """Build a conversation with code blocks and tables."""
    return _make_raw_conversation(
        uuid="conv-code",
        name="Python sorting help",
        messages=[
            {
                "uuid": "msg-c1",
                "sender": "human",
                "text": "How do I sort a list in Python?",
                "created_at": "2024-06-01T10:00:00Z",
            },
            {
                "uuid": "msg-c2",
                "sender": "assistant",
                "text": (
                    "Here's how to sort a list:\n\n"
                    "```python\n"
                    "numbers = [3, 1, 4, 1, 5]\n"
                    "sorted_numbers = sorted(numbers)\n"
                    "print(sorted_numbers)\n"
                    "```\n\n"
                    "You can also sort in-place:\n\n"
                    "```python\n"
                    "numbers.sort()\n"
                    "```\n\n"
                    "Here's a comparison:\n\n"
                    "| Method | In-place | Returns |\n"
                    "|--------|----------|----------|\n"
                    "| sort() | Yes | None |\n"
                    "| sorted() | No | New list |\n"
                ),
                "created_at": "2024-06-01T10:00:10Z",
            },
        ],
    )


def _make_artifact_conversation():
    """Build a conversation with artifacts."""
    return _make_raw_conversation(
        uuid="conv-artifact",
        name="Build a calculator",
        messages=[
            {
                "uuid": "msg-a1",
                "sender": "human",
                "text": "Build me a simple calculator in React.",
                "created_at": "2024-06-01T11:00:00Z",
            },
            {
                "uuid": "msg-a2",
                "sender": "assistant",
                "text": (
                    'Here is a calculator component:\n\n'
                    '<antArtifact identifier="calc-v1" type="application/vnd.ant.react" '
                    'title="Simple Calculator">\n'
                    'function Calculator() {\n'
                    '  return <div>Calculator</div>;\n'
                    '}\n'
                    '</antArtifact>'
                ),
                "created_at": "2024-06-01T11:00:30Z",
            },
        ],
    )


# ============================================================================
# Parser tests
# ============================================================================

class TestParser:
    def test_parse_timestamp_iso(self):
        result = parse_timestamp("2024-06-01T10:00:00Z")
        assert isinstance(result, datetime)
        assert result.year == 2024
        assert result.month == 6

    def test_parse_timestamp_unix(self):
        result = parse_timestamp(1717232400)
        assert isinstance(result, datetime)

    def test_parse_timestamp_none(self):
        assert parse_timestamp(None) is None

    def test_parse_timestamp_invalid(self):
        assert parse_timestamp("not-a-date") is None

    def test_parse_single_conversation(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)

        assert conv.source == "claude"
        assert conv.source_id == "conv-001"
        assert conv.title == "Test Conversation"
        assert conv.message_count == 2
        assert len(conv.messages) == 2
        assert conv.messages[0].role == "user"
        assert conv.messages[1].role == "assistant"

    def test_parse_conversation_skips_empty_messages(self):
        raw = _make_raw_conversation(messages=[
            {"uuid": "m1", "sender": "human", "text": "Hello", "created_at": "2024-01-01T00:00:00Z"},
            {"uuid": "m2", "sender": "assistant", "text": "  ", "created_at": "2024-01-01T00:00:01Z"},
            {"uuid": "m3", "sender": "human", "text": "World", "created_at": "2024-01-01T00:00:02Z"},
        ])
        conv = parse_single_conversation(raw)
        assert conv.message_count == 2

    def test_parse_conversation_duration(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        assert conv.duration_seconds == 5.0

    def test_parse_export_list_format(self):
        payload = [_make_raw_conversation()]
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 1
        assert result[0].source_id == "conv-001"

    def test_parse_export_single_object(self):
        payload = _make_raw_conversation()
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 1

    def test_parse_export_wrapped_format(self):
        payload = {"conversations": [_make_raw_conversation()]}
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 1

    def test_parse_export_data_key(self):
        payload = {"data": [_make_raw_conversation()]}
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 1

    def test_parse_export_invalid_format(self):
        with pytest.raises(ValueError, match="Unrecognized"):
            parse_claude_export_to_conversations({"foo": "bar"})

    def test_parse_export_multiple_conversations(self):
        payload = [
            _make_raw_conversation(uuid="c1", name="First"),
            _make_raw_conversation(uuid="c2", name="Second"),
        ]
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 2
        assert result[0].title == "First"
        assert result[1].title == "Second"

    def test_parse_preserves_raw_json(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        parsed_back = json.loads(conv.raw_json)
        assert parsed_back["uuid"] == "conv-001"

    def test_parse_sender_mapping(self):
        raw = _make_raw_conversation(messages=[
            {"uuid": "m1", "sender": "human", "text": "Hi", "created_at": "2024-01-01T00:00:00Z"},
            {"uuid": "m2", "sender": "assistant", "text": "Hello", "created_at": "2024-01-01T00:00:01Z"},
            {"uuid": "m3", "sender": "unknown", "text": "?", "created_at": "2024-01-01T00:00:02Z"},
        ])
        conv = parse_single_conversation(raw)
        assert conv.messages[0].role == "user"
        assert conv.messages[1].role == "assistant"
        assert conv.messages[2].role == "assistant"  # unknown defaults to assistant


# ============================================================================
# Extractor tests
# ============================================================================

class TestExtractor:
    def test_extract_code_blocks_with_language(self):
        text = "Some text\n\n```python\nprint('hello')\n```\n\nMore text"
        blocks = extract_code_blocks(text)
        assert len(blocks) == 1
        assert blocks[0].language == "python"
        assert "print('hello')" in blocks[0].code

    def test_extract_code_blocks_no_language(self):
        text = "```\nsome code\n```"
        blocks = extract_code_blocks(text)
        assert len(blocks) == 1
        assert blocks[0].language is None

    def test_extract_multiple_code_blocks(self):
        text = "```python\na = 1\n```\ntext\n```javascript\nlet b = 2;\n```"
        blocks = extract_code_blocks(text)
        assert len(blocks) == 2
        assert blocks[0].language == "python"
        assert blocks[1].language == "javascript"

    def test_extract_no_code_blocks(self):
        text = "Just plain text with no code."
        blocks = extract_code_blocks(text)
        assert len(blocks) == 0

    def test_extract_tables(self):
        text = (
            "| Name | Age |\n"
            "|------|-----|\n"
            "| Alice | 30 |\n"
            "| Bob | 25 |\n"
        )
        tables = extract_tables(text)
        assert len(tables) == 1
        assert tables[0].headers == ["Name", "Age"]
        assert len(tables[0].rows) == 2
        assert tables[0].rows[0] == ["Alice", "30"]

    def test_extract_no_tables(self):
        text = "Just text, no tables here."
        tables = extract_tables(text)
        assert len(tables) == 0

    def test_extract_artifacts(self):
        text = (
            '<antArtifact identifier="test-1" type="text/html" title="My Page">'
            "<h1>Hello</h1>"
            "</antArtifact>"
        )
        artifacts = extract_artifacts(text)
        assert len(artifacts) == 1
        assert artifacts[0].identifier == "test-1"
        assert artifacts[0].artifact_type == "text/html"
        assert artifacts[0].title == "My Page"
        assert "<h1>Hello</h1>" in artifacts[0].content

    def test_extract_no_artifacts(self):
        text = "No artifacts here."
        artifacts = extract_artifacts(text)
        assert len(artifacts) == 0

    def test_extract_conversation_content(self):
        raw = _make_code_conversation()
        conv = parse_single_conversation(raw)
        extract_conversation_content(conv)

        assert len(conv.code_blocks) == 2
        assert conv.code_blocks[0].language == "python"

    def test_extract_conversation_artifacts(self):
        raw = _make_artifact_conversation()
        conv = parse_single_conversation(raw)
        extract_conversation_content(conv)

        assert len(conv.artifacts) == 1
        assert conv.artifacts[0].identifier == "calc-v1"
        assert conv.artifacts[0].title == "Simple Calculator"


# ============================================================================
# Cleaner tests
# ============================================================================

class TestCleaner:
    def test_normalize_unicode(self):
        # Replacement character should be removed
        text = "Hello\ufffdWorld"
        assert normalize_unicode(text) == "HelloWorld"

    def test_normalize_whitespace_collapses_excessive_newlines(self):
        text = "Hello\n\n\n\n\n\nWorld"
        result = normalize_whitespace(text)
        assert result == "Hello\n\n\nWorld"

    def test_normalize_whitespace_preserves_double_newlines(self):
        text = "Paragraph one.\n\nParagraph two."
        result = normalize_whitespace(text)
        assert result == text

    def test_normalize_whitespace_strips_trailing(self):
        text = "Hello   \nWorld  "
        result = normalize_whitespace(text)
        assert result == "Hello\nWorld"

    def test_clean_text_combined(self):
        text = "Hello\ufffd   \n\n\n\n\n\nWorld  "
        result = clean_text(text)
        assert "\ufffd" not in result
        assert result == "Hello\n\n\nWorld"

    def test_generate_preview_short_text(self):
        text = "Short text."
        assert generate_preview(text) == "Short text."

    def test_generate_preview_long_text(self):
        text = "word " * 100
        preview = generate_preview(text, max_length=50)
        assert len(preview) <= 55  # Allow for "..."
        assert preview.endswith("...")

    def test_clean_conversation_generates_preview(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        clean_conversation(conv)

        assert conv.preview is not None
        assert "Python" in conv.preview

    def test_clean_conversation_cleans_title(self):
        raw = _make_raw_conversation(name="  Messy Title  ")
        conv = parse_single_conversation(raw)
        clean_conversation(conv)
        assert conv.title == "Messy Title"


# ============================================================================
# Classifier tests
# ============================================================================

class TestClassifier:
    def test_classify_coding_conversation(self):
        raw = _make_raw_conversation(
            name="Python sorting",
            messages=[
                {"uuid": "m1", "sender": "human", "text": "How do I sort a list in Python using the sorted function?", "created_at": "2024-01-01T00:00:00Z"},
                {"uuid": "m2", "sender": "assistant", "text": "You can use sorted() like this...", "created_at": "2024-01-01T00:00:01Z"},
            ],
        )
        conv = parse_single_conversation(raw)
        classify_conversation(conv)

        assert "coding" in conv.tags

    def test_classify_education_conversation(self):
        raw = _make_raw_conversation(
            name="Homework help",
            messages=[
                {"uuid": "m1", "sender": "human", "text": "Help me with my university assignment on research methods.", "created_at": "2024-01-01T00:00:00Z"},
                {"uuid": "m2", "sender": "assistant", "text": "I'd be happy to help with your assignment.", "created_at": "2024-01-01T00:00:01Z"},
            ],
        )
        conv = parse_single_conversation(raw)
        classify_conversation(conv)

        assert "education" in conv.tags

    def test_extract_entities_programming_languages(self):
        conv = ProcessedConversation(
            title="Python and JavaScript",
            messages=[
                ProcessedMessage(role="user", content="I need help with Python and React."),
                ProcessedMessage(role="assistant", content="Sure, let me help with Python and React."),
            ],
        )
        entities = extract_entities(conv)

        assert "python" in entities.programming_languages
        assert "react" in entities.frameworks

    def test_extract_entities_from_code(self):
        conv = ProcessedConversation(
            title="FastAPI app",
            messages=[
                ProcessedMessage(
                    role="user",
                    content="I'm building a FastAPI app with SQLAlchemy and deploying to AWS.",
                ),
            ],
        )
        entities = extract_entities(conv)

        assert "fastapi" in entities.frameworks
        assert "sqlalchemy" in entities.libraries
        assert "aws" in entities.technologies


# ============================================================================
# Token counter tests
# ============================================================================

class TestTokenCounter:
    def test_count_tokens_nonempty(self):
        tokens = count_tokens("Hello world, this is a test.")
        assert tokens > 0

    def test_count_tokens_empty(self):
        tokens = count_tokens("")
        # Even empty should return at least 0-1 depending on method
        assert tokens >= 0

    def test_count_conversation_tokens(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        count_conversation_tokens(conv)

        assert conv.token_metrics.total_tokens > 0
        assert conv.token_metrics.user_tokens > 0
        assert conv.token_metrics.assistant_tokens > 0
        assert conv.token_metrics.avg_tokens_per_message > 0

    def test_per_message_token_count(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        count_conversation_tokens(conv)

        for msg in conv.messages:
            assert msg.token_count > 0


# ============================================================================
# Deduplication tests
# ============================================================================

class TestDeduplication:
    def test_compute_content_hash_deterministic(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        h1 = compute_content_hash(conv)
        h2 = compute_content_hash(conv)
        assert h1 == h2

    def test_different_content_different_hash(self):
        c1 = parse_single_conversation(_make_raw_conversation(uuid="c1", name="First"))
        c2 = parse_single_conversation(_make_raw_conversation(uuid="c2", name="Second"))
        assert compute_content_hash(c1) != compute_content_hash(c2)

    def test_mark_content_hash(self):
        conv = parse_single_conversation(_make_raw_conversation())
        assert conv.content_hash is None
        mark_content_hash(conv)
        assert conv.content_hash is not None
        assert len(conv.content_hash) == 64  # SHA-256 hex

    def test_deduplicate_within_batch(self):
        # Two identical conversations in the same batch
        raw = _make_raw_conversation()
        c1 = parse_single_conversation(raw)
        c2 = parse_single_conversation(raw)
        mark_content_hash(c1)
        mark_content_hash(c2)

        unique, dupes = deduplicate_conversations([c1, c2])
        assert len(unique) == 1
        assert len(dupes) == 1

    def test_deduplicate_against_existing_source_ids(self):
        conv = parse_single_conversation(_make_raw_conversation())
        mark_content_hash(conv)

        unique, dupes = deduplicate_conversations(
            [conv], existing_source_ids={"conv-001"}
        )
        assert len(unique) == 0
        assert len(dupes) == 1

    def test_deduplicate_against_existing_hashes(self):
        conv = parse_single_conversation(_make_raw_conversation())
        mark_content_hash(conv)

        unique, dupes = deduplicate_conversations(
            [conv], existing_hashes={conv.content_hash}
        )
        assert len(unique) == 0
        assert len(dupes) == 1

    def test_deduplicate_no_duplicates(self):
        c1 = parse_single_conversation(_make_raw_conversation(uuid="c1", name="A"))
        c2 = parse_single_conversation(_make_raw_conversation(uuid="c2", name="B"))

        unique, dupes = deduplicate_conversations([c1, c2])
        assert len(unique) == 2
        assert len(dupes) == 0


# ============================================================================
# Pipeline integration tests
# ============================================================================

class TestPipeline:
    def test_process_export_basic(self):
        payload = _make_export_payload()
        result = process_export(payload)

        assert isinstance(result, ImportResult)
        assert result.total_conversations == 1
        assert result.processed_conversations == 1
        assert result.failed_conversations == 0
        assert len(result.conversations) == 1

    def test_process_export_all_fields_populated(self):
        payload = _make_export_payload([_make_code_conversation()])
        result = process_export(payload)

        conv = result.conversations[0]
        assert conv.source == "claude"
        assert conv.title is not None
        assert conv.messages
        assert conv.preview is not None
        assert conv.content_hash is not None
        assert conv.token_metrics.total_tokens > 0
        assert len(conv.code_blocks) > 0

    def test_process_export_with_artifacts(self):
        payload = _make_export_payload([_make_artifact_conversation()])
        result = process_export(payload)

        conv = result.conversations[0]
        assert len(conv.artifacts) == 1

    def test_process_export_deduplication(self):
        raw = _make_raw_conversation()
        payload = [raw, raw]  # Duplicate
        result = process_export(payload)

        assert result.total_conversations == 2
        assert result.processed_conversations == 1
        assert result.skipped_duplicates == 1

    def test_process_export_with_existing_ids(self):
        payload = _make_export_payload()
        config = PipelineConfig(existing_source_ids={"conv-001"})
        result = process_export(payload, config=config)

        assert result.processed_conversations == 0
        assert result.skipped_duplicates == 1

    def test_process_export_disable_steps(self):
        payload = _make_export_payload()
        config = PipelineConfig(
            enable_cleaning=False,
            enable_extraction=False,
            enable_classification=False,
            enable_token_counting=False,
            enable_deduplication=False,
        )
        result = process_export(payload, config=config)

        conv = result.conversations[0]
        assert conv.token_metrics.total_tokens == 0
        assert conv.tags == []

    def test_process_export_invalid_payload(self):
        result = process_export({"invalid": "data"})
        assert result.total_conversations == 0
        assert len(result.errors) == 1
        assert "Parsing failed" in result.errors[0]

    def test_process_export_multiple_conversations(self):
        payload = [
            _make_raw_conversation(uuid="c1", name="Conv 1"),
            _make_raw_conversation(uuid="c2", name="Conv 2"),
            _make_raw_conversation(uuid="c3", name="Conv 3"),
        ]
        result = process_export(payload)

        assert result.total_conversations == 3
        assert result.processed_conversations == 3

    def test_progress_callback(self):
        stages = []

        def on_progress(p):
            stages.append(p.stage)

        payload = _make_export_payload()
        process_export(payload, progress_callback=on_progress)

        assert "parsing" in stages
        assert "processing" in stages
        assert "deduplication" in stages
        assert "complete" in stages

    def test_to_db_dict(self):
        payload = _make_export_payload()
        result = process_export(payload)
        conv = result.conversations[0]
        db_dict = conv.to_db_dict()

        assert db_dict["source"] == "claude"
        assert db_dict["source_id"] == "conv-001"
        assert "messages" in db_dict
        assert len(db_dict["messages"]) == 2
        assert db_dict["messages"][0]["role"] == "user"


class TestPreprocessingPipeline:
    def test_pipeline_run(self):
        pipeline = PreprocessingPipeline()
        result = pipeline.run(_make_export_payload())

        assert result.processed_conversations == 1
        assert pipeline.progress is not None
        assert pipeline.progress.stage == "complete"

    def test_pipeline_dry_run(self):
        pipeline = PreprocessingPipeline()
        result = pipeline.dry_run(_make_export_payload())

        assert result.processed_conversations == 1
        # Config should be restored
        assert pipeline.config.dry_run is False

    def test_pipeline_with_config(self):
        config = PipelineConfig(enable_token_counting=False)
        pipeline = PreprocessingPipeline(config=config)
        result = pipeline.run(_make_export_payload())

        conv = result.conversations[0]
        assert conv.token_metrics.total_tokens == 0


# ============================================================================
# Edge case tests
# ============================================================================

class TestEdgeCases:
    def test_empty_conversation(self):
        raw = _make_raw_conversation(messages=[])
        conv = parse_single_conversation(raw)
        assert conv.message_count == 0
        assert conv.duration_seconds is None

    def test_very_long_message(self):
        long_text = "x " * 50000
        raw = _make_raw_conversation(messages=[
            {"uuid": "m1", "sender": "human", "text": long_text, "created_at": "2024-01-01T00:00:00Z"},
        ])
        payload = [raw]
        result = process_export(payload)

        conv = result.conversations[0]
        assert conv.preview is not None
        assert len(conv.preview) <= 310  # 300 + "..."
        assert conv.token_metrics.total_tokens > 0

    def test_conversation_with_only_code(self):
        raw = _make_raw_conversation(messages=[
            {
                "uuid": "m1",
                "sender": "human",
                "text": "```python\nprint('hello')\n```",
                "created_at": "2024-01-01T00:00:00Z",
            },
        ])
        payload = [raw]
        result = process_export(payload)

        conv = result.conversations[0]
        assert len(conv.code_blocks) == 1

    def test_conversation_with_mixed_content(self):
        raw = _make_code_conversation()
        payload = [raw]
        result = process_export(payload)

        conv = result.conversations[0]
        assert len(conv.code_blocks) > 0
        assert conv.tags  # Should be classified

    def test_conversation_no_title(self):
        raw = _make_raw_conversation(name=None)
        conv = parse_single_conversation(raw)
        assert conv.title is None

    def test_missing_timestamps(self):
        raw = _make_raw_conversation(messages=[
            {"uuid": "m1", "sender": "human", "text": "No time", "created_at": None},
        ])
        raw["created_at"] = None
        raw["updated_at"] = None
        conv = parse_single_conversation(raw)
        assert conv.created_at is None
        assert conv.messages[0].created_at is None

    def test_batch_processing(self):
        """Test processing a large batch of conversations."""
        payload = [
            _make_raw_conversation(uuid=f"conv-{i}", name=f"Conv {i}")
            for i in range(50)
        ]
        result = process_export(payload)

        assert result.total_conversations == 50
        assert result.processed_conversations == 50
        assert result.failed_conversations == 0
````

## File: backend/tests/test_query_filters.py
````python
from __future__ import annotations

import importlib
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base, Conversation, Project, Tag


@pytest.fixture()
def db_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine)
    session = session_local()
    try:
        yield session
    finally:
        session.close()


def _make_conversation(
    db_session: Session,
    *,
    title: str,
    source: str,
    tag: Tag,
    project: Project | None,
) -> Conversation:
    conversation = Conversation(
        source=source,
        source_id=f"{source}-{title}",
        title=title,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        message_count=1,
        raw_json="{}",
        project=project,
        tags=[tag],
    )
    db_session.add(conversation)
    db_session.commit()
    return conversation


def _load_filter_helper():
    try:
        module = importlib.import_module("app.query_filters")
    except ModuleNotFoundError as exc:
        pytest.fail(f"Expected app.query_filters helper module: {exc}")

    return module.apply_conversation_filters


def test_apply_conversation_filters_combines_source_tag_and_project(db_session: Session):
    apply_conversation_filters = _load_filter_helper()

    coding = Tag(name="coding", color="#3B82F6")
    writing = Tag(name="writing", color="#EC4899")
    polish = Project(name="Archive polish", color="#8B5CF6")
    db_session.add_all([coding, writing, polish])
    db_session.commit()

    matching = _make_conversation(
        db_session,
        title="matching",
        source="chatgpt",
        tag=coding,
        project=polish,
    )
    _make_conversation(
        db_session,
        title="wrong-source",
        source="claude",
        tag=coding,
        project=polish,
    )
    _make_conversation(
        db_session,
        title="wrong-tag",
        source="chatgpt",
        tag=writing,
        project=polish,
    )

    query = apply_conversation_filters(
        db_session.query(Conversation),
        source="chatgpt",
        tag="coding",
        project_id=polish.id,
    )

    assert [conversation.id for conversation in query.all()] == [matching.id]


def test_apply_conversation_filters_supports_uncategorized_project(db_session: Session):
    apply_conversation_filters = _load_filter_helper()

    coding = Tag(name="coding", color="#3B82F6")
    polish = Project(name="Archive polish", color="#8B5CF6")
    db_session.add_all([coding, polish])
    db_session.commit()

    uncategorized = _make_conversation(
        db_session,
        title="uncategorized",
        source="chatgpt",
        tag=coding,
        project=None,
    )
    _make_conversation(
        db_session,
        title="categorized",
        source="chatgpt",
        tag=coding,
        project=polish,
    )

    query = apply_conversation_filters(
        db_session.query(Conversation),
        source="chatgpt",
        tag="coding",
        project_id=-1,
    )

    assert [conversation.id for conversation in query.all()] == [uncategorized.id]
````

## File: backend/tests/test_tagger.py
````python
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
````

## File: backend/check_schema.py
````python
import sqlite3
conn = sqlite3.connect('chatarchive.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(conversations)")
columns = cursor.fetchall()
print("Conversations columns:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")
conn.close()
````

## File: backend/init_db.py
````python
#!/usr/bin/env python
"""Initialize the ChatArchive database."""

from app.database import engine
from app.models import Base


def init_db() -> None:
    """Create all database tables."""
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    print("[OK] Database initialized successfully")
    print(f"  Location: {engine.url}")


if __name__ == "__main__":
    init_db()
````

## File: backend/keepalive_supabase.py
````python
#!/usr/bin/env python3
"""
keepalive_supabase.py

Sends a lightweight read request to the configured Supabase project to prevent
free-tier projects from being paused due to inactivity.

Usage:
    python backend/keepalive_supabase.py

Required environment variables:
    SUPABASE_URL      – e.g. https://yourproject.supabase.co
    SUPABASE_ANON_KEY – your project's anon/public API key

Optional environment variables:
    SUPABASE_KEEPALIVE_TABLE – table to query (default: conversations)
"""

import os
import sys
from pathlib import Path

# Load .env from the backend directory when run directly
_backend_dir = Path(__file__).parent
_dotenv_path = _backend_dir / ".env"
if _dotenv_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_dotenv_path)
    except ImportError:
        pass  # python-dotenv not installed; rely on environment variables

import requests  # noqa: E402  (imported after dotenv load)


def main() -> None:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY", "")

    if not supabase_url:
        print("ERROR: SUPABASE_URL environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    if not supabase_anon_key:
        print("ERROR: SUPABASE_ANON_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    table = os.environ.get("SUPABASE_KEEPALIVE_TABLE", "conversations")

    url = f"{supabase_url}/rest/v1/{table}"
    headers = {
        "apikey": supabase_anon_key,
        "Authorization": f"Bearer {supabase_anon_key}",
    }
    params = {"select": "id", "limit": "1"}

    try:
        response = requests.get(url, headers=headers, params=params, timeout=15)
    except requests.exceptions.RequestException as exc:
        print(f"ERROR: Request to Supabase failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if not response.ok:
        print(
            f"ERROR: Supabase returned HTTP {response.status_code}: {response.text}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(
        f"OK: Supabase keepalive succeeded "
        f"(table={table!r}, status={response.status_code})."
    )


if __name__ == "__main__":
    main()
````

## File: backend/migrate_add_fulltext_search.py
````python
#!/usr/bin/env python
"""
Migration script to add PostgreSQL full-text search support.

Adds a search_vector tsvector column to conversations, triggers to keep it
in sync, and a GIN index for fast search. Replaces ILIKE with proper
full-text search and relevance ranking.

Requires PostgreSQL (Supabase). Safe to run multiple times.
"""

from sqlalchemy import text
from app.database import engine


def migrate_add_fulltext_search() -> None:
    """Add full-text search column, triggers, and index."""
    print("Running migration: Add full-text search support")

    with engine.connect() as conn:
        # 1. Add search_vector column if not exists
        conn.execute(text("""
            ALTER TABLE conversations
            ADD COLUMN IF NOT EXISTS search_vector tsvector
        """))
        conn.commit()
        print("  [OK] Added search_vector column")

    with engine.connect() as conn:
        # 2. Create or replace the function that updates search_vector
        conn.execute(text("""
            CREATE OR REPLACE FUNCTION conversations_update_search_vector()
            RETURNS TRIGGER AS $$
            DECLARE
                conv_title text;
                msg_content text;
            BEGIN
                IF TG_TABLE_NAME = 'conversations' THEN
                    conv_title := COALESCE(NEW.title, '');
                    SELECT COALESCE(string_agg(content, ' '), '')
                    INTO msg_content
                    FROM messages WHERE conversation_id = NEW.id;
                ELSE
                    SELECT COALESCE(c.title, '')
                    INTO conv_title
                    FROM conversations c WHERE c.id = COALESCE(NEW.conversation_id, OLD.conversation_id);
                    SELECT COALESCE(string_agg(content, ' '), '')
                    INTO msg_content
                    FROM messages
                    WHERE conversation_id = COALESCE(NEW.conversation_id, OLD.conversation_id);
                END IF;

                IF TG_TABLE_NAME = 'conversations' THEN
                    UPDATE conversations
                    SET search_vector = (
                        setweight(to_tsvector('english', COALESCE(conv_title, '')), 'A') ||
                        setweight(to_tsvector('english', COALESCE(msg_content, '')), 'B')
                    )
                    WHERE id = NEW.id;
                ELSE
                    UPDATE conversations
                    SET search_vector = (
                        setweight(to_tsvector('english', COALESCE(conv_title, '')), 'A') ||
                        setweight(to_tsvector('english', COALESCE(msg_content, '')), 'B')
                    )
                    WHERE id = COALESCE(NEW.conversation_id, OLD.conversation_id);
                END IF;
                RETURN COALESCE(NEW, OLD);
            END;
            $$ LANGUAGE plpgsql;
        """))
        conn.commit()
        print("  [OK] Created update function")

    with engine.connect() as conn:
        # 3. Drop existing triggers if they exist (for idempotency)
        conn.execute(text("""
            DROP TRIGGER IF EXISTS conversations_search_vector_trigger ON conversations;
            DROP TRIGGER IF EXISTS messages_search_vector_trigger ON messages;
        """))
        conn.commit()

    with engine.connect() as conn:
        # 4. Create triggers
        conn.execute(text("""
            CREATE TRIGGER conversations_search_vector_trigger
            AFTER INSERT OR UPDATE OF title ON conversations
            FOR EACH ROW EXECUTE PROCEDURE conversations_update_search_vector();
        """))
        conn.execute(text("""
            CREATE TRIGGER messages_search_vector_trigger
            AFTER INSERT OR UPDATE OF content OR DELETE ON messages
            FOR EACH ROW EXECUTE PROCEDURE conversations_update_search_vector();
        """))
        conn.commit()
        print("  [OK] Created triggers")

    with engine.connect() as conn:
        # 5. Backfill existing conversations
        conn.execute(text("""
            UPDATE conversations c
            SET search_vector = (
                setweight(to_tsvector('english', COALESCE(c.title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(
                    (SELECT string_agg(m.content, ' ') FROM messages m WHERE m.conversation_id = c.id),
                    ''
                )), 'B')
            )
            WHERE c.search_vector IS NULL OR c.search_vector = ''
        """))
        conn.commit()
        print("  [OK] Backfilled search vectors")

    with engine.connect() as conn:
        # 6. Create GIN index for fast search
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_conversations_search_vector
            ON conversations USING GIN (search_vector)
        """))
        conn.commit()
        print("  [OK] Created GIN index")

    print("[OK] Full-text search migration completed successfully")


if __name__ == "__main__":
    migrate_add_fulltext_search()
````

## File: backend/migrate_add_projects.py
````python
#!/usr/bin/env python
"""
Migration script to add project folder support.

This script:
1. Creates the 'projects' table
2. Adds 'project_id' column to the 'conversations' table
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "chatarchive.db"


def migrate() -> None:
    """Run the migration to add project support."""
    
    if not DB_PATH.exists():
        print("Database not found. Please run init_db.py first.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if projects table already exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
        )
        if cursor.fetchone():
            print("[SKIP] Projects table already exists")
        else:
            # Create projects table
            print("Creating projects table...")
            cursor.execute("""
                CREATE TABLE projects (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    description VARCHAR(500),
                    color VARCHAR(7),
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX ix_projects_id ON projects (id)")
            cursor.execute("CREATE INDEX ix_projects_name ON projects (name)")
            print("[OK] Projects table created")
        
        # Check if project_id column exists in conversations
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if "project_id" in columns:
            print("[SKIP] project_id column already exists in conversations table")
        else:
            # Add project_id column to conversations
            print("Adding project_id column to conversations...")
            cursor.execute("""
                ALTER TABLE conversations
                ADD COLUMN project_id INTEGER
                REFERENCES projects(id) ON DELETE SET NULL
            """)
            
            # Create index on project_id
            cursor.execute("CREATE INDEX ix_conversations_project_id ON conversations (project_id)")
            print("[OK] project_id column added to conversations")
        
        conn.commit()
        print("\n[SUCCESS] Migration completed successfully!")
        print("You can now use project folders to organize your conversations.")
        
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
````

## File: backend/migrate_add_tags.py
````python
#!/usr/bin/env python
"""
Migration script to add tagging support to existing ChatArchive databases.

This script adds the tags, conversation_tags tables to the database schema.
It's safe to run multiple times - it will only create tables if they don't exist.
"""

from sqlalchemy import inspect
from app.database import engine
from app.models import Base, Tag, ConversationTag


def migrate_add_tags() -> None:
    """Add tagging tables to the database."""
    print("Running migration: Add tagging support")
    
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    # Check if tags table already exists
    if "tags" in existing_tables and "conversation_tags" in existing_tables:
        print("[OK] Tagging tables already exist - no migration needed")
        return
    
    # Create only the new tables
    print("Creating tagging tables...")
    
    # Create tags table
    if "tags" not in existing_tables:
        Tag.__table__.create(bind=engine)
        print("  [OK] Created 'tags' table")
    
    # Create conversation_tags table
    if "conversation_tags" not in existing_tables:
        ConversationTag.__table__.create(bind=engine)
        print("  [OK] Created 'conversation_tags' table")
    
    print("[OK] Migration completed successfully")


if __name__ == "__main__":
    migrate_add_tags()
````

## File: backend/migrate_import_history.py
````python
#!/usr/bin/env python
"""Add import_history_id column to conversations table."""

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "chatarchive.db"


def migrate():
    """Add the missing import_history_id column."""
    print(f"Migrating database at {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'import_history_id' in columns:
            print("[INFO] Column import_history_id already exists, skipping migration")
            return

        print("[INFO] Adding import_history_id column to conversations table...")

        # Add the new column (nullable, with index)
        cursor.execute("""
            ALTER TABLE conversations
            ADD COLUMN import_history_id INTEGER
            REFERENCES import_history(id) ON DELETE SET NULL
        """)

        # Create index for the new column
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_conversations_import_history_id
            ON conversations(import_history_id)
        """)

        conn.commit()
        print("[OK] Migration completed successfully!")
        print("     - Added import_history_id column")
        print("     - Created index on import_history_id")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
````

## File: backend/migrate_to_supabase.py
````python
#!/usr/bin/env python3
"""
Migration script to migrate data from local SQLite to Supabase PostgreSQL.

This script reads all conversations, messages, tags, projects, and import history
from the local SQLite database and inserts them into the Supabase PostgreSQL database.

Usage:
    python migrate_to_supabase.py

Prerequisites:
    - Supabase environment variables must be configured in backend/.env
    - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
    - Supabase PostgreSQL database must have the schema already created
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

from app.models import Base, Conversation, Message, Tag, ConversationTag, Project, ImportHistory, ImportSettings

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def create_sqlite_engine():
    """Create SQLite engine for source database."""
    BASE_DIR = Path(__file__).parent
    DB_PATH = BASE_DIR / "chatarchive.db"
    
    if not DB_PATH.exists():
        print(f"❌ Error: SQLite database not found at {DB_PATH}")
        sys.exit(1)
    
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    return create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )


def create_postgresql_engine():
    """Create PostgreSQL engine for Supabase destination database."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)
    
    try:
        # Extract project reference from Supabase URL
        project_ref = SUPABASE_URL.replace("https://", "").replace("http://", "").split(".")[0]
        
        # Get database password (defaults to service role key if not specified)
        db_password = os.getenv("SUPABASE_DB_PASSWORD", SUPABASE_SERVICE_ROLE_KEY)
        
        # Construct PostgreSQL connection URL
        DATABASE_URL = f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
        
        return create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20
        )
    except Exception as e:
        print(f"❌ Error creating PostgreSQL connection: {e}")
        sys.exit(1)


def migrate_data():
    """Migrate all data from SQLite to PostgreSQL."""
    print("🚀 Starting migration from SQLite to Supabase PostgreSQL...\n")
    
    # Create engines
    sqlite_engine = create_sqlite_engine()
    postgres_engine = create_postgresql_engine()
    
    # Create sessions
    SQLiteSession = sessionmaker(bind=sqlite_engine)
    PostgresSession = sessionmaker(bind=postgres_engine)
    
    sqlite_db = SQLiteSession()
    postgres_db = PostgresSession()
    
    try:
        # Create all tables in PostgreSQL if they don't exist
        print("📋 Creating tables in PostgreSQL...")
        Base.metadata.create_all(postgres_engine)
        print("✅ Tables created\n")
        
        # Migrate Tags first (no dependencies)
        print("🏷️  Migrating Tags...")
        tags = sqlite_db.query(Tag).all()
        tag_count = 0
        for tag in tags:
            # Check if tag already exists
            existing = postgres_db.query(Tag).filter(Tag.name == tag.name).first()
            if not existing:
                new_tag = Tag(
                    id=tag.id,
                    name=tag.name,
                    description=tag.description,
                    color=tag.color,
                    created_at=tag.created_at,
                )
                postgres_db.add(new_tag)
                tag_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {tag_count} tags\n")
        
        # Migrate Projects (no dependencies)
        print("📁 Migrating Projects...")
        projects = sqlite_db.query(Project).all()
        project_count = 0
        for project in projects:
            # Check if project already exists
            existing = postgres_db.query(Project).filter(Project.name == project.name).first()
            if not existing:
                new_project = Project(
                    id=project.id,
                    name=project.name,
                    description=project.description,
                    color=project.color,
                    created_at=project.created_at,
                )
                postgres_db.add(new_project)
                project_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {project_count} projects\n")
        
        # Migrate Import History (no dependencies)
        print("📜 Migrating Import History...")
        import_history = sqlite_db.query(ImportHistory).all()
        history_count = 0
        for history in import_history:
            existing = postgres_db.query(ImportHistory).filter(ImportHistory.id == history.id).first()
            if not existing:
                new_history = ImportHistory(
                    id=history.id,
                    filename=history.filename,
                    source_location=history.source_location,
                    source_type=history.source_type,
                    file_format=history.file_format,
                    status=history.status,
                    created_at=history.created_at,
                    imported_count=history.imported_count,
                    error_message=history.error_message,
                )
                postgres_db.add(new_history)
                history_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {history_count} import history records\n")
        
        # Migrate Import Settings
        print("⚙️  Migrating Import Settings...")
        settings = sqlite_db.query(ImportSettings).first()
        if settings:
            existing = postgres_db.query(ImportSettings).first()
            if not existing:
                new_settings = ImportSettings(
                    id=settings.id,
                    allowed_formats=settings.allowed_formats,
                    default_format=settings.default_format,
                    auto_merge_duplicates=settings.auto_merge_duplicates,
                    keep_separate=settings.keep_separate,
                    skip_empty_conversations=settings.skip_empty_conversations,
                    updated_at=settings.updated_at,
                )
                postgres_db.add(new_settings)
                postgres_db.commit()
                print("✅ Migrated import settings\n")
            else:
                print("ℹ️  Import settings already exist in PostgreSQL\n")
        else:
            print("ℹ️  No import settings to migrate\n")
        
        # Migrate Conversations (depends on Projects and ImportHistory)
        print("💬 Migrating Conversations...")
        conversations = sqlite_db.query(Conversation).all()
        conversation_count = 0
        for conv in conversations:
            # Check if conversation already exists
            existing = postgres_db.query(Conversation).filter(
                Conversation.source == conv.source,
                Conversation.source_id == conv.source_id
            ).first()
            
            if not existing:
                new_conv = Conversation(
                    id=conv.id,
                    source=conv.source,
                    source_id=conv.source_id,
                    title=conv.title,
                    created_at=conv.created_at,
                    updated_at=conv.updated_at,
                    message_count=conv.message_count,
                    raw_json=conv.raw_json,
                    import_history_id=conv.import_history_id,
                    project_id=conv.project_id,
                )
                postgres_db.add(new_conv)
                conversation_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {conversation_count} conversations\n")
        
        # Migrate Messages (depends on Conversations)
        print("💭 Migrating Messages...")
        messages = sqlite_db.query(Message).all()
        message_count = 0
        for msg in messages:
            # Check if conversation exists in PostgreSQL
            conv_exists = postgres_db.query(Conversation).filter(
                Conversation.id == msg.conversation_id
            ).first()
            
            if conv_exists:
                # Check if message already exists
                existing = postgres_db.query(Message).filter(Message.id == msg.id).first()
                if not existing:
                    new_msg = Message(
                        id=msg.id,
                        conversation_id=msg.conversation_id,
                        source_id=msg.source_id,
                        role=msg.role,
                        content=msg.content,
                        content_type=msg.content_type,
                        created_at=msg.created_at,
                        order_index=msg.order_index,
                        model=msg.model,
                    )
                    postgres_db.add(new_msg)
                    message_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {message_count} messages\n")
        
        # Migrate ConversationTags (depends on Conversations and Tags)
        print("🔗 Migrating Conversation-Tag relationships...")
        conversation_tags = sqlite_db.query(ConversationTag).all()
        ct_count = 0
        for ct in conversation_tags:
            # Check if both conversation and tag exist in PostgreSQL
            conv_exists = postgres_db.query(Conversation).filter(
                Conversation.id == ct.conversation_id
            ).first()
            tag_exists = postgres_db.query(Tag).filter(Tag.id == ct.tag_id).first()
            
            if conv_exists and tag_exists:
                # Check if relationship already exists
                existing = postgres_db.query(ConversationTag).filter(
                    ConversationTag.conversation_id == ct.conversation_id,
                    ConversationTag.tag_id == ct.tag_id,
                ).first()
                
                if not existing:
                    new_ct = ConversationTag(
                        conversation_id=ct.conversation_id,
                        tag_id=ct.tag_id,
                        created_at=ct.created_at,
                        auto_tagged=ct.auto_tagged,
                    )
                    postgres_db.add(new_ct)
                    ct_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {ct_count} conversation-tag relationships\n")
        
        # Print summary
        print("=" * 50)
        print("✨ Migration completed successfully!")
        print("=" * 50)
        print(f"Tags: {tag_count}")
        print(f"Projects: {project_count}")
        print(f"Import History: {history_count}")
        print(f"Conversations: {conversation_count}")
        print(f"Messages: {message_count}")
        print(f"Tag Relationships: {ct_count}")
        print("=" * 50)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        postgres_db.rollback()
        raise
    finally:
        sqlite_db.close()
        postgres_db.close()


if __name__ == "__main__":
    migrate_data()
````

## File: backend/test_import.py
````python
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
````

## File: docs/BROWSER_EXTENSION_IMPLEMENTATION_PLAN.md
````markdown
# Browser Extension Implementation Plan

## Purpose and Scope

This document outlines a concrete plan to build a browser extension that automatically captures and archives AI-assistant conversations from supported chat sites (ChatGPT, Claude, GitHub Copilot, Gemini) directly into the ChatArchive backend — without requiring manual export/import.

The extension targets the same conversation data model already used by the existing import pipeline (`source`, `source_id`, `title`, `messages`) so no breaking schema changes are needed.

---

## MVP Goals

1. Auto-detect when a conversation ends or is navigated away from on a supported site.
2. Extract the conversation (title, messages, source ID) via a content script.
3. Send the payload to the running local ChatArchive backend over `http://localhost:8000`.
4. Deduplicate against already-archived conversations using `source_id`.
5. Show a minimal popup indicating archive status (success / queued / error).

Out-of-scope for MVP:
- Cloud/remote backend support (localhost only)
- Semantic tagging from the extension (tagging runs server-side on ingest)
- Firefox support (Chrome/Chromium first)

---

## Proposed Extension Architecture (Manifest v3)

```
extension/
├── manifest.json            # MV3 manifest
├── background/
│   └── worker.js            # Service worker – queue, retry, send to API
├── content/
│   ├── adapters/
│   │   ├── chatgpt.js       # ChatGPT DOM adapter
│   │   ├── claude.js        # Claude DOM adapter
│   │   ├── copilot.js       # GitHub Copilot adapter
│   │   └── gemini.js        # Gemini adapter
│   └── content.js           # Shared content-script bootstrap
├── popup/
│   ├── popup.html
│   └── popup.js
├── options/
│   ├── options.html
│   └── options.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Key Components

| Component | Role |
|---|---|
| `manifest.json` | Declares permissions, host patterns, and scripts |
| `content.js` | Injected into matching pages; selects and runs the correct site adapter |
| `adapters/<site>.js` | Site-specific DOM scraping logic returning a normalized payload |
| `background/worker.js` | Receives messages from content scripts, manages the send queue, retries on failure |
| `popup/` | Simple status UI – last archived conversation, queue depth, error indicator |
| `options/` | User-configurable backend URL, pause/resume toggle, per-site enable/disable |

### `manifest.json` skeleton

```json
{
  "manifest_version": 3,
  "name": "ChatArchive",
  "version": "0.1.0",
  "description": "Auto-archive AI conversations to your local ChatArchive instance.",
  "permissions": ["storage", "alarms"],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://github.com/copilot/*",
    "https://gemini.google.com/*",
    "http://localhost:8000/*"
  ],
  "background": { "service_worker": "background/worker.js" },
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://github.com/copilot/*",
        "https://gemini.google.com/*"
      ],
      "js": ["content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": { "default_popup": "popup/popup.html" }
}
```

---

## Backend Integration Points and API Contract

### New endpoint: `POST /import/extension`

The extension sends a single conversation payload. This endpoint mirrors the existing import logic but accepts JSON instead of a file upload.

**Request body:**

```json
{
  "source": "chatgpt",
  "source_id": "abc123",
  "title": "Python help",
  "created_at": "2024-06-01T12:00:00Z",
  "updated_at": "2024-06-01T12:30:00Z",
  "messages": [
    {
      "role": "user",
      "content": "How do I reverse a list in Python?",
      "timestamp": "2024-06-01T12:00:05Z"
    },
    {
      "role": "assistant",
      "content": "You can use `my_list[::-1]` or `list.reverse()`.",
      "timestamp": "2024-06-01T12:00:10Z"
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "id": 42,
  "source": "chatgpt",
  "source_id": "abc123",
  "title": "Python help",
  "created_at": "2024-06-01T12:00:00",
  "updated_at": "2024-06-01T12:30:00",
  "message_count": 2,
  "action": "created"
}
```

`action` is `"created"` for new conversations or `"updated"` when the same `source_id` already exists and the incoming payload has a newer `updated_at`.

**Response (200 OK – duplicate, no-op):**

```json
{
  "id": 42,
  "action": "no_change"
}
```

**Authentication header (when token is configured):**

```
X-ChatArchive-Token: <extension-token>
```

---

## Data Normalization Strategy

The extension payload maps directly to the existing `Conversation` / `Message` schema:

| Extension field | DB column | Notes |
|---|---|---|
| `source` | `conversations.source` | Lowercase site name |
| `source_id` | `conversations.source_id` | Site's own conversation ID |
| `title` | `conversations.title` | Scraped from page `<h1>` / conversation header |
| `created_at` | `conversations.created_at` | ISO-8601 UTC |
| `updated_at` | `conversations.updated_at` | ISO-8601 UTC |
| `messages[].role` | `messages.role` | `"user"` or `"assistant"` |
| `messages[].content` | `messages.content` | Plain text or markdown |
| `messages[].timestamp` | `messages.timestamp` | Optional; null if not available |

Server-side auto-tagging runs after ingest using the existing `TaggerEngine`, identical to the file-import flow.

---

## Site Adapter Strategy

Each adapter is a small ES module that implements a single function:

```js
// adapters/chatgpt.js
export function scrape() {
  const sourceId = window.location.pathname.split('/c/')[1]?.split('/')[0];
  if (!sourceId) return null;

  const title = document.querySelector('h1')?.innerText?.trim() ?? 'Untitled';
  const turns = [...document.querySelectorAll('[data-message-author-role]')];
  const messages = turns.map(el => ({
    role: el.dataset.messageAuthorRole,   // 'user' | 'assistant'
    content: el.innerText.trim(),
    timestamp: el.dataset.messageCreatedAt ?? null,
  }));

  return { source: 'chatgpt', source_id: sourceId, title, messages };
}
```

| Site | Source ID strategy | Message selector hint |
|---|---|---|
| ChatGPT | URL path `/c/<id>` | `[data-message-author-role]` |
| Claude | URL path `/chat/<uuid>` | `.human-turn`, `.ai-turn` |
| GitHub Copilot | URL fragment or session token | `.user-message`, `.assistant-message` |
| Gemini | URL param `?bard=<id>` | `[data-conversation-id]` turns |

Adapters use DOM selectors and must tolerate site redesigns gracefully (return `null` on failure so the worker skips silently).

---

## Reliability Strategy

### Send Queue

The background worker maintains a persistent queue in `chrome.storage.local`:

```
queue: [
  { id: "<uuid>", payload: {...}, attempts: 0, nextRetry: <timestamp> },
  ...
]
```

1. Content script sends `{ type: "ARCHIVE", payload }` to the worker.
2. Worker appends to queue and attempts immediate send.
3. On success: item removed from queue.
4. On failure (network error, 5xx): `attempts++`; exponential back-off (5 s, 30 s, 5 min, 30 min, drop after 5 attempts).
5. `chrome.alarms` ticks every 60 seconds to drain the queue.

### Idempotency / Dedup

The server deduplicates by `(source, source_id)`. Sending the same conversation twice is safe and results in `action: "no_change"`. The worker clears the item from the queue on any 2xx response.

---

## Security and Auth Considerations

| Concern | Approach |
|---|---|
| Unauthenticated access | Optional `X-ChatArchive-Token` header; server checks against a hashed token stored in `.env` (`EXTENSION_API_TOKEN`). Disabled by default for localhost-only setups. |
| CORS | Backend adds `chrome-extension://*` to `allow_origins` when the token feature is enabled. |
| Rate limiting | Server enforces `MAX_EXTENSION_RPM=60` (configurable). Requests beyond the limit receive `429`. Worker backs off for 60 s on `429`. |
| Data in transit | HTTPS is used when the backend is deployed remotely; localhost is HTTP only (acceptable for local use). |
| Sensitive content | The extension never transmits data to any third party — only to the user's own configured backend URL. |
| Manifest permissions | Only the minimum required `host_permissions` are declared; no `<all_urls>`. |

---

## Testing Strategy

### Unit tests (Jest / Vitest)

- Adapter scrape functions: mock `document` via `jsdom`; assert normalized payload shape.
- Queue logic: mock `chrome.storage.local`; assert retry back-off intervals.

### Integration tests (Playwright or WebdriverIO)

- Load a static HTML snapshot of each supported site.
- Load the unpacked extension.
- Assert that a conversation payload reaches the mock backend server.

### Backend tests (pytest – extending existing test suite)

- `POST /import/extension` with valid payload → 201 + correct DB row.
- Duplicate `source_id` → 200 + `action: "no_change"`.
- Invalid payload (missing `source`) → 422.
- Token mismatch → 401.

### Manual smoke tests

- Install unpacked extension in Chrome.
- Open a ChatGPT/Claude conversation.
- Navigate away; verify the conversation appears in ChatArchive UI.

---

## Phased Milestone Plan

### Milestone 1 – Backend endpoint (1 week)
- Implement `POST /import/extension` in `backend/app/main.py`.
- Add request schema to `backend/app/schemas.py`.
- Write pytest tests for the new endpoint.
- Document endpoint in `docs/API.md`.

### Milestone 2 – Extension scaffold + ChatGPT adapter (1 week)
- Create the `extension/` directory with MV3 manifest, background worker skeleton, and popup.
- Implement `adapters/chatgpt.js`.
- Manual smoke-test against local ChatArchive.

### Milestone 3 – Claude and Gemini adapters (1 week)
- Implement `adapters/claude.js` and `adapters/gemini.js`.
- Write jsdom-based unit tests for both adapters.

### Milestone 4 – GitHub Copilot adapter + queue/retry (1 week)
- Implement `adapters/copilot.js`.
- Implement persistent send queue with exponential back-off in `background/worker.js`.
- Add `chrome.alarms`-based queue drain.

### Milestone 5 – Auth, options UI, and packaging (1 week)
- Add `X-ChatArchive-Token` support (optional; backend + extension).
- Build options page (backend URL, per-site toggles, token input).
- Add CORS update for extension origin.
- Package as a `.zip` for Chrome Web Store submission.

### Milestone 6 – End-to-end tests and documentation (1 week)
- Playwright E2E tests for each site adapter.
- Update `README.md` and `docs/` with extension install and configuration instructions.
- Final code review and release tag.

---

## Definition of Done for MVP

- [ ] `POST /import/extension` endpoint is live and returns correct responses for create, update, and no-change cases.
- [ ] ChatGPT, Claude, Gemini, and GitHub Copilot adapters successfully extract conversations in manual testing.
- [ ] Background worker persists queue to `chrome.storage.local` and retries on failure.
- [ ] Duplicate conversations are deduplicated by `source_id` without error.
- [ ] Popup shows last-archived conversation and any queue errors.
- [ ] All new pytest and Jest tests pass in CI.
- [ ] `docs/API.md` documents the new endpoint.
- [ ] Extension has been loaded as an unpacked extension and archived at least 5 real conversations end-to-end.
````

## File: docs/DEVELOPMENT.md
````markdown
# Development Setup

## Backend
1. Install dependencies with `uv`:
   ```bash
   cd backend
   uv sync
   ```
2. Initialize the database:
   ```bash
   uv run python init_db.py
   ```
3. Run the API:
   ```bash
   uv run python -m app.main
   ```

## Frontend
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```

The frontend expects the API at `http://localhost:8000`.

## One-command local run

From the repo root:

```bash
./run-chatarchive.sh
```

This script:
- runs `uv sync` in `backend/`
- runs `npm install` in `frontend/` if needed
- starts both dev servers together
````

## File: docs/TAGGING.md
````markdown
# Tag-Based Conversation Categorization

## Overview

ChatArchive now includes an intelligent tag-based system to automatically categorize and organize your LLM conversations by topic. This feature helps you quickly find conversations based on their content and purpose.

## Features

### Automatic Tagging

The system uses a deterministic keyword-based classification engine that analyzes:
- **Conversation titles** (3 points per match)
- **Message content** (1 point per match, up to 5 matches)

A conversation is tagged if it scores at least 2 points for a particular category.

### Predefined Categories

The system includes 9 predefined categories with carefully curated keyword patterns:

1. **coding** 🔵
   - Programming, development, and technical topics
   - Keywords: python, javascript, code, git, api, debugging, etc.
   - Color: Blue (#3B82F6)

2. **education** 🟢
   - Academic topics, assignments, and learning
   - Keywords: assignment, homework, essay, study, exam, university, etc.
   - Color: Green (#10B981)

3. **writing** 🟣
   - Creative writing, content creation, and documentation
   - Keywords: write, story, article, blog, documentation, etc.
   - Color: Purple (#8B5CF6)

4. **productivity** 🟡
   - Task management, planning, and organization
   - Keywords: todo, schedule, plan, organize, workflow, etc.
   - Color: Amber (#F59E0B)

5. **business** 🔴
   - Business, finance, and professional topics
   - Keywords: business, company, startup, marketing, finance, etc.
   - Color: Red (#EF4444)

6. **data-science** 🔵
   - Data analysis, machine learning, and AI
   - Keywords: machine learning, data analysis, pandas, neural network, etc.
   - Color: Cyan (#06B6D4)

7. **tech-support** 🩷
   - Technical support, troubleshooting, and how-to
   - Keywords: how to, help, issue, problem, fix, troubleshoot, etc.
   - Color: Pink (#EC4899)

8. **creative** 🟠
   - Creative projects, design, and art
   - Keywords: design, ui, ux, art, creative, mockup, etc.
   - Color: Orange (#F97316)

9. **personal** ⚫
   - Personal topics and general conversation
   - Keywords: personal, life, advice, hobby, entertainment, etc.
   - Color: Gray (#6B7280)

## How It Works

### Classification Algorithm

The tagging engine uses a scoring system:

1. **Title Analysis**: Each keyword match in the title scores 3 points
2. **Content Analysis**: Each keyword match in user messages scores 1 point (max 5)
3. **Threshold**: A minimum score of 2 is required to assign a tag
4. **Limit**: Maximum of 3 tags per conversation

### Word Boundary Matching

The system uses regex word boundaries to ensure accurate matching:
- ✅ "class" matches "Python class"
- ❌ "class" does NOT match "classical music"
- ✅ Case-insensitive matching

### Multi-Tag Support

Conversations can have multiple tags. For example:
- "Web development assignment" → `coding`, `education`
- "Machine learning with Python" → `data-science`, `coding`

## Usage

### Auto-Tag All Conversations

Click the "Auto-Tag All" button in the sidebar to automatically tag all conversations based on their content.

```bash
POST /conversations/auto-tag
{
  "conversation_ids": [1, 2, 3],  // Optional: specific IDs
  "overwrite_existing": false     // Don't overwrite manual tags
}
```

### Filter by Tag

Use the tag dropdown in the sidebar to filter conversations by a specific tag.

```bash
GET /conversations?tag=coding
```

### Manual Tag Management

- **Add Tag**: Click on a conversation and use the tag menu
- **Remove Tag**: Click the × button on a tag badge in the conversation detail view

### API Endpoints

```bash
# List all tags with usage counts
GET /tags

# Create a custom tag
POST /tags
{
  "name": "my-custom-tag",
  "description": "My custom category",
  "color": "#FF5733"
}

# Add tag to conversation
POST /conversations/{id}/tags
{
  "tag_name": "coding",
  "auto_tagged": false
}

# Remove tag from conversation
DELETE /conversations/{id}/tags/{tag_id}
```

## Implementation Details

### Database Schema

**tags table:**
- `id`: Primary key
- `name`: Unique tag name
- `description`: Optional description
- `color`: Hex color code for UI display
- `created_at`: Timestamp

**conversation_tags table** (join table):
- `conversation_id`: Foreign key to conversations
- `tag_id`: Foreign key to tags
- `created_at`: Timestamp
- `auto_tagged`: Boolean flag (true for auto-assigned, false for manual)

### Testing

The system includes comprehensive tests:
- 16 unit tests for the tagging engine
- Classification accuracy tests
- Keyword matching tests
- Edge case handling

Run tests:
```bash
cd backend
pytest tests/test_tagger.py -v
```

## Customization

### Adding Custom Keywords

Edit `backend/app/tagger.py` to add keywords to existing categories:

```python
"coding": {
    "keywords": [
        # Add your custom keywords here
        "your-language", "your-framework",
    ]
}
```

### Creating New Categories

Add a new category to the `TAG_PATTERNS` dictionary:

```python
"your-category": {
    "description": "Description of your category",
    "color": "#HEXCOLOR",
    "keywords": ["keyword1", "keyword2", ...]
}
```

## Performance

- **Fast**: O(n) complexity where n is the number of keywords
- **Efficient**: Only analyzes first 10 messages per conversation
- **Scalable**: Handles thousands of conversations efficiently

## Limitations

1. **Language**: Currently optimized for English keywords
2. **Context**: Based on keywords, not semantic understanding
3. **Manual Override**: Some conversations may need manual tag adjustment

## Future Enhancements

Potential improvements:
- Semantic search using embeddings
- Multi-language support
- Custom tag creation from UI
- Tag hierarchies and subcategories
- Batch manual tagging
- Export conversations by tag

## Migration

If upgrading from a previous version:

```bash
cd backend
python migrate_add_tags.py
```

This creates the `tags` and `conversation_tags` tables without affecting existing data.

## Troubleshooting

**Tags not showing?**
- Ensure migration has been run
- Check that auto-tagging completed successfully
- Verify backend is running on port 8000

**Wrong tags assigned?**
- Tags are deterministic based on keywords
- Check the keyword patterns in `tagger.py`
- Use manual tag management to adjust

**Performance issues?**
- The system limits content analysis to first 10 messages
- Tags are cached in the database
- Consider indexing for large datasets

## Contributing

To improve the tagging system:
1. Add more keywords to existing categories
2. Suggest new categories
3. Improve classification algorithm
4. Add semantic understanding

See the main CONTRIBUTING.md for details.
````

## File: frontend/public/favicon.svg
````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <linearGradient id="sparkle-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2f81f7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4493ff;stop-opacity:1" />
    </linearGradient>
  </defs>
  <path d="M12 3l1.912 5.813 6.088.281-4.829 3.693 1.724 5.926L12 15.187l-4.895 3.526 1.724-5.926-4.829-3.693 6.088-.281L12 3z" fill="url(#sparkle-gradient)"/>
  <circle cx="12" cy="12" r="1.5" fill="#fff"/>
  <line x1="12" y1="2" x2="12" y2="5" stroke="url(#sparkle-gradient)" stroke-width="2"/>
  <line x1="12" y1="19" x2="12" y2="22" stroke="url(#sparkle-gradient)" stroke-width="2"/>
  <line x1="2" y1="12" x2="5" y2="12" stroke="url(#sparkle-gradient)" stroke-width="2"/>
  <line x1="19" y1="12" x2="22" y2="12" stroke="url(#sparkle-gradient)" stroke-width="2"/>
</svg>
````

## File: frontend/src/components/ModalShell.tsx
````typescript
import { ReactNode, useEffect, useId, useRef } from "react";

type ModalShellProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  actions?: ReactNode;
  headerActions?: ReactNode;
};

export default function ModalShell({
  title,
  onClose,
  children,
  className = "",
  bodyClassName = "",
  actions,
  headerActions,
}: ModalShellProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <div className="modal-header-actions">
            {headerActions}
            <button
              ref={closeButtonRef}
              type="button"
              className="close-btn"
              aria-label={`Close ${title}`}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>

        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
````

## File: frontend/src/test/setup.ts
````typescript
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
````

## File: frontend/src/App.test.tsx
````typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

type FetchMockOptions = {
  duplicatesError?: boolean;
};

const baseConversation = {
  id: 1,
  source: "chatgpt",
  title: "Refactor search filters",
  created_at: "2026-03-18T12:00:00Z",
  updated_at: "2026-03-18T12:30:00Z",
  message_count: 4,
  word_count: 420,
  last_message_preview: "Let us tighten the archive search flow.",
  tags: [
    {
      id: 1,
      name: "coding",
      description: "Programming work",
      color: "#3B82F6",
      created_at: "2026-03-18T12:00:00Z",
      conversation_count: 1,
    },
  ],
  project: {
    id: 1,
    name: "Archive polish",
    description: "Frontend cleanup",
    color: "#8B5CF6",
    created_at: "2026-03-18T12:00:00Z",
    conversation_count: 1,
  },
};

function jsonResponse(data: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => data,
  } as Response;
}

function installFetchMock(options: FetchMockOptions = {}) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/settings/supabase-dashboard-url")) {
      return jsonResponse({ configured: false, dashboard_url: null });
    }

    if (url.includes("/tags")) {
      return jsonResponse({
        items: baseConversation.tags,
        total: baseConversation.tags.length,
      });
    }

    if (url.includes("/projects")) {
      return jsonResponse({
        items: [baseConversation.project],
        total: 1,
      });
    }

    if (url.includes("/conversations/duplicates")) {
      if (options.duplicatesError) {
        return jsonResponse({ detail: "scan failed" }, { ok: false, status: 500 });
      }
      return jsonResponse({
        groups: [],
        total_duplicates: 0,
        total_groups: 0,
        strategy: "source_id",
      });
    }

    if (url.includes("/conversations/search")) {
      return jsonResponse({
        items: [baseConversation],
        total: 1,
        page: 1,
        page_size: 100,
        pages: 1,
      });
    }

    if (url.includes("/conversations?")) {
      return jsonResponse({
        items: [baseConversation],
        total: 1,
        page: 1,
        page_size: 100,
        pages: 1,
      });
    }

    if (url.includes("/conversations/1")) {
      return jsonResponse({
        ...baseConversation,
        messages: [
          {
            id: 10,
            conversation_id: 1,
            role: "user",
            content: "How should we improve the UI?",
            content_type: "text",
            created_at: "2026-03-18T12:00:00Z",
            order_index: 0,
            source_id: "m1",
          },
        ],
      });
    }

    throw new Error(`Unhandled fetch URL: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("App UI improvements", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installFetchMock();
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("open", vi.fn());
  });

  it("opens the project manager with dialog semantics", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /manage projects/i }));

    expect(await screen.findByRole("dialog", { name: /manage projects/i })).toBeInTheDocument();
  });

  it("closes the duplicates modal when Escape is pressed", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /duplicates/i }));
    await screen.findByText(/find duplicate conversations/i);

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText(/find duplicate conversations/i)).not.toBeInTheDocument();
    });
  });

  it("includes tag and project filters in search requests", async () => {
    const fetchMock = installFetchMock();
    render(<App />);

    fireEvent.change(await screen.findByLabelText(/filter by tag/i), {
      target: { value: "coding" },
    });
    fireEvent.change(screen.getByLabelText(/filter by project/i), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText(/search conversations/i), {
      target: { value: "refactor" },
    });

    await waitFor(() => {
      const searchRequest = fetchMock.mock.calls
        .map(([url]) => String(url))
        .find((url) => url.includes("/conversations/search?") && url.includes("q=refactor"));

      expect(searchRequest).toBeDefined();
      expect(searchRequest).toContain("tag=coding");
      expect(searchRequest).toContain("project_id=1");
    });
  });

  it("renders each sidebar conversation as a keyboard-focusable control", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/refactor search filters/i)).toHaveLength(2);
    });

    expect(screen.getAllByRole("button", { name: /refactor search filters/i })).toHaveLength(2);
  });

  it("shows an explicit error state when duplicate loading fails", async () => {
    installFetchMock({ duplicatesError: true });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /duplicates/i }));

    expect(await screen.findByText(/couldn't load duplicate scan/i)).toBeInTheDocument();
    expect(screen.queryByText(/no duplicate conversations found/i)).not.toBeInTheDocument();
  });
});
````

## File: frontend/index.html
````html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="A powerful, self-hosted tool to organize, search, and manage your LLM conversation history" />
    <title>ChatArchive</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

## File: frontend/vite.config.ts
````typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
  server: {
    port: 5173
  }
});
````

## File: scripts/dev.ps1
````powershell
$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

$pythonCmd = "python"
if (-not (Get-Command $pythonCmd -ErrorAction SilentlyContinue)) {
  if (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
  } else {
    Write-Error "Python not found. Install Python 3.10+ or ensure python/py is in PATH."
    exit 1
  }
}

if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
  Write-Error "npm not found. Install Node.js 18+ and ensure npm is in PATH."
  exit 1
}

Write-Host "Starting backend..."
$backend = Start-Process -FilePath $pythonCmd -ArgumentList "-m", "app.main" -WorkingDirectory $backendDir -NoNewWindow -PassThru

Write-Host "Starting frontend..."
$frontend = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -NoNewWindow -PassThru

try {
  Wait-Process -Id $backend.Id, $frontend.Id
} finally {
  if ($backend -and -not $backend.HasExited) {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
  }
  if ($frontend -and -not $frontend.HasExited) {
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
  }
}
````

## File: .codex
````

````

## File: ChatArchive.desktop
````
[Desktop Entry]
Version=1.0
Type=Application
Name=ChatArchive
Comment=Start the ChatArchive backend and frontend dev servers
Exec=/home/jimjamscozz/Desktop/GitHub-Repos/ChatArchive/run-chatarchive.sh
Path=/home/jimjamscozz/Desktop/GitHub-Repos/ChatArchive
Terminal=true
Categories=Development;
````

## File: CLAUDE.md
````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Start backend (from repo root)
cd backend && python -m app.main

# Start frontend (from repo root)
cd frontend && npm run dev

# Start both with a single script
./scripts/dev.sh          # Unix
.\scripts\dev.ps1         # Windows PowerShell
```

- Backend runs on `http://localhost:8000`
- Frontend dev server runs on `http://localhost:5173`

### Tests

```bash
cd backend
python -m pytest tests/ -v                              # All tests
python -m pytest tests/test_chatgpt_parser.py -v       # Single test file
python -m pytest tests/test_claude_parser.py::TestName  # Single test
python -m pytest tests/ --cov=app/importers            # With coverage
python verify_parsers.py                               # End-to-end parser verification
```

### Frontend Build

```bash
cd frontend
npm install
npm run build    # TypeScript compile + Vite bundle → frontend/dist/
```

### Production Build (Windows EXE)

```bash
.\build.ps1     # Creates dist/ChatArchive/ChatArchive.exe via PyInstaller
```

## Architecture

### Overview

Full-stack app: **React + TypeScript** frontend, **FastAPI** backend, **Supabase PostgreSQL** database (required — no SQLite fallback).

### Backend (`backend/app/`)

- **`main.py`** — FastAPI entry point. Defines all REST API routes (conversations, messages, tags, projects, search, import, export). Starts uvicorn on port 8000. In PyInstaller mode, redirects stdout/stderr to a log file.
- **`database.py`** — SQLAlchemy engine/session setup. Reads `DATABASE_URL` env var (Supabase PostgreSQL).
- **`models.py`** — SQLAlchemy ORM: `Conversation`, `Message`, `Tag`, `ConversationTag`, `ImportHistory`, `ImportSettings`, `Project`.
- **`schemas.py`** — Pydantic v2 schemas for request/response validation.
- **`tagger.py`** — Keyword-based auto-tagger with 9 categories: `coding`, `education`, `writing`, `business`, `data-science`, `tech-support`, `creative`, `productivity`, `personal`.
- **`storage.py`** — Supabase Storage integration for raw export file uploads.
- **`importers/`** — One file per LLM source (`chatgpt.py`, `claude.py`, `copilot.py`, `gemini.py`). Each exposes a `parse()` function that normalizes export JSON into the internal schema.
- **`preprocessing/pipeline.py`** — Multi-step pipeline (clean → classify → deduplicate → extract → count tokens) run on imported conversations.

### Frontend (`frontend/src/`)

- **`App.tsx`** — Single large component (~127KB) containing all UI logic: conversation list, message viewer, import modal, tag filter, project folder management, search, analytics dashboard, and export.
- **`main.tsx`** — React 18 mount point.
- **`styles.css`** — Tailwind CSS base styles.

The frontend communicates exclusively with the FastAPI backend at `http://localhost:8000`. There is no direct Supabase client call from the frontend.

### Database Schema

Key relationships:
- `conversations` → many `messages` (ordered by `order_index`)
- `conversations` → many `tags` (via `conversation_tags` junction)
- `conversations` → optional `project_id` FK to `projects`
- `conversations` → optional `import_history_id` FK to `import_history`

Full-text search uses a PostgreSQL `tsvector` column with a GIN index, with an ILIKE fallback.

### Adding a New Importer

1. Create `backend/app/importers/<source>.py` with a `parse(data: dict) -> list[ConversationCreate]` function.
2. Register it in `backend/app/main.py` in the import endpoint dispatch logic.
3. Add tests in `backend/tests/test_<source>_parser.py`.

### Environment Variables

Required in `backend/.env`:
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<anon key>
DATABASE_URL=postgresql+psycopg2://postgres:<password>@db.<project>.supabase.co:5432/postgres
```

### PyInstaller / Production Build

`chatarchive.spec` bundles the FastAPI backend + embedded `frontend/dist/` into a single Windows executable. Key hidden imports include uvicorn, anyio, tiktoken, and psycopg2. Heavy libraries (numpy, matplotlib, pandas) are explicitly excluded.

### Supabase Free-Tier Keepalive

`backend/keepalive_supabase.py` is invoked every 12 hours by `.github/workflows/supabase-keepalive.yml` to prevent the free-tier project from pausing. Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` GitHub secrets.
````

## File: run-chatarchive.sh
````bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${ROOT_DIR}"
exec "${ROOT_DIR}/scripts/dev.sh"
````

## File: .github/workflows/supabase-keepalive.yml
````yaml
name: Supabase Keepalive

on:
  schedule:
    # Runs every 12 hours (at 00:00 and 12:00 UTC)
    - cron: "0 0,12 * * *"
  workflow_dispatch:

jobs:
  keepalive:
    name: Ping Supabase
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check out repository
        uses: actions/checkout@v4.2.2

      - name: Set up Python
        uses: actions/setup-python@v5.4.0
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install requests python-dotenv

      - name: Run keepalive script
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: python backend/keepalive_supabase.py
````

## File: backend/app/importers/claude.py
````python
from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def parse_claude_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a Claude export file into conversations with messages.
    
    Claude exports can be in different formats:
    1. Array of conversation objects
    2. Single conversation object
    3. Object with 'conversations' key
    """
    conversations = None
    
    # Detect format
    if isinstance(payload, list):
        conversations = payload
    elif isinstance(payload, dict):
        # Check if it's a single conversation or has a conversations array
        if "uuid" in payload or "created_at" in payload:
            conversations = [payload]
        else:
            conversations = payload.get("conversations", payload.get("data", []))
    
    if not conversations:
        raise ValueError("Unrecognized Claude export format")
    
    parsed = []
    for item in conversations:
        # Extract conversation metadata
        conv_id = item.get("uuid") or item.get("id")
        name = item.get("name") or item.get("title")
        
        # Parse timestamps
        created_at = parse_timestamp(item.get("created_at"))
        updated_at = parse_timestamp(item.get("updated_at"))
        
        # Extract messages
        chat_messages = item.get("chat_messages", [])
        messages = []
        
        for idx, msg in enumerate(chat_messages):
            # Claude messages have text content and sender
            sender = msg.get("sender", "unknown")
            role = "user" if sender == "human" else "assistant"

            # Build content from structured content blocks if available,
            # otherwise fall back to the flat "text" field (which replaces
            # artifacts/tool-use blocks with "not supported" placeholders).
            content_blocks = msg.get("content", [])
            if content_blocks and isinstance(content_blocks, list):
                content = _extract_content_from_blocks(content_blocks)
            else:
                content = msg.get("text", "")

            if not content.strip():
                continue
            
            # Parse message timestamp
            msg_created = parse_timestamp(msg.get("created_at"))
            
            messages.append({
                "source_id": msg.get("uuid") or msg.get("id"),
                "role": role,
                "content": content,
                "content_type": "text",
                "created_at": msg_created,
                "order_index": idx,
                "model": item.get("model") or "claude",
            })
        
        parsed.append({
            "source": "claude",
            "source_id": conv_id,
            "title": name,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,
        })
    
    return parsed


def _extract_content_from_blocks(blocks: list[dict]) -> str:
    """
    Reconstruct readable message content from Claude's structured
    content blocks, replacing the flat 'text' field which substitutes
    artifact / tool-use blocks with "not supported" placeholders.
    """
    parts: list[str] = []

    for block in blocks:
        if not isinstance(block, dict):
            continue
        block_type = block.get("type")

        if block_type == "text":
            text = block.get("text", "").strip()
            if text:
                parts.append(text)

        elif block_type == "thinking":
            # Extended-thinking blocks — include as collapsed context
            text = block.get("thinking", "").strip()
            if text:
                parts.append(f"<details><summary>Thinking</summary>\n\n{text}\n</details>")

        elif block_type == "tool_use":
            name = block.get("name", "unknown_tool")
            inp = block.get("input", {})

            if name == "artifacts":
                # Artifact blocks carry the actual generated content
                title = inp.get("title", "Artifact")
                lang = _artifact_type_to_lang(inp.get("type", ""))
                artifact_content = inp.get("content", "")
                if artifact_content:
                    parts.append(f"**{title}**\n```{lang}\n{artifact_content}\n```")
            elif name == "web_search":
                query = inp.get("query", "")
                parts.append(f"*Searched the web: \"{query}\"*")
            else:
                # Generic tool use — show a brief summary
                message = block.get("message")
                if message:
                    parts.append(f"*{message}*")

        # tool_result and token_budget blocks are skipped — they don't
        # contain user-facing content worth preserving.

    return "\n\n".join(parts)


def _artifact_type_to_lang(artifact_type: str) -> str:
    """Map Claude artifact MIME types to Markdown code-fence languages."""
    mapping = {
        "application/vnd.ant.code": "",
        "application/vnd.ant.react": "jsx",
        "text/html": "html",
        "text/css": "css",
        "text/javascript": "javascript",
        "application/json": "json",
        "text/markdown": "markdown",
        "text/x-python": "python",
        "image/svg+xml": "svg",
    }
    return mapping.get(artifact_type, "")


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Claude."""
    if not timestamp:
        return None
    
    try:
        # Try ISO format first
        if isinstance(timestamp, str):
            # Remove timezone suffix if present
            timestamp = timestamp.replace("Z", "+00:00")
            return datetime.fromisoformat(timestamp.replace("+00:00", ""))
        # Try Unix timestamp
        elif isinstance(timestamp, (int, float)):
            return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError, TypeError):
        pass
    
    return None
````

## File: backend/pyproject.toml
````toml
[project]
name = "chatarchive-backend"
version = "0.1.0"
description = "FastAPI backend for ChatArchive"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.115.0",
    "pydantic>=2.10.0",
    "psycopg2-binary>=2.9.9",
    "python-dotenv>=1.0.0",
    "python-multipart>=0.0.12",
    "requests>=2.31.0",
    "sqlalchemy>=2.0.36",
    "supabase>=2.0.0",
    "tiktoken>=0.7.0",
    "uvicorn>=0.32.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["app"]
````

## File: docs/API.md
````markdown
# API Documentation

Base URL: `http://localhost:8000` (development)

## Health Check

### Get Health Status
`GET /health`

Check if the API is running.

**Response:**
```json
{
  "status": "ok"
}
```

---

## Import Endpoints

### Import ChatGPT Conversations
`POST /import/chatgpt`

Import conversations from a ChatGPT export file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the `conversations.json` export

**Response:**
```json
[
  {
    "id": 1,
    "source": "chatgpt",
    "source_id": "conv-abc123",
    "title": "Python Programming Help",
    "created_at": "2024-01-01T12:00:00",
    "updated_at": "2024-01-02T15:30:00",
    "message_count": 12
  }
]
```

### Import Claude Conversations
`POST /import/claude`

Import conversations from a Claude export file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the Claude JSON export

**Response:**
```json
[
  {
    "id": 2,
    "source": "claude",
    "source_id": "uuid-xyz789",
    "title": "Data Analysis Discussion",
    "created_at": "2024-01-03T09:15:00",
    "updated_at": "2024-01-03T10:45:00",
    "message_count": 8
  }
]
```

### Import GitHub Copilot Conversations
`POST /import/copilot`

Import conversations from a GitHub Copilot export file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the Copilot JSON export

**Response:**
```json
[
  {
    "id": 3,
    "source": "copilot",
    "source_id": "session-456",
    "title": "React Component Help",
    "created_at": "2024-01-04T14:20:00",
    "updated_at": "2024-01-04T14:45:00",
    "message_count": 6
  }
]
```

### Import Gemini/Bard Conversations
`POST /import/gemini`

Import conversations from a Gemini/Bard export file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the Gemini JSON export

**Response:**
```json
[
  {
    "id": 4,
    "source": "gemini",
    "source_id": "gemini-conv-123",
    "title": "Creative Writing Ideas",
    "created_at": "2024-01-05T11:00:00",
    "updated_at": "2024-01-05T11:30:00",
    "message_count": 10
  }
]
```

**Error Responses:**

All import endpoints may return:
- `400 Bad Request`: Invalid file format or JSON structure
- `500 Internal Server Error`: Server error during import

Example error:
```json
{
  "detail": "Invalid JSON format"
}
```

---

## Conversation Endpoints

### List Conversations
`GET /conversations`

Get a paginated list of all conversations with filtering and sorting options.

**Query Parameters:**
- `page` (optional, default: 1): Page number (min: 1)
- `page_size` (optional, default: 50): Items per page (min: 1, max: 100)
- `source` (optional): Filter by source platform (`chatgpt`, `claude`, `copilot`, `gemini`)
- `sort_by` (optional, default: `created_at`): Field to sort by (`created_at`, `updated_at`, `title`, `message_count`)
- `sort_order` (optional, default: `desc`): Sort order (`asc`, `desc`)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "source": "chatgpt",
      "source_id": "conv-abc123",
      "title": "Python Programming Help",
      "created_at": "2024-01-01T12:00:00",
      "updated_at": "2024-01-02T15:30:00",
      "message_count": 12
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

### Get Conversation Sources
`GET /conversations/sources`

Get a list of all unique sources with conversation counts.

**Response:**
```json
[
  {
    "source": "chatgpt",
    "count": 25
  },
  {
    "source": "claude",
    "count": 15
  },
  {
    "source": "copilot",
    "count": 8
  },
  {
    "source": "gemini",
    "count": 6
  }
]
```

### Search Conversations
`GET /conversations/search`

Search conversations by title and optionally message content.

**Query Parameters:**
- `q` (required): Search query string
- `page` (optional, default: 1): Page number
- `page_size` (optional, default: 50): Items per page
- `source` (optional): Filter by source platform
- `search_messages` (optional, default: true): Also search message content

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "source": "chatgpt",
      "title": "Python Programming Help",
      "created_at": "2024-01-01T12:00:00",
      "message_count": 12
    }
  ],
  "total": 5,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

### Get Conversation Detail
`GET /conversations/{conversation_id}`

Get a single conversation with all its messages.

**Response:**
```json
{
  "id": 1,
  "source": "chatgpt",
  "source_id": "conv-abc123",
  "title": "Python Programming Help",
  "created_at": "2024-01-01T12:00:00",
  "updated_at": "2024-01-02T15:30:00",
  "message_count": 12,
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "How do I use list comprehensions in Python?",
      "content_type": "text",
      "created_at": "2024-01-01T12:00:00",
      "order_index": 0
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "List comprehensions provide a concise way to create lists...",
      "content_type": "text",
      "created_at": "2024-01-01T12:01:00",
      "order_index": 1
    }
  ]
}
```

### Delete Conversation
`DELETE /conversations/{conversation_id}`

Delete a conversation and all its messages.

**Response:**
```json
{
  "status": "deleted",
  "id": "1"
}
```

---

## Statistics

### Get Statistics
`GET /stats`

Get overall statistics about conversations and messages.

**Response:**
```json
{
  "total_conversations": 54,
  "total_messages": 486,
  "sources": {
    "chatgpt": 25,
    "claude": 15,
    "copilot": 8,
    "gemini": 6
  },
  "date_range": {
    "oldest": "2024-01-01T12:00:00",
    "newest": "2024-01-15T18:30:00"
  }
}
```

---

## Import History

### Get Import History
`GET /import/history`

Get a paginated list of import history records.

**Query Parameters:**
- `page` (optional, default: 1): Page number (min: 1)
- `page_size` (optional, default: 50): Items per page (min: 1, max: 100)
- `source_type` (optional): Filter by source type (`chatgpt`, `claude`, `copilot`, `gemini`)
- `status` (optional): Filter by status (`success`, `failure`, `partial`, `processing`)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "filename": "conversations.json",
      "source_location": null,
      "source_type": "chatgpt",
      "file_format": "json",
      "status": "success",
      "created_at": "2024-01-15T16:30:00",
      "imported_count": 50,
      "error_message": null
    },
    {
      "id": 2,
      "filename": "claude_export.json",
      "source_location": null,
      "source_type": "claude",
      "file_format": "json",
      "status": "success",
      "created_at": "2024-01-15T17:00:00",
      "imported_count": 15,
      "error_message": null
    }
  ],
  "total": 2,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

### Get Single Import History Item
`GET /import/history/{history_id}`

Get details for a specific import history record.

**Response:**
```json
{
  "id": 1,
  "filename": "conversations.json",
  "source_location": null,
  "source_type": "chatgpt",
  "file_format": "json",
  "status": "success",
  "created_at": "2024-01-15T16:30:00",
  "imported_count": 50,
  "error_message": null
}
```

---

## Import Settings

### Get Import Settings
`GET /settings/import`

Get current import settings.

**Response:**
```json
{
  "id": 1,
  "allowed_formats": "json,csv,xml",
  "default_format": "json",
  "auto_merge_duplicates": false,
  "keep_separate": true,
  "skip_empty_conversations": true,
  "updated_at": "2024-01-15T16:30:00"
}
```

### Update Import Settings
`PUT /settings/import`

Update import settings.

**Request Body** (all fields optional):
```json
{
  "allowed_formats": "json,csv,xml",
  "default_format": "json",
  "auto_merge_duplicates": false,
  "keep_separate": true,
  "skip_empty_conversations": true
}
```

**Response:**
```json
{
  "id": 1,
  "allowed_formats": "json,csv,xml",
  "default_format": "json",
  "auto_merge_duplicates": false,
  "keep_separate": true,
  "skip_empty_conversations": true,
  "updated_at": "2024-01-15T18:00:00"
}
```

---

## Data Models

### Conversation
```typescript
{
  id: number;
  source: "chatgpt" | "claude" | "copilot" | "gemini";
  source_id: string | null;
  title: string | null;
  created_at: string | null;  // ISO 8601 datetime
  updated_at: string | null;  // ISO 8601 datetime
  message_count: number;
}
```

### Message
```typescript
{
  id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  content_type: string;
  created_at: string | null;  // ISO 8601 datetime
  order_index: number;
}
```

### Import History
```typescript
{
  id: number;
  filename: string;
  source_location: string | null;
  source_type: "chatgpt" | "claude" | "copilot" | "gemini";
  file_format: string;
  status: "success" | "failure" | "partial" | "processing";
  created_at: string;  // ISO 8601 datetime
  imported_count: number;
  error_message: string | null;
}
```

---

## Examples

### Import ChatGPT with cURL
```bash
curl -X POST http://localhost:8000/import/chatgpt \
  -F "file=@conversations.json"
```

### Import Claude with Python
```python
import requests

url = "http://localhost:8000/import/claude"
files = {"file": open("claude_export.json", "rb")}
response = requests.post(url, files=files)
print(response.json())
```

### Search Conversations with JavaScript
```javascript
const searchConversations = async (query) => {
  const response = await fetch(
    `http://localhost:8000/conversations/search?q=${encodeURIComponent(query)}`
  );
  return await response.json();
};

searchConversations("Python").then(data => console.log(data));
```
````

## File: docs/PROJECT_FOLDERS_IMPLEMENTATION.md
````markdown
# Project Folder Organization Feature - Implementation Summary

## Status: ✅ Complete - Backend & Frontend Fully Implemented

## Overview
This implementation adds the ability to organize conversations into project folders in ChatArchive, providing better organization beyond the existing flat tag system.

## Backend Implementation (✅ Complete)

### Database Schema Changes
- **New Table: `projects`**
  - `id` (PRIMARY KEY)
  - `name` (VARCHAR(100), UNIQUE, INDEX)
  - `description` (VARCHAR(500), nullable)
  - `color` (VARCHAR(7), nullable) - Hex color code
  - `created_at` (TIMESTAMP)
  
- **Modified Table: `conversations`**
  - Added `project_id` (INT, FOREIGN KEY → projects.id, INDEX, ON DELETE SET NULL)
  - Maintains backward compatibility (NULL = uncategorized)

### API Endpoints
All endpoints tested and working:

```bash
# List all projects with conversation counts
GET /projects
Response: { items: ProjectResponse[], total: number }

# Create a new project
POST /projects
Body: { name: string, description?: string, color?: string }
Response: ProjectResponse

# Get specific project
GET /projects/{project_id}
Response: ProjectResponse

# Update project
PUT /projects/{project_id}
Body: { name?: string, description?: string, color?: string }
Response: ProjectResponse

# Delete project (conversations become uncategorized)
DELETE /projects/{project_id}
Response: { status: "deleted", id: string }

# Move conversation to project
POST /conversations/{conversation_id}/move
Body: { project_id: number | null }
Response: { status: "moved", conversation_id: number, old_project_id, new_project_id }

# Filter conversations by project
GET /conversations?project_id={id}
Use project_id=-1 for uncategorized conversations
```

### Testing Results
```bash
# Create projects
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Work Projects", "description": "Work conversations", "color": "#3B82F6"}'

# List projects
curl http://localhost:8000/projects
# Returns:
{
  "items": [
    {
      "id": 1,
      "name": "Work Projects",
      "description": "Work conversations",
      "color": "#3B82F6",
      "created_at": "2026-02-09T15:20:40.238891",
      "conversation_count": 0
    }
  ],
  "total": 1
}
```

## Frontend Implementation (✅ Complete)

### Completed Components
1. **Type Definitions** ✅
   - Added `ProjectType` interface
   - Updated `Conversation` type to include optional `project` field

2. **State Management** ✅
   - `allProjects`: List of all projects
   - `selectedProject`: Currently filtered project (null = all, -1 = uncategorized)
   - `showProjectModal`: Project management modal visibility
   - `showMoveToProjectModal`: Move conversation modal visibility

3. **API Integration** ✅
   - `loadProjects()`: Fetch all projects
   - `createProject()`: Create new project
   - `moveConversationToProject()`: Move conversation to project
   - `handleProjectFilter()`: Filter conversations by project
   - Updated `loadConversations()` to support `project_id` parameter

4. **UI Components** ✅
   - **Project Filter Dropdown**: In sidebar, shows all projects + uncategorized option
   - **Project Badge**: Displayed on conversation cards in list
   - **"Move to Project" Menu Item**: In conversation context menu
   - **Project Manager Modal**: Create and delete projects with color picker
   - **Move to Project Modal**: Select destination project for conversation

### Build & Testing ✅
- TypeScript compilation successful
- Frontend builds and runs without errors
- All UI components functional and tested
- Modals open/close correctly
- API integration working end-to-end

## Files Modified

### Backend
- ✅ `backend/app/models.py` - Added Project model, updated Conversation
- ✅ `backend/app/schemas.py` - Added Project schemas (Create, Update, Response, List, MoveToProjectRequest)
- ✅ `backend/app/main.py` - Added 6 project endpoints, updated conversation filtering
- ✅ `backend/migrate_add_projects.py` - Database migration script (NEW FILE)

### Frontend
- 🔄 `frontend/src/App.tsx` - Added project UI components and integration

## Migration Steps

### For Fresh Installation:
```bash
cd backend
python init_db.py
python migrate_add_projects.py
python -m app.main  # Start backend on :8000

# In another terminal
cd frontend
npm install
npm run dev  # Start frontend on :5173
```

### For Existing Installation:
```bash
cd backend
python migrate_add_projects.py  # Adds projects table + project_id column
# Restart backend server
```

## Usage Examples

### Via API (Backend)
```bash
# Create project
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "color": "#8B5CF6"}'

# Move conversation to project
curl -X POST http://localhost:8000/conversations/123/move \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1}'

# Filter by project
curl "http://localhost:8000/conversations?project_id=1"

# Get uncategorized
curl "http://localhost:8000/conversations?project_id=-1"
```

### Via UI (When Frontend Fixed)
1. Click "Manage Projects" button in sidebar
2. Create new project with name, description, and color
3. Select conversation → click "..." → "Move to project"
4. Use project filter dropdown to view conversations in specific projects
5. Click project badge on conversation to filter by that project

## Data Model

### Relationship
- **One-to-Many**: Project → Conversations
- **Many-to-Many**: Tags ↔ Conversations (existing, unchanged)
- A conversation can belong to ONE project (or none)
- A conversation can have MULTIPLE tags
- This provides two-level organization: broad folders (projects) + fine-grained labels (tags)

### Example Data Structure
```json
{
  "id": 1,
  "title": "Debug Python Error",
  "source": "chatgpt",
  "project": {
    "id": 1,
    "name": "Work Projects",
    "color": "#3B82F6"
  },
  "tags": [
    { "id": 1, "name": "coding", "color": "#10B981" },
    { "id": 2, "name": "python", "color": "#F59E0B" }
  ]
}
```

## Backward Compatibility ✅
- Existing conversations without projects work correctly (project_id = NULL)
- Deleting a project sets conversations' project_id to NULL (uncategorized)
- No data migration needed for existing installations
- Tags system continues to work independently

## Next Steps

### To Complete Frontend:
1. Resolve TypeScript compilation error
   - Try running prettier/eslint
   - Check for invisible characters
   - May need to refactor modal components into separate files
   
2. Test UI functionality
   - Create projects
   - Move conversations
   - Filter by project
   - Verify persistence

3. Add Polish
   - Drag-and-drop support
   - Keyboard shortcuts
   - Better visual hierarchy
   - Empty states

### Future Enhancements:
- Nested projects (subfolders)
- Bulk move operations
- Project templates
- Project-level settings (default tags, etc.)
- Export/import projects
- Project statistics dashboard

## Security Considerations
- Project names must be unique (enforced by database)
- No authorization yet (single-user application)
- SQL injection prevented by SQLAlchemy ORM
- Input validation on backend for project names

## Performance
- Indexed columns: `project_id` on conversations, `name` on projects
- Eager loading with `joinedload(Conversation.project)` for efficiency
- No N+1 query issues

## Testing Checklist
- [x] Create project via API
- [x] List projects via API
- [x] Update project via API
- [x] Delete project via API
- [x] Move conversation to project
- [x] Filter conversations by project
- [x] Filter uncategorized conversations
- [x] Verify project_id set correctly
- [x] Verify ON DELETE SET NULL behavior
- [x] UI: Create project
- [x] UI: Delete project
- [x] UI: Move conversation
- [x] UI: Filter by project
- [x] UI: Display project badges
- [x] End-to-end workflow test
- [x] Frontend builds successfully
- [x] All modals functional

## Known Limitations
1. No nested projects (flat hierarchy)
2. No project permissions/sharing
3. No project archiving
4. No bulk operations yet
5. No undo for moves

## References
- Backend Models: `backend/app/models.py`
- API Endpoints: `backend/app/main.py` lines 1360-1543
- Migration Script: `backend/migrate_add_projects.py`
- Frontend UI: `frontend/src/App.tsx` lines 32-38 (types), 123-126 (state), 943-987 (UI)
````

## File: docs/TESTING.md
````markdown
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
````

## File: build.ps1
````powershell
# ChatArchive build script
# Run from the project root: .\build.ps1
# Output: dist\ChatArchive\ChatArchive.exe

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot

# ── Prerequisites ────────────────────────────────────────────────────────────

foreach ($cmd in @("npm", "python")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "$cmd not found. Ensure it is installed and on your PATH."
        exit 1
    }
}

# ── Step 1: Build the React frontend ────────────────────────────────────────

Write-Host ""
Write-Host "=== Step 1/2: Building frontend ===" -ForegroundColor Cyan
Push-Location (Join-Path $rootDir "frontend")
try {
    npm install
    npm run build
} finally {
    Pop-Location
}

$distDir = Join-Path $rootDir "frontend\dist"
if (-not (Test-Path $distDir)) {
    Write-Error "Frontend build failed — dist folder not found."
    exit 1
}
Write-Host "Frontend built successfully." -ForegroundColor Green

# ── Step 2: Bundle with PyInstaller ─────────────────────────────────────────

Write-Host ""
Write-Host "=== Step 2/2: Bundling with PyInstaller ===" -ForegroundColor Cyan
Set-Location $rootDir

# Use the backend venv's Python so PyInstaller sees all installed packages
$venvPython = Join-Path $rootDir "backend\venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Error "backend\venv not found. Run: cd backend && python -m venv venv && venv\Scripts\pip install -r requirements.txt"
    exit 1
}

# Install pyinstaller into the venv if missing, then use its script directly
& $venvPython -m pip install pyinstaller --quiet
$venvPyInstaller = Join-Path $rootDir "backend\venv\Scripts\pyinstaller.exe"

& $venvPyInstaller chatarchive.spec --noconfirm

$exePath = Join-Path $rootDir "dist\ChatArchive\ChatArchive.exe"
if (-not (Test-Path $exePath)) {
    Write-Error "PyInstaller step failed — executable not found at $exePath"
    exit 1
}

# ── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Executable: $exePath" -ForegroundColor Yellow
Write-Host ""
Write-Host "To run: double-click ChatArchive.exe inside dist\ChatArchive\"
Write-Host "To share: copy the entire dist\ChatArchive\ folder."
Write-Host ""
Write-Host "Note: on first run, place your .env file next to ChatArchive.exe"
Write-Host "if you use Supabase or a PostgreSQL database."
````

## File: chatarchive.spec
````
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
````

## File: IMPLEMENTATION_SUMMARY.md
````markdown
# Project Folder Organization - Implementation Complete ✅

## Summary

Successfully implemented project folder organization feature for ChatArchive, allowing users to organize conversations into named projects with custom colors. Feature is fully functional on both backend and frontend.

## What Was Delivered

### Backend (100% Complete)
- ✅ New `Project` model with SQLAlchemy ORM
- ✅ 6 RESTful API endpoints for full CRUD operations
- ✅ Database migration script for seamless upgrades
- ✅ Optimized queries (eliminated N+1 problem)
- ✅ Proper use of database constraints (ON DELETE SET NULL)
- ✅ Full backward compatibility maintained
- ✅ Comprehensive API testing completed

### Frontend (100% Complete)
- ✅ Project management UI with modal dialogs
- ✅ Project filter dropdown in sidebar
- ✅ "Move to Project" functionality in context menu
- ✅ Color-coded project badges on conversations
- ✅ Create/delete projects with color picker
- ✅ TypeScript type safety throughout
- ✅ Builds and runs successfully
- ✅ All UI interactions tested

### Database
- ✅ `projects` table with name, description, color, created_at
- ✅ `project_id` foreign key added to conversations table
- ✅ Indexed columns for performance
- ✅ ON DELETE SET NULL constraint for automatic cleanup
- ✅ Unique constraint on project names

## Key Features

1. **Create Projects** - Users can create projects with custom names, descriptions, and colors
2. **Organize Conversations** - Move conversations into projects via context menu
3. **Filter by Project** - Filter conversations by specific project or view uncategorized
4. **Visual Organization** - Project badges displayed on conversation cards
5. **Persistent Storage** - All project data persists across sessions
6. **Backward Compatible** - Existing conversations work without any changes

## Testing Results

### Backend API Tests ✅
```bash
# Tested endpoints:
✅ GET /projects - List all projects with conversation counts
✅ POST /projects - Create new project
✅ GET /projects/{id} - Get specific project
✅ PUT /projects/{id} - Update project
✅ DELETE /projects/{id} - Delete project
✅ POST /conversations/{id}/move - Move conversation to project
✅ GET /conversations?project_id={id} - Filter by project
✅ GET /conversations?project_id=-1 - Get uncategorized
```

### Frontend UI Tests ✅
```
✅ Opens "Manage Projects" modal
✅ Creates new project with color picker
✅ Displays existing projects with counts
✅ Deletes projects
✅ Filters conversations by project
✅ Shows project badges on conversations
✅ "Move to Project" menu option works
✅ TypeScript compiles without errors
✅ Vite build succeeds
```

## Performance Optimizations

1. **Eliminated N+1 Query Problem**
   - Changed from N separate queries to single JOIN query
   - Used `func.count()` with GROUP BY for aggregation
   - Significant performance improvement for projects endpoint

2. **Database Constraints**
   - Removed redundant manual updates
   - Leveraged ON DELETE SET NULL for automatic cleanup
   - Cleaner, more reliable code

3. **Indexed Columns**
   - `project_id` indexed on conversations table
   - `name` indexed on projects table
   - Faster filtering and lookups

## Code Quality Improvements

1. **Fixed Duplicate Function Declaration** - Resolved TypeScript compilation error
2. **Pythonic Code** - Used `.is_(None)` instead of `== None`
3. **Consistent Parameter Passing** - Fixed missing parameters in function calls
4. **Optimized Queries** - Single query vs multiple queries
5. **Proper Error Handling** - HTTPException with meaningful messages

## Files Modified

### Backend
- `backend/app/models.py` - Added Project model, updated Conversation
- `backend/app/schemas.py` - Added Project schemas (Create, Update, Response, List, MoveToProjectRequest)
- `backend/app/main.py` - Added 6 project endpoints, updated conversation filtering
- `backend/migrate_add_projects.py` - Database migration script (NEW FILE)

### Frontend
- `frontend/src/App.tsx` - Added project UI components, modals, and API integration

### Documentation
- `docs/PROJECT_FOLDERS_IMPLEMENTATION.md` - Comprehensive implementation guide (NEW FILE)

## Screenshots

### Main UI
![ChatArchive with Projects](https://github.com/user-attachments/assets/96051288-2cb9-4a9c-94fd-b5544c0be6a7)

Shows:
- "Filter by project" dropdown with all projects + uncategorized
- "Manage Projects" button
- Clean integration with existing UI

### Manage Projects Modal
![Manage Projects Modal](https://github.com/user-attachments/assets/ea6aa7ba-b8e5-4646-b7fc-3c2755128694)

Shows:
- Create new project form with color picker
- List of existing projects with descriptions
- Conversation counts per project
- Delete buttons for each project

## Acceptance Criteria - ALL MET ✅

- [x] Users can create project folders
- [x] Users can move conversations into project folders
- [x] Users can move conversations between folders
- [x] The folder structure persists across sessions
- [x] The UI clearly shows which conversations belong to which projects
- [x] Existing conversations continue to work without issues

## Migration Path

### Fresh Installation
1. Run `python init_db.py` to create database
2. Run `python migrate_add_projects.py` to add projects support
3. Start servers and use normally

### Existing Installation
1. Run `python migrate_add_projects.py` to upgrade database
2. Restart servers
3. All existing conversations remain accessible
4. No data loss or corruption

## Next Steps (Optional Future Enhancements)

- Nested projects/subfolders
- Bulk move operations
- Project templates
- ✅ Drag-and-drop for moving conversations
- Project-level settings
- Export/import projects
- Project statistics dashboard
- Project search

## Conclusion

The project folder organization feature is **fully implemented, tested, and ready for production use**. Both backend and frontend are complete with:

- ✅ All required functionality
- ✅ Comprehensive testing
- ✅ Performance optimizations
- ✅ Clean, maintainable code
- ✅ Full documentation
- ✅ Backward compatibility
- ✅ Production-ready quality

The feature provides users with a powerful new way to organize their conversations while maintaining the simplicity and elegance of the ChatArchive interface.
````

## File: .claude/settings.local.json
````json
{
  "permissions": {
    "allow": [
      "Bash(npm list vite react-window lucide-react typescript)",
      "Bash(pip show SQLAlchemy python-multipart anyio greenlet)",
      "Bash(npm run build)",
      "mcp__claude_ai_Supabase__list_projects",
      "mcp__claude_ai_Supabase__apply_migration"
    ]
  }
}
````

## File: backend/app/storage.py
````python
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
        
        # Skip upload if file exceeds Supabase free-tier limit (50 MB)
        MAX_UPLOAD_BYTES = 50 * 1024 * 1024
        if len(content) > MAX_UPLOAD_BYTES:
            size_mb = len(content) / (1024 * 1024)
            logger.warning(
                f"Skipping Supabase storage upload for {filename}: "
                f"file size {size_mb:.1f} MB exceeds the 50 MB limit. "
                "Increase the bucket's file size limit in the Supabase Dashboard to enable uploads."
            )
            return {"success": False, "error": "File too large for storage upload (>50 MB)"}
        
        # Create a unique path: source_type/YYYY-MM-DD/filename
        timestamp = datetime.utcnow().strftime("%Y-%m-%d")
        storage_path = f"{source_type}/{timestamp}/{filename}"
        
        # Upload to bucket
        response = client.storage.from_(SUPABASE_BUCKET_NAME).upload(
            path=storage_path,
            file=content,
            file_options={
                "content-type": "application/json",
                "upsert": "true"  # Allow overwriting if file exists
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
````

## File: backend/app/tagger.py
````python
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
        # This prevents 'class' from matching 'classical'
        pattern = r'\b' + re.escape(keyword) + r'\b'
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
````

## File: backend/verify_parsers.py
````python
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
````

## File: docs/IMPORT_GUIDE.md
````markdown
# Import Guide

ChatArchive supports importing conversations from multiple AI platforms. This guide will walk you through the process for each supported platform.

## Supported Platforms

- **ChatGPT** (OpenAI)
- **Claude** (Anthropic)
- **GitHub Copilot**
- **Gemini/Bard** (Google)

---

## ChatGPT

### How to Export

1. Open ChatGPT and go to Settings → Data Controls → Export Data
2. Click "Export" and wait for the email confirmation
3. Download the archive and extract `conversations.json`

### File Format

ChatGPT exports use a nested JSON structure with a tree-based message mapping system.

**Example structure:**
```json
{
  "conversations": [
    {
      "id": "conversation-id",
      "title": "Conversation Title",
      "create_time": 1704067200,
      "mapping": {
        "node-id": {
          "message": {
            "author": {"role": "user"},
            "content": {"parts": ["Message content"]}
          }
        }
      }
    }
  ]
}
```

### Import to ChatArchive

1. Open ChatArchive and click the "Import" button
2. Select "ChatGPT" from the source dropdown
3. Choose your `conversations.json` file
4. Click "Import from ChatGPT"

---

## Claude

### How to Export

1. Visit [claude.ai/settings](https://claude.ai/settings)
2. Navigate to "Data & Privacy"
3. Click "Request your data export"
4. Wait for the email with your export (may take a few hours)
5. Download and extract the JSON file

### File Format

Claude exports contain conversations with structured chat messages.

**Example structure:**
```json
[
  {
    "uuid": "conversation-uuid",
    "name": "Conversation Name",
    "created_at": "2024-01-01T12:00:00Z",
    "chat_messages": [
      {
        "uuid": "message-uuid",
        "sender": "human",
        "text": "Message content",
        "created_at": "2024-01-01T12:00:00Z"
      }
    ]
  }
]
```

**Key features:**
- Sender roles: `human` (user) or `assistant`
- ISO 8601 timestamps
- Unique UUIDs for conversations and messages

### Import to ChatArchive

1. Open ChatArchive and click the "Import" button
2. Select "Claude" from the source dropdown
3. Choose your Claude export JSON file
4. Click "Import from Claude"

---

## GitHub Copilot

### How to Export

GitHub Copilot chat history can be exported from:
- **VS Code**: Extensions → Copilot → Settings → Export Chat History
- **GitHub.com**: Visit your Copilot settings and request an export

### File Format

Copilot exports support multiple format variations depending on the source.

**VS Code format:**
```json
[
  {
    "id": "session-id",
    "title": "Chat Title",
    "createdAt": "2024-01-01T12:00:00Z",
    "messages": [
      {
        "role": "user",
        "content": "Message content",
        "timestamp": "2024-01-01T12:00:00Z"
      }
    ]
  }
]
```

**Alternative format (sessions/exchanges):**
```json
{
  "sessions": [
    {
      "sessionId": "id",
      "exchanges": [
        {
          "author": "user",
          "message": "Content"
        }
      ]
    }
  ]
}
```

**Key features:**
- Flexible field names (role/author/sender)
- Supports code snippets and context
- Multiple timestamp formats (ISO, Unix)

### Import to ChatArchive

1. Open ChatArchive and click the "Import" button
2. Select "GitHub Copilot" from the source dropdown
3. Choose your Copilot export JSON file
4. Click "Import from GitHub Copilot"

---

## Gemini/Bard

### How to Export

1. Visit [Google Takeout](https://takeout.google.com/)
2. Deselect all products, then select only "Gemini Apps Activity" or "Bard"
3. Choose file format (JSON recommended) and delivery method
4. Create export and wait for the download link
5. Download and extract the JSON file(s)

### File Format

Gemini/Bard exports from Google Takeout use various structures.

**Example structure:**
```json
[
  {
    "id": "conversation-id",
    "title": "Conversation Title",
    "create_time": 1704110400,
    "messages": [
      {
        "role": "user",
        "text": "Message content",
        "timestamp": 1704110400
      },
      {
        "role": "model",
        "text": "Response content",
        "model": "gemini-pro"
      }
    ]
  }
]
```

**Alternative format:**
```json
{
  "conversations": [
    {
      "conversation_id": "id",
      "turns": [
        {
          "author": "user",
          "prompt": "User message"
        },
        {
          "author": "bard",
          "response": "Assistant response"
        }
      ]
    }
  ]
}
```

**Key features:**
- Sender roles: `user`, `human` (user) or `model`, `assistant`, `gemini`, `bard` (AI)
- Unix timestamps or ISO dates
- Model information preserved

### Import to ChatArchive

1. Open ChatArchive and click the "Import" button
2. Select "Gemini" from the source dropdown
3. Choose your Gemini/Bard export JSON file
4. Click "Import from Gemini"

---

## Import & Export Settings

ChatArchive provides a comprehensive settings system to customize your import behavior and track import history.

### Accessing Settings

Click the **Settings** button in the left sidebar to open the Import & Export Settings modal.

### Import Settings

Configure how ChatArchive handles your imports:

#### File Format Preferences

- **Allowed Formats**: Specify which file formats are accepted for import (json, csv, xml). Enter formats as comma-separated values.
- **Default Format**: Select your preferred default format (JSON, CSV, or XML).

#### Import Behavior

- **Auto-merge duplicate conversations**: When enabled, ChatArchive will automatically merge imported conversations with existing ones if they share the same source ID. This prevents duplicate entries in your archive.

- **Keep imported data separate**: When enabled, each import creates a separate archive instead of merging with existing data. This is useful for maintaining distinct collections or testing imports.

- **Skip empty conversations**: When enabled, ChatArchive will skip conversations that contain no messages during import. This helps keep your archive clean and focused on meaningful conversations.

### Import History

The Import History tab shows a complete log of all your past imports with the following information:

- **Date & Time**: When the import was performed
- **File Name**: The name of the imported file
- **Source**: The platform the data came from (ChatGPT, Claude, Copilot, Gemini)
- **Format**: The file format (JSON, CSV, XML)
- **Status**: Import result
  - **Success**: Import completed without errors
  - **Failure**: Import failed
  - **Partial**: Some items imported successfully
  - **Processing**: Import currently in progress
- **Imported**: Number of conversations successfully imported

#### Error Details

If any imports failed, an "Error Details" section appears at the bottom of the history list, showing the specific error messages for each failed import.

---

## Best Practices

1. **Before large imports**: Check your import settings to ensure they match your preferences
2. **Enable auto-merge**: If you frequently re-import data from the same source to get updates
3. **Keep separate**: If you're experimenting or want to maintain distinct archives
4. **Review import history**: Regularly check the import history to ensure all imports completed successfully
5. **Export regularly**: Keep backups of your ChatArchive data
6. **Verify format**: Ensure your export files match the expected format for each platform

---

## Troubleshooting

### Import Fails

If an import fails:
1. Check the Import History for specific error messages
2. Verify the file format matches the expected format for the selected platform
3. Ensure the file isn't corrupted or empty
4. Check that your allowed formats include the file type you're trying to import
5. Try re-exporting the data from the source platform

### Missing Messages

If some messages are missing after import:
- ChatArchive skips empty messages and certain system messages by design
- Check the message count in the Import History to verify
- Some platforms may have message limits on exports

### Timestamps Not Displayed

Different platforms use different timestamp formats. ChatArchive attempts to parse:
- Unix timestamps (seconds or milliseconds)
- ISO 8601 dates
- Various string formats

If timestamps are missing, the data may use an unsupported format.

### Duplicate Conversations

If you see duplicate conversations:
- Enable "Auto-merge duplicate conversations" in settings before re-importing
- Duplicates are identified by the source ID from the original platform

---

## Format Comparison

| Feature | ChatGPT | Claude | Copilot | Gemini |
|---------|---------|---------|---------|--------|
| Export Format | JSON | JSON | JSON | JSON |
| Message Threading | Tree-based | Linear | Linear | Linear |
| Timestamp Format | Unix (seconds) | ISO 8601 | ISO/Unix | Unix/ISO |
| Code Highlighting | ✓ | ✓ | ✓ | ✓ |
| Model Information | ✓ | ✓ | ✓ | ✓ |
| Multi-turn Support | ✓ | ✓ | ✓ | ✓ |
| Export Availability | Always | On request | Settings | Google Takeout |

---

## Need Help?

If you encounter issues not covered in this guide:
1. Check the [GitHub Issues](https://github.com/jimjamscott22/chatarchive/issues)
2. Review the [API Documentation](./API.md)
3. Open a new issue with details about your problem
````

## File: frontend/package.json
````json
{
  "name": "chatarchive-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "lucide-react": "^0.562.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^10.1.0",
    "react-window": "^2.2.5",
    "rehype-highlight": "^7.0.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@types/react-window": "^2.0.0",
    "@vitejs/plugin-react": "^4.2.1",
    "jsdom": "^29.0.0",
    "typescript": "^5.3.3",
    "vite": "^7.3.0",
    "vitest": "^4.1.0"
  }
}
````

## File: scripts/dev.sh
````bash
#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="${HOME}/.nvm"
# shellcheck disable=SC1091
[[ -s "${NVM_DIR}/nvm.sh" ]] && source "${NVM_DIR}/nvm.sh"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Syncing backend dependencies with uv..."
(cd "${BACKEND_DIR}" && uv sync)

if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "${FRONTEND_DIR}" && npm install)
fi

echo "Starting backend..."
(cd "${BACKEND_DIR}" && uv run python -m app.main) &
BACKEND_PID=$!

echo "Starting frontend..."
(cd "${FRONTEND_DIR}" && npm run dev) &
FRONTEND_PID=$!

wait "${BACKEND_PID}" "${FRONTEND_PID}"
````

## File: .gitignore
````
# ============================================
# Node.js / Frontend
# ============================================
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.pnpm-store/

# Build outputs
dist/
build/
.next/
out/
.nuxt/
.cache/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# ============================================
# Python / Backend
# ============================================
# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class
*.so

# Virtual environments
venv/
env/
ENV/
.venv/

# Django stuff (if you use Django later)
*.log
local_settings.py
db.sqlite3
db.sqlite3-journal

# Flask stuff (if you use Flask)
instance/
.webassets-cache

# Python distribution / packaging
*.egg
*.egg-info/
dist/
build/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
pip-wheel-metadata/

# ============================================
# Database
# ============================================
*.db
*.sqlite
*.sqlite3

# ============================================
# IDEs
# ============================================
# VSCode
.vscode/
*.code-workspace

# PyCharm
.idea/
*.iml

# Sublime Text
*.sublime-project
*.sublime-workspace

# ============================================
# OS
# ============================================
# macOS
.DS_Store
.AppleDouble
.LSOverride

# Windows
Thumbs.db
ehthumbs.db
Desktop.ini

# Linux
*~

# ============================================
# Project Specific
# ============================================
# User uploaded data (chat exports)
uploads/
data/chats/
*.json.backup

# Generated files
coverage/
.coverage
htmlcov/

# Testing
.pytest_cache/
.tox/

# Docker
docker-compose.override.yml
env_4_chatarchive.txt
ChatArchivescrnshtNew.png

chats/
````

## File: backend/requirements.txt
````
fastapi>=0.115.0
uvicorn>=0.32.0
pydantic>=2.10.0
SQLAlchemy>=2.0.36
python-multipart>=0.0.12
pytest>=8.0.0
python-dotenv>=1.0.0
supabase>=2.0.0
psycopg2-binary>=2.9.9
tiktoken>=0.7.0
requests>=2.31.0
````

## File: backend/app/schemas.py
````python
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ============ Project Schemas ============

class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None


class ProjectCreate(ProjectBase):
    """Create a new project."""
    pass


class ProjectUpdate(BaseModel):
    """Update an existing project."""
    name: str | None = None
    description: str | None = None
    color: str | None = None


class ProjectResponse(ProjectBase):
    """Project with usage statistics."""
    id: int
    created_at: datetime
    conversation_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    """List of all projects."""
    items: list[ProjectResponse]
    total: int


class MoveToProjectRequest(BaseModel):
    """Request to move a conversation to a project."""
    project_id: int | None  # None = move to uncategorized


# ============ Tag Schemas ============

class TagBase(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None


class TagCreate(TagBase):
    """Create a new tag."""
    pass


class TagUpdate(BaseModel):
    """Update an existing tag."""
    name: str | None = None
    description: str | None = None
    color: str | None = None


class TagResponse(TagBase):
    """Tag with usage statistics."""
    id: int
    created_at: datetime
    conversation_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)


class TagListResponse(BaseModel):
    """List of all tags."""
    items: list[TagResponse]
    total: int


class AddTagRequest(BaseModel):
    """Request to add a tag to a conversation."""
    tag_name: str
    auto_tagged: bool = False


# ============ Message Schemas ============

class MessageBase(BaseModel):
    role: str
    content: str
    content_type: str = "text"
    created_at: datetime | None = None
    model: str | None = None


class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    order_index: int
    source_id: str | None = None
    
    model_config = ConfigDict(from_attributes=True)


# ============ Conversation Schemas ============

class ConversationCreate(BaseModel):
    source: str
    title: str | None = None
    created_at: datetime | None = None
    raw_json: str


class ConversationBase(BaseModel):
    id: int
    source: str
    source_id: str | None = None
    title: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    message_count: int = 0
    tags: list[TagResponse] = []
    project: ProjectResponse | None = None
    
    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(ConversationBase):
    """Basic conversation info without messages."""
    pass


class ConversationDetail(ConversationBase):
    """Full conversation with messages."""
    messages: list[MessageResponse] = []


# ============ List/Search Schemas ============

class ConversationListResponse(BaseModel):
    """Paginated list of conversations."""
    items: list[ConversationResponse]
    total: int
    page: int
    page_size: int
    pages: int


class SearchResult(BaseModel):
    """Search result with highlighted snippet."""
    conversation: ConversationResponse
    snippet: str | None = None
    match_count: int = 0


# ============ Import History Schemas ============

class ImportHistoryResponse(BaseModel):
    """Import history record."""
    id: int
    filename: str
    source_location: str | None = None
    source_type: str
    file_format: str
    status: str
    created_at: datetime
    imported_count: int
    error_message: str | None = None
    
    model_config = ConfigDict(from_attributes=True)


class ImportHistoryListResponse(BaseModel):
    """Paginated list of import history records."""
    items: list[ImportHistoryResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ============ Import Settings Schemas ============

class ImportSettingsResponse(BaseModel):
    """Import settings configuration."""
    id: int
    allowed_formats: str
    default_format: str
    auto_merge_duplicates: bool
    keep_separate: bool
    skip_empty_conversations: bool
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ImportSettingsUpdate(BaseModel):
    """Import settings update payload."""
    allowed_formats: str | None = None
    default_format: str | None = None
    auto_merge_duplicates: bool | None = None
    keep_separate: bool | None = None
    skip_empty_conversations: bool | None = None


# ============ Duplicate Detection Schemas ============

class DuplicateConversation(BaseModel):
    """Conversation info for duplicate detection."""
    id: int
    source: str
    source_id: str | None
    title: str | None
    created_at: datetime | None
    updated_at: datetime | None
    message_count: int

    model_config = ConfigDict(from_attributes=True)


class DuplicateGroup(BaseModel):
    """A group of duplicate conversations."""
    key: str
    source: str
    source_id: str | None
    title: str | None
    count: int
    conversations: list[DuplicateConversation]
    total_messages: int


class DuplicateGroupsResponse(BaseModel):
    """Response containing all duplicate groups."""
    groups: list[DuplicateGroup]
    total_duplicates: int
    total_groups: int
    strategy: str


# ============ Bulk Operations Schemas ============

class BulkDeleteRequest(BaseModel):
    """Request to delete multiple conversations."""
    conversation_ids: list[int]


class BulkDeleteResponse(BaseModel):
    """Response from bulk delete operation."""
    deleted_count: int
    deleted_ids: list[int]
    failed_ids: list[int] = []


# ============ Auto-Tagging Schemas ============

class AutoTagRequest(BaseModel):
    """Request to auto-tag conversations."""
    conversation_ids: list[int] | None = None  # If None, tag all conversations
    overwrite_existing: bool = False  # Whether to overwrite manually added tags


class AutoTagResponse(BaseModel):
    """Response from auto-tagging operation."""
    tagged_count: int
    conversation_ids: list[int]
    tags_added: dict[str, int]  # tag_name -> count
````

## File: backend/app/database.py
````python
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def _build_postgresql_url() -> str | None:
    """Construct a PostgreSQL connection URL from environment variables.

    Priority:
    1. DATABASE_URL  – paste the full connection string directly (e.g. from
       Supabase Dashboard → Settings → Database → Connection string → URI).
       Use the *Session Pooler* or *Transaction Pooler* URL for IPv4 support.
    2. Derived from SUPABASE_URL + SUPABASE_DB_PASSWORD (legacy direct host).
    """
    # 1. Direct DATABASE_URL override
    direct_url = os.getenv("DATABASE_URL")
    if direct_url:
        return direct_url

    # 2. Derive from Supabase project URL
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return None

    try:
        project_ref = SUPABASE_URL.replace("https://", "").replace("http://", "").split(".")[0]
        db_password = os.getenv("SUPABASE_DB_PASSWORD") or SUPABASE_SERVICE_ROLE_KEY
        if not os.getenv("SUPABASE_DB_PASSWORD"):
            logging.warning(
                "SUPABASE_DB_PASSWORD not set, using service role key as fallback. "
                "For production, set a dedicated database password."
            )
        return f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
    except Exception:
        return None


def _make_engine(url: str, mode: str):
    if mode != "postgresql":
        raise ValueError("Only postgresql mode is supported")

    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


def _init_engine():
    """Initialize a PostgreSQL engine for Supabase and validate connectivity."""
    pg_url = _build_postgresql_url()
    if not pg_url:
        raise RuntimeError(
            "Supabase database is not configured. Set DATABASE_URL, or set "
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    try:
        eng = _make_engine(pg_url, "postgresql")
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        logging.info("Connected to PostgreSQL database.")
        return eng, "postgresql"
    except Exception as exc:
        raise RuntimeError(
            "PostgreSQL connection failed. Set DATABASE_URL in backend/.env to the "
            "Supabase Session/Transaction Pooler URI and verify credentials."
        ) from exc


engine, DATABASE_MODE = _init_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
````

## File: backend/app/models.py
````python
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(50), index=True)
    source_id: Mapped[str | None] = mapped_column(String(255), index=True)  # Original ID from export
    title: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    raw_json: Mapped[str] = mapped_column(Text)
    import_history_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("import_history.id", ondelete="SET NULL"), index=True
    )  # Track which import created this conversation
    project_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )  # Project/folder organization
    # Relationships
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )
    import_history: Mapped["ImportHistory | None"] = relationship(
        "ImportHistory", back_populates="conversations"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag", secondary="conversation_tags", back_populates="conversations"
    )
    project: Mapped["Project | None"] = relationship(
        "Project", back_populates="conversations"
    )


class Message(Base):
    __tablename__ = "messages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    source_id: Mapped[str | None] = mapped_column(String(255))  # Original message ID
    role: Mapped[str] = mapped_column(String(50), index=True)  # user, assistant, system, tool
    content: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(String(50), default="text")  # text, code, image, etc.
    created_at: Mapped[datetime | None] = mapped_column(DateTime)
    order_index: Mapped[int] = mapped_column(Integer)  # Position in conversation thread
    model: Mapped[str | None] = mapped_column(String(100))  # e.g., "gpt-4", "claude-3"
    
    # Relationship
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
    
    # Index for efficient message retrieval
    __table_args__ = (
        Index("ix_messages_conversation_order", "conversation_id", "order_index"),
    )


class ImportHistory(Base):
    __tablename__ = "import_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    source_location: Mapped[str | None] = mapped_column(String(500))  # File path or URL
    source_type: Mapped[str] = mapped_column(String(50), index=True)  # chatgpt, claude, etc.
    file_format: Mapped[str] = mapped_column(String(50))  # json, csv, xml
    status: Mapped[str] = mapped_column(String(50), index=True)  # success, failure, partial
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    imported_count: Mapped[int] = mapped_column(Integer, default=0)  # Number of conversations imported
    error_message: Mapped[str | None] = mapped_column(Text)  # Error details if failed
    
    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="import_history"
    )


class ImportSettings(Base):
    __tablename__ = "import_settings"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # File format preferences
    allowed_formats: Mapped[str] = mapped_column(String(255), default="json,csv,xml")  # Comma-separated
    default_format: Mapped[str] = mapped_column(String(50), default="json")
    
    # Import behavior
    auto_merge_duplicates: Mapped[bool] = mapped_column(Boolean, default=False)
    keep_separate: Mapped[bool] = mapped_column(Boolean, default=True)
    skip_empty_conversations: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Metadata
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Tag(Base):
    __tablename__ = "tags"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255))
    color: Mapped[str | None] = mapped_column(String(7))  # Hex color code, e.g., #3B82F6
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", secondary="conversation_tags", back_populates="tags"
    )


class ConversationTag(Base):
    __tablename__ = "conversation_tags"
    
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    auto_tagged: Mapped[bool] = mapped_column(Boolean, default=False)  # Whether tag was auto-assigned
    
    # Indexes for efficient querying
    __table_args__ = (
        Index("ix_conversation_tags_conversation", "conversation_id"),
        Index("ix_conversation_tags_tag", "tag_id"),
    )


class Project(Base):
    __tablename__ = "projects"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(500))
    color: Mapped[str | None] = mapped_column(String(7))  # Hex color code, e.g., #3B82F6
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="project"
    )
````

## File: README.md
````markdown
# ChatArchive

## A powerful, self-hosted tool to organize, search, and manage your LLM conversation history from ChatGPT, Claude, and other AI assistants.

![ChatArchive Preview](https://raw.githubusercontent.com/jimjamscott22/ChatArchive/main/ChatArchivescrnshtNew.png)

## 🌟 Features

- **Universal Import**: Support for ChatGPT, Claude, and other LLM export formats
- **Smart Search**: Full-text search with keyword filtering and advanced queries
- **Intelligent Tagging**: Automatic conversation categorization with 9 predefined tags (coding, education, writing, business, etc.)
- **Tag-Based Filtering**: Quickly find conversations by topic
- **Intuitive Organization**: Tag, categorize, and organize conversations effortlessly
- **Beautiful UI**: Clean, modern interface with dark/light mode support
- **Privacy First**: All data stays local - no cloud storage required
- **Export Options**: Export conversations to Markdown, JSON, or PDF
- **Advanced Analytics**: Visualize your conversation patterns and topics
- **Code Highlighting**: Automatic syntax highlighting for code snippets

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **uv** for Python environment and dependency management
- **npm** or **yarn**

### Current Status

This repo now includes a fully functional FastAPI + React application that supports importing conversations from multiple LLM platforms:
- ✅ ChatGPT (OpenAI) - Full support with tree-based message parsing
- ✅ Claude (Anthropic) - Full support with linear conversation format
- ✅ GitHub Copilot - Full support with flexible format handling
- ✅ Gemini/Bard (Google) - Full support with multiple export formats

All parsers are thoroughly tested with 78 unit and integration tests ensuring robust parsing and data normalization.

### ✨ New: Intelligent Tagging System

ChatArchive now includes automatic conversation categorization with 9 predefined tags:
- 🔵 **coding** - Programming and development
- 🟢 **education** - Academic topics and learning
- 🟣 **writing** - Creative writing and documentation
- 🟡 **productivity** - Task management and planning
- 🔴 **business** - Business and professional topics
- 🔵 **data-science** - ML, AI, and data analysis
- 🩷 **tech-support** - Troubleshooting and how-to
- 🟠 **creative** - Design and creative projects
- ⚫ **personal** - Personal conversations

See [Tagging Documentation](docs/TAGGING.md) for details on the classification algorithm and customization options.

### Next Steps

- Enhance search capabilities with semantic search using embeddings
- Implement export functionality (Markdown, PDF)
- Add analytics dashboard for conversation insights
- Create browser extension for auto-archiving

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jimjamscott22/chatarchive.git
   cd chatarchive
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install backend dependencies with uv**
   ```bash
   cd ../backend
   uv sync
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize the database**
   ```bash
   uv run python init_db.py
   ```

6. **Start the application with one script**
   ```bash
   ./run-chatarchive.sh
   ```

   This script starts:
   - a `uv sync` for the backend first
   - `npm install` for the frontend if `node_modules` is missing
   - the backend with `uv run python -m app.main`
   - the frontend with `npm run dev`

   If you prefer running them separately:
   ```bash
   cd backend
   uv run python -m app.main
   ```

   ```bash
   cd frontend
   npm run dev
   ```
# Find the process
```bash 
lsof -i :8000

# Kill it (replace PID with the actual process ID)
kill <PID>
```

7. **Open your browser**
   
   Navigate to `http://localhost:5173`

## 🗄️ Supabase Integration (Optional)

ChatArchive supports optional Supabase integration for cloud storage and PostgreSQL database, enabling multi-device access to your conversation history.

### Setting Up Supabase

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a free account
   - Create a new project and wait for it to initialize

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy your **Project URL** and **anon public** key
   - Go to Project Settings → API and copy your **service_role key**
   - Go to Project Settings → Database and copy your **database password** (or create a new one)

3. **Configure Environment Variables**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_DB_PASSWORD=your-database-password
   SUPABASE_BUCKET_NAME=chatarchive-exports
   ```
   
   **Security Note**: Always use a dedicated database password (`SUPABASE_DB_PASSWORD`) rather than reusing the service role key for enhanced security.

4. **Create Storage Bucket**
   - In Supabase Dashboard, go to Storage
   - Create a new bucket named `chatarchive-exports`
   - Set it to private (recommended)

5. **Initialize Database Schema**
   
   ChatArchive uses Supabase PostgreSQL directly. On startup, the app validates your database connection and creates the schema automatically on first run.

6. **Migrate Existing Data (Optional)**
   
   If you have existing conversations in SQLite and want to migrate to Supabase:
   ```bash
   cd backend
   python migrate_to_supabase.py
   ```

7. **Enable Full-Text Search (Optional, recommended)**
   
   For faster, relevance-ranked search instead of basic ILIKE:
   ```bash
   cd backend
   python migrate_add_fulltext_search.py
   ```

### Benefits of Supabase Integration

- ✅ **Cloud Storage**: Raw export files backed up to Supabase storage
- ✅ **PostgreSQL Database**: More robust than SQLite for large datasets
- ✅ **Multi-Device Access**: Access your conversations from multiple devices
- ✅ **Automatic Backups**: Supabase handles database backups
- ✅ **Real-time Sync**: Changes sync across devices (future feature)

### Supabase Dashboard Access

When Supabase is configured, a database icon will appear in the ChatArchive header. Click it to open your Supabase admin dashboard directly.

### Database Requirement

Supabase configuration is required. If credentials are missing or invalid, backend startup fails with a clear configuration error instead of falling back to a local database.

### Keeping Your Free-Tier Supabase Project Active

Free-tier Supabase projects are **paused automatically after 1 week of inactivity**. ChatArchive ships a lightweight keepalive script and a scheduled GitHub Actions workflow to prevent this.

#### How it works

`backend/keepalive_supabase.py` sends a single low-cost `SELECT id LIMIT 1` request to your Supabase project's REST API. The GitHub Actions workflow runs this script every 12 hours.

#### Required GitHub repository secrets

Add the following secrets in your GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://yourproject.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your project's `anon` / public API key |

#### Running manually

1. Go to **Actions → Supabase Keepalive** in your GitHub repository.
2. Click **Run workflow** to trigger it immediately.
3. Check the workflow logs to confirm `OK: Supabase keepalive succeeded`.

You can also run the script locally:

```bash
cd backend
SUPABASE_URL=https://yourproject.supabase.co \
SUPABASE_ANON_KEY=your-anon-key \
uv run python keepalive_supabase.py
```

Set `SUPABASE_KEEPALIVE_TABLE` to override the default table (`conversations`) used for the ping.

## 📦 Importing Your Chats

### ChatGPT
1. Go to ChatGPT Settings → Data Controls → Export Data
2. Download your data archive
3. In ChatArchive, click "Import" and select your `conversations.json` file

### Claude
1. Visit claude.ai/settings
2. Request your data export
3. Download the archive when ready
4. Import the JSON file into ChatArchive

### Other LLMs
Check our [Import Guide](docs/IMPORT_GUIDE.md) for detailed instructions on importing from various platforms.

## 🛠️ Tech Stack

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS for styling
- Lucide React for icons
- Vite for build tooling

**Backend:**
- Python 3.10+
- FastAPI for REST API
- Supabase PostgreSQL for storage
- Full-text search with FTS5

## 📖 Documentation

- [API Documentation](docs/API.md)
- [Import Guide](docs/IMPORT_GUIDE.md)
- [Tagging System](docs/TAGGING.md)
- [Development Setup](docs/DEVELOPMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## 🎯 Roadmap

- [x] Basic UI and layout
- [x] File import system
- [x] ChatGPT parser
- [x] Claude parser
- [x] Copilot parser
- [x] Gemini parser
- [x] Multi-platform import UI
- [x] Conversation list and detail views
- [x] Search functionality
- [x] Import history tracking
- [x] Comprehensive test coverage
- [x] Intelligent tagging system with 9 predefined categories
- [x] Tag-based filtering and organization
- [x] Full-text search (PostgreSQL tsvector with GIN index)
- [ ] Advanced filtering
- [ ] Semantic search with embeddings
- [ ] Conversation summaries
- [ ] Export functionality
- [x] Analytics dashboard
- [ ] Browser extension for auto-archiving
- [ ] Multi-user support
- [ ] Cloud sync (optional)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the GPL-3.0 license

## 🙏 Acknowledgments

- Inspired by the need for better LLM conversation management
- Built with modern web technologies
- Community-driven development

## 📧 Contact

Project Maintainer - [@jimjamscott22](https://github.com/jimjamscott22)

Project Link: [https://github.com/jimjamscott22/chatarchive](https://github.com/jimjamscott22/chatarchive)

---

⭐ Star this repo if you find it useful!

## 💡 Use Cases

- **Developers**: Archive coding conversations and solutions
- **Researchers**: Organize research discussions and findings
- **Writers**: Keep track of creative brainstorming sessions
- **Students**: Save educational conversations for later reference
- **Anyone**: Never lose an important AI conversation again!

## 🔒 Privacy & Security

- All data is stored locally on your machine
- No data is sent to external servers (unless you enable optional cloud sync)
- Open-source and auditable
- You own your data completely

## ⚡ Performance

- Handles thousands of conversations efficiently
- Fast search with indexing
- Lazy loading for smooth scrolling
- Optimized for large chat histories

## 🐛 Known Issues

See the [Issues](https://github.com/jimjamscott22/chatarchive/issues) page for current bugs and feature requests.

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/jimjamscott22/chatarchive?style=social)
![GitHub forks](https://img.shields.io/github/forks/jimjamscott22/chatarchive?style=social)
![GitHub issues](https://img.shields.io/github/issues/jimjamscott22/chatarchive)
![GitHub license](https://img.shields.io/github/license/jimjamscott22/chatarchive)
````

## File: frontend/src/styles.css
````css
:root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --bg-primary: #0a0e1a;
  --bg-secondary: #131824;
  --bg-tertiary: #1a1f2e;
  --app-background: var(--bg-primary);
  --text-primary: #f0f6fc;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --border-color: #1f2937;
  --accent: #3b82f6;
  --accent-hover: #60a5fa;
  --accent-subtle: rgba(59, 130, 246, 0.1);
  --surface-panel: rgba(19, 24, 36, 0.72);
  --surface-panel-strong: rgba(19, 24, 36, 0.92);
  --surface-elevated: rgba(10, 14, 26, 0.78);
  --hero-gradient: linear-gradient(135deg, rgba(19, 24, 36, 0.94), rgba(10, 14, 26, 0.96));
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --gradient-subtle: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  --gradient-accent: linear-gradient(135deg, var(--accent), var(--accent-hover));
  --chatgpt-color: #10a37f;
  --claude-color: #d97757;
  --gemini-color: #4285f4;
  --copilot-color: #8957e5;
}

[data-theme="light"] {
  --bg-primary: #e9f1ef;
  --bg-secondary: #dbe7e4;
  --bg-tertiary: #cfdfdc;
  --app-background: radial-gradient(circle at 16% 8%, rgba(105, 150, 169, 0.18), transparent 50%), linear-gradient(180deg, #eef6f4 0%, #dde9e6 100%);
  --text-primary: #1a2b31;
  --text-secondary: #3f5a62;
  --text-muted: #617981;
  --border-color: #bfd1d4;
  --accent: #335f73;
  --accent-hover: #46768b;
  --accent-subtle: rgba(51, 95, 115, 0.16);
  --surface-panel: rgba(217, 229, 226, 0.84);
  --surface-panel-strong: rgba(208, 222, 219, 0.95);
  --surface-elevated: rgba(197, 215, 211, 0.88);
  --hero-gradient: linear-gradient(135deg, rgba(219, 231, 228, 0.97), rgba(199, 216, 212, 0.99));
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --gradient-subtle: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  --gradient-accent: linear-gradient(135deg, var(--accent), var(--accent-hover));
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--app-background);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
}

.app-container {
  display: flex;
  min-height: 100vh;
  height: 100%;
  overflow: hidden;
}

/* Full-page scroll: allow the app to scroll when content overflows */
.app-container.scrollable {
  overflow-y: auto;
  overflow-x: hidden;
}

/* Standalone conversation view (opened in new window) */
.app-container.standalone-view {
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.standalone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--gradient-subtle);
  flex-shrink: 0;
}

.standalone-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.back-link {
  text-decoration: none;
  color: var(--accent);
  font-size: 14px;
}

.back-link:hover {
  color: var(--accent-hover);
  text-decoration: underline;
}

.standalone-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ===== SIDEBAR ===== */
.sidebar {
  width: 260px;
  background: var(--gradient-subtle);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s ease;
  position: relative;
  flex-shrink: 0;
}

/* Hide sidebar entirely in full-width mode */
.sidebar-hidden .sidebar {
  width: 0;
  border-right: none;
  overflow: hidden;
}

/* Sidebar collapse handle - a small tab on the right edge */
.sidebar-collapse-handle {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 40px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 6px 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  z-index: 20;
  transition: background 0.2s, color 0.2s;
  padding: 0;
}

.sidebar-collapse-handle:hover {
  background: var(--bg-tertiary);
  color: var(--accent);
}

.sidebar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, var(--accent), transparent);
  opacity: 0.3;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar.collapsed .sidebar-top,
.sidebar.collapsed .sidebar-list,
.sidebar.collapsed .pagination-controls {
  display: none;
}

.sidebar-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.logo svg {
  color: var(--accent);
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.icon-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.1;
  transform: translate(-50%, -50%);
  transition: all 0.3s ease;
}

.icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.icon-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.icon-btn:hover::before {
  width: 32px;
  height: 32px;
}

.supabase-link {
  color: var(--text-secondary);
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.supabase-link:hover {
  color: #3ecf8e; /* Supabase brand green */
}

.search-box {
  margin: 12px;
  position: relative;
}

.sidebar-top {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.sidebar-panel {
  margin: 0 12px;
  padding: 14px;
  background: var(--surface-panel);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.sidebar-primary-panel {
  background:
    radial-gradient(circle at top right, var(--accent-subtle), transparent 55%),
    var(--surface-panel-strong);
}

.sidebar-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.sidebar-panel-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.sidebar-panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-panel-meta {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 4px 8px;
  white-space: nowrap;
}

.sidebar-inline-action {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.sidebar-inline-action:hover {
  color: var(--accent-hover);
}

.sidebar-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.sidebar-summary-card {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-elevated);
  border: 1px solid var(--border-color);
}

.sidebar-summary-card strong {
  display: block;
  margin-top: 6px;
  font-size: 16px;
  color: var(--text-primary);
}

.sidebar-summary-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search-box input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px 10px 36px;
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-box input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-tertiary);
  box-shadow: 0 0 0 3px rgba(47, 129, 247, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.search-box input::placeholder {
  color: var(--text-muted);
  transition: opacity 0.3s ease;
}

.search-box input:focus::placeholder {
  opacity: 0.5;
}

.search-box input::placeholder {
  color: var(--text-muted);
}

.import-btn {
  margin: 0;
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: white;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.3);
}

.sidebar-panel .import-btn {
  width: 100%;
}

.import-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.import-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(47, 129, 247, 0.4);
}

.import-btn:hover::before {
  left: 100%;
}

.import-btn:active {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.4);
}

.settings-btn {
  margin: 0 12px 12px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.settings-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(47, 129, 247, 0.1), transparent);
  transition: left 0.5s ease;
}

.settings-btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent);
  color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.settings-btn:hover::before {
  left: 100%;
}

.settings-btn:active {
  transform: translateY(0);
}

.source-filter {
  padding: 0;
}

.source-filter label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.source-filter select {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.source-filter select:focus {
  outline: none;
  border-color: var(--accent);
}

.source-filter select:hover {
  background: var(--bg-tertiary);
}

/* Conversation Statistics */
.conversation-stats {
  padding: 0 12px 12px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 8px;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.stats-header:hover {
  background: var(--bg-tertiary);
}

.stats-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-toggle {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.stats-content {
  padding: 8px 0;
  background: var(--bg-primary);
  border-radius: 8px;
  margin-top: 4px;
  border: 1px solid var(--border-color);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
}

.stat-label {
  color: var(--text-secondary);
}

.stat-value {
  color: var(--text-primary);
  font-weight: 600;
}

.source-breakdown {
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
}

.source-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 11px;
}

.source-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.source-count {
  color: var(--text-primary);
  font-weight: 500;
}

.conversations-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--border-color);
}

.pagination-btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 12px;
  color: var(--text-muted);
}

.conversations-list::-webkit-scrollbar {
  width: 6px;
}

.conversations-list::-webkit-scrollbar-track {
  background: transparent;
}

.conversations-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.conversation-card {
  padding: 16px;
  margin-bottom: 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  position: relative;
  overflow: visible;
}

.conversation-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.conversation-card:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.conversation-card:hover::before {
  opacity: 1;
}

.conversation-card.active {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.2);
}

.conversation-card.active::before {
  opacity: 1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 12px;
}

.card-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.source-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.source-avatar[data-source="chatgpt"] {
  background: linear-gradient(135deg, var(--chatgpt-color), #0d8f6a);
}

.source-avatar[data-source="claude"] {
  background: linear-gradient(135deg, var(--claude-color), #c96540);
}

.source-avatar[data-source="gemini"] {
  background: linear-gradient(135deg, var(--gemini-color), #2c5aa0);
}

.source-avatar[data-source="copilot"] {
  background: linear-gradient(135deg, var(--copilot-color), #6c42cc);
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.conv-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  flex-wrap: wrap;
}

.conv-time {
  font-weight: 500;
}

.conv-stats {
  display: flex;
  align-items: center;
  gap: 4px;
}

.conv-stats::before {
  content: '•';
  color: var(--border-color);
}

.conv-stats:first-of-type::before {
  display: none;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.open-new-window-btn {
  padding: 6px 12px;
  font-size: 12px;
}

.sidebar-filters {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sidebar-tools-panel {
  margin-bottom: 4px;
}

.sidebar-tool-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sidebar-tool-btn {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.sidebar-tool-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  transform: translateY(-1px);
}

.sidebar-tool-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sidebar-tool-btn-accent {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.sidebar-tool-btn-accent:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.center-card .card-right {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.card-preview {
  margin-bottom: 12px;
}

.conv-preview {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Legacy conversation-item styles for backward compatibility */
.conversation-item {
  padding: 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.conversation-item:hover {
  background: var(--bg-tertiary);
}

.conversation-item.active {
  background: var(--bg-tertiary);
  border-color: var(--accent);
}

.conv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.conv-date {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.conv-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  transition: all 0.2s ease;
}

.tag:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  color: var(--text-primary);
}

.tag.source {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(47, 129, 247, 0.3);
}

.tag.source[data-source="chatgpt"] {
  background: linear-gradient(135deg, var(--chatgpt-color), #0d8f6a);
  border-color: var(--chatgpt-color);
  box-shadow: 0 2px 4px rgba(16, 163, 127, 0.3);
}

.tag.source[data-source="claude"] {
  background: linear-gradient(135deg, var(--claude-color), #c96540);
  border-color: var(--claude-color);
  box-shadow: 0 2px 4px rgba(217, 119, 87, 0.3);
}

.tag.source[data-source="gemini"] {
  background: linear-gradient(135deg, var(--gemini-color), #2c5aa0);
  border-color: var(--gemini-color);
  box-shadow: 0 2px 4px rgba(66, 133, 244, 0.3);
}

.tag.source[data-source="copilot"] {
  background: linear-gradient(135deg, var(--copilot-color), #6c42cc);
  border-color: var(--copilot-color);
  box-shadow: 0 2px 4px rgba(137, 87, 229, 0.3);
}

.loading, .empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* Skeleton Loader */
.skeleton-container {
  padding: 8px;
}

.skeleton-card {
  padding: 16px;
  margin-bottom: 8px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.skeleton-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.skeleton-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--bg-tertiary) 0%, var(--border-color) 50%, var(--bg-tertiary) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-info {
  flex: 1;
}

.skeleton-title {
  width: 60%;
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--bg-tertiary) 0%, var(--border-color) 50%, var(--bg-tertiary) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  margin-bottom: 6px;
}

.skeleton-meta {
  width: 40%;
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--bg-tertiary) 0%, var(--border-color) 50%, var(--bg-tertiary) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-preview {
  width: 80%;
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--bg-tertiary) 0%, var(--border-color) 50%, var(--bg-tertiary) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Empty States */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state h3 {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 8px;
  font-weight: 600;
}

.empty-state p {
  font-size: 14px;
  margin-bottom: 24px;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.empty-action-btn {
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: white;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.3);
  margin: 0 auto;
}

.empty-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(47, 129, 247, 0.4);
}

.empty-action-btn:active {
  transform: translateY(-1px);
}

/* ===== MAIN CONTENT ===== */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  position: relative;
}

.main-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100vh;
  background: radial-gradient(circle at 20% 50%, var(--accent-subtle) 0%, transparent 50%);
  pointer-events: none;
  opacity: 0.5;
}

.main-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--gradient-subtle);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
  position: relative;
  z-index: 10;
}

.main-header-top {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
}

.main-header-leading {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.main-header-text {
  flex: 1;
  min-width: 0;
}

.header-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.header-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.header-subtitle {
  margin-top: 8px;
  max-width: 72ch;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.header-actions {
  position: relative;
  flex-shrink: 0;
}

.header-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.keyboard-shortcut-hint {
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.keyboard-shortcut-hint:hover {
  opacity: 1;
}

.keyboard-hint {
  font-size: 12px;
  filter: grayscale(0.3);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  min-width: 200px;
  z-index: 100;
  overflow: hidden;
  transform: translateY(-8px);
  opacity: 0;
  animation: dropdownSlide 0.2s ease forwards;
  backdrop-filter: blur(8px);
}

@keyframes dropdownSlide {
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item:hover {
  background: var(--bg-tertiary);
}

.menu-item svg {
  color: var(--text-secondary);
}

.main-header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex-wrap: wrap;
}

.header-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1;
}

.project-pill {
  border: none;
  color: white;
  cursor: pointer;
}

.source-pill {
  font-weight: 600;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.content-area-scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.overview-layout {
  max-width: 1080px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.overview-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 28px;
  border-radius: 24px;
  border: 1px solid var(--border-color);
  background:
    radial-gradient(circle at top right, var(--accent-subtle), transparent 45%),
    var(--hero-gradient);
  box-shadow: var(--shadow-lg);
}

.overview-hero-copy {
  max-width: 680px;
}

.overview-kicker {
  display: inline-block;
  margin-bottom: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent-hover);
}

.overview-title {
  font-size: 32px;
  line-height: 1.1;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.overview-description {
  max-width: 60ch;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.overview-hero-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  min-width: 210px;
}

.overview-secondary-btn {
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.overview-secondary-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  transform: translateY(-1px);
}

.center-skeleton {
  max-width: 1080px;
  margin: 0 auto;
  width: 100%;
}

.overview-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.overview-stat-card {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--surface-panel);
  box-shadow: var(--shadow-sm);
}

.overview-stat-card strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
  color: var(--text-primary);
}

.overview-stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.overview-panels {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
  gap: 16px;
}

.overview-panel {
  padding: 20px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--surface-panel);
  box-shadow: var(--shadow-sm);
}

.overview-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.overview-panel-header h3 {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.overview-panel-header p {
  font-size: 13px;
  color: var(--text-secondary);
}

.overview-recent-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overview-conversation-card {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.overview-conversation-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--bg-secondary);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.overview-conversation-main:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  transform: translateY(-1px);
}

.overview-conversation-copy {
  min-width: 0;
}

.overview-conversation-copy h4 {
  font-size: 15px;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.overview-conversation-copy p {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.overview-conversation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.overview-conversation-launch {
  align-self: center;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.overview-focus-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.overview-section-label {
  display: block;
  margin-bottom: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.overview-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.overview-chip {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
}

.overview-empty-copy {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.overview-mini-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.overview-mini-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.overview-mini-stat strong {
  font-size: 20px;
  color: var(--text-primary);
}

.overview-mini-stat span {
  font-size: 12px;
  color: var(--text-secondary);
}

.overview-source-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.overview-source-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.overview-source-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

.overview-empty-panel {
  grid-column: 1 / -1;
}

.overview-checklist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.overview-onboarding-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.overview-onboarding-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.overview-check-item {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  line-height: 1.5;
}

.content-area::-webkit-scrollbar {
  width: 8px;
}

.content-area::-webkit-scrollbar-track {
  background: transparent;
}

.content-area::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

/* Welcome State */
.welcome-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-secondary);
  padding: 40px;
}

.welcome-icon {
  color: var(--accent);
  margin-bottom: 24px;
  opacity: 0.8;
  font-size: 64px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.welcome-state h2 {
  font-size: 32px;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--text-primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-state p {
  font-size: 16px;
  color: var(--text-secondary);
  max-width: 500px;
  line-height: 1.6;
  margin-bottom: 32px;
}

/* Conversation View */
.conversation-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 0;
}

.message {
  margin-bottom: 32px;
  padding: 20px;
  border-radius: 16px;
  background: var(--gradient-subtle);
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
  position: relative;
  box-shadow: var(--shadow-md);
}

.message:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.message.user {
  background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
  border-left: 3px solid var(--accent);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.message.user:hover {
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.15);
}

.message.assistant {
  background: var(--gradient-subtle);
  border-left: 3px solid transparent;
}

.message-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.message-avatar {
  flex-shrink: 0;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.3);
}

.assistant-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.assistant-avatar[data-source="chatgpt"] {
  background: linear-gradient(135deg, var(--chatgpt-color), #0d8f6a);
}

.assistant-avatar[data-source="claude"] {
  background: linear-gradient(135deg, var(--claude-color), #c96540);
}

.assistant-avatar[data-source="gemini"] {
  background: linear-gradient(135deg, var(--gemini-color), #2c5aa0);
}

.assistant-avatar[data-source="copilot"] {
  background: linear-gradient(135deg, var(--copilot-color), #6c42cc);
}

.message-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-role {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.message-time {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-number {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.message-content {
  color: var(--text-primary);
  line-height: 1.7;
  margin-left: 56px;
  padding: 16px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  position: relative;
}

.message-content::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 20px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 8px 8px 8px 0;
  border-color: transparent var(--bg-primary) transparent transparent;
}

.message-content p {
  margin: 0 0 12px;
}

.message-content p:last-child {
  margin-bottom: 0;
}

/* Markdown content styling */
.markdown-content p {
  margin: 0 0 12px;
}

.markdown-content p:last-child {
  margin-bottom: 0;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  margin: 20px 0 12px;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-content h1:first-child,
.markdown-content h2:first-child,
.markdown-content h3:first-child {
  margin-top: 0;
}

.markdown-content h1 { font-size: 1.8em; }
.markdown-content h2 { font-size: 1.5em; }
.markdown-content h3 { font-size: 1.3em; }
.markdown-content h4 { font-size: 1.1em; }

.markdown-content ul,
.markdown-content ol {
  margin: 0 0 12px;
  padding-left: 24px;
}

.markdown-content li {
  margin: 4px 0;
}

.markdown-content blockquote {
  border-left: 3px solid var(--border-color);
  padding-left: 16px;
  margin: 12px 0;
  color: var(--text-secondary);
  font-style: italic;
}

.markdown-content code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.9em;
}

.markdown-content pre {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 16px;
  margin: 12px 0;
  overflow-x: auto;
}

.markdown-content pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.875em;
  line-height: 1.6;
}

.markdown-content a {
  color: var(--accent);
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}

.markdown-content table {
  border-collapse: collapse;
  margin: 12px 0;
  width: 100%;
}

.markdown-content th,
.markdown-content td {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

.markdown-content th {
  background: var(--bg-tertiary);
  font-weight: 600;
}

.markdown-content hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 20px 0;
}

.markdown-content img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 12px 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  min-width: 400px;
  max-width: 90vw;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  transform: scale(0.9) translateY(20px);
  opacity: 0;
  animation: modalSlide 0.3s ease forwards;
}

@keyframes modalSlide {
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.import-modal {
  min-width: 500px;
}

.modal h2 {
  margin: 0 0 20px;
  font-size: 20px;
}

.modal form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.source-select,
.file-input {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.source-select {
  cursor: pointer;
}

.source-select:focus,
.file-input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-tertiary);
}

.source-description {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.file-name {
  margin: 0;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.import-info {
  padding: 10px 12px;
  background: rgba(47, 129, 247, 0.1);
  border: 1px solid rgba(47, 129, 247, 0.3);
  border-radius: 6px;
  font-size: 12px;
  color: var(--accent);
  margin-top: 12px;
}

.export-help {
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-top: 8px;
}

.export-help summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
  list-style: none;
}

.export-help summary::-webkit-details-marker {
  display: none;
}

.export-help summary::before {
  content: '▶';
  display: inline-block;
  margin-right: 8px;
  transition: transform 0.2s;
  font-size: 10px;
}

.export-help[open] summary::before {
  transform: rotate(90deg);
}

.export-help summary:hover {
  color: var(--accent);
}

.export-help ol {
  margin: 12px 0 0 20px;
  padding: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.export-help ol li {
  margin: 6px 0;
}

.export-link {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.export-link:hover {
  background: var(--accent-hover);
  transform: translateX(2px);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal button {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.modal button:hover {
  background: var(--bg-primary);
}

.modal button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.modal button.primary:hover {
  background: var(--accent-hover);
}

.modal button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal button:disabled:hover {
  background: var(--accent);
}

.status-success {
  margin-top: 12px;
  padding: 12px;
  background: #1a4d2e;
  border: 1px solid #2d7a4f;
  border-radius: 6px;
  color: #4ade80;
  font-size: 13px;
}

.status-error {
  margin-top: 12px;
  padding: 12px;
  background: #4d1a1a;
  border: 1px solid #7a2d2d;
  border-radius: 6px;
  color: #f87171;
  font-size: 13px;
}

/* ===== SETTINGS BUTTON ===== */
.settings-btn {
  width: 100%;
  padding: 10px 14px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.settings-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
}

/* ===== SETTINGS MODAL ===== */
.settings-modal {
  width: 800px;
  max-width: 90vw;
  min-width: 320px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
}

.close-btn:hover {
  color: var(--text-primary);
}

.settings-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 20px;
}

.settings-tabs button {
  padding: 10px 20px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.settings-tabs button:hover {
  color: var(--text-primary);
}

.settings-tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  max-height: calc(85vh - 150px);
}

.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  padding: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.settings-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-group input[type="text"],
.form-group select {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
}

.form-group input[type="text"]:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group.checkbox {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group.checkbox label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 0;
}

.form-group.checkbox input[type="checkbox"] {
  margin-top: 2px;
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.form-group small {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* ===== HISTORY PANEL ===== */
.history-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-header {
  margin-bottom: 8px;
}

.history-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.text-muted {
  color: var(--text-muted);
  font-size: 13px;
}

.history-list {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table thead {
  border-bottom: 2px solid var(--border-color);
}

.history-table th {
  text-align: left;
  padding: 12px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.history-table td {
  padding: 12px 8px;
  font-size: 13px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.history-table tbody tr:last-child td {
  border-bottom: none;
}

.history-table tbody tr:hover {
  background: var(--bg-secondary);
}

.history-table .filename {
  font-family: monospace;
  font-size: 12px;
}

.error-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.error-details h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #ef4444;
}

.error-item {
  padding: 8px;
  margin-bottom: 8px;
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
  border-radius: 4px;
  font-size: 12px;
}

.error-item strong {
  color: var(--text-primary);
  margin-right: 4px;
}

.modal button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== DUPLICATES MODAL ===== */
.duplicates-btn {
  width: 100%;
  padding: 10px 14px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.duplicates-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
}

.analytics-btn {
  width: 100%;
  padding: 10px 14px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.analytics-btn:hover {
  background: var(--bg-tertiary);
  border-color: #3B82F6;
  color: #3B82F6;
}

.duplicates-modal {
  width: 900px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.strategy-selector {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.strategy-selector label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
}

.strategy-selector select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.strategy-selector select:focus {
  outline: none;
  border-color: var(--accent);
}

.duplicates-summary {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 16px;
}

.duplicates-summary .stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.duplicates-summary .label {
  font-size: 12px;
  color: var(--text-secondary);
}

.duplicates-summary .value {
  font-size: 24px;
  font-weight: 600;
  color: var(--accent);
}

.duplicates-content {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
}

.duplicate-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.duplicate-group {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-secondary);
}

.group-header {
  padding: 16px;
  background: var(--bg-tertiary);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
}

.group-header:hover {
  background: var(--bg-secondary);
}

.group-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 600;
}

.group-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.expand-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 0.2s;
}

.expand-btn:hover {
  color: var(--text-primary);
}

.group-content {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.group-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.group-actions button {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.group-actions button:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
}

.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.duplicate-conversation {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  transition: all 0.2s;
}

.duplicate-conversation:hover {
  border-color: var(--accent);
  background: var(--bg-secondary);
}

.duplicate-conversation input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.duplicate-conversation .conv-info {
  flex: 1;
}

.duplicate-conversation .conv-title {
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.duplicate-conversation .conv-details {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

button.danger {
  background: #ef4444 !important;
  border-color: #ef4444 !important;
  color: white !important;
}

button.danger:hover:not(:disabled) {
  background: #dc2626 !important;
  border-color: #dc2626 !important;
}

button.danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Virtual List Optimizations */
.virtual-list {
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

.virtual-list > div {
  will-change: transform;
}

/* Tag Styles */
.tag-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.tag-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.card-tags .tag-badge {
  font-size: 11px;
  padding: 3px 8px;
}

.tag-remove {
  font-size: 14px;
  font-weight: bold;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-filter {
  padding: 0;
}

.tag-filter label {
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 6px;
  font-weight: 500;
}

.tag-filter select {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tag-filter select:hover {
  border-color: var(--accent);
}

.tag-filter select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.manage-tags-btn {
  width: 100%;
  padding: 10px 14px;
  margin: 0 16px 12px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.manage-tags-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
}

.auto-tag-btn {
  padding: 10px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  margin: 12px 16px;
}

.auto-tag-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.auto-tag-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.conversation-tags-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.conversation-tags-header .tag-badge {
  font-size: 13px;
}

.search-highlight {
  background: rgba(250, 204, 21, 0.35);
  color: inherit;
  border-radius: 4px;
  padding: 0 2px;
}

/* ===== TAG MANAGER MODAL ===== */
.tag-manager-modal {
  width: 860px;
  max-width: 92vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tag-manager-content {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 20px;
}

.tag-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
}

.tag-color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tag-color-row input[type="color"] {
  width: 40px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.tag-preview {
  padding: 6px 12px;
  border-radius: 999px;
  color: white;
  font-size: 12px;
  font-weight: 600;
}

.tag-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.tag-list {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.tag-list-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tag-list-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tag-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.tag-row-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.tag-row-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.tag-row-name {
  font-size: 13px;
  font-weight: 600;
}

.tag-row-meta {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.tag-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-row-actions button {
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-row-actions button:hover {
  border-color: var(--accent);
}

.tag-count {
  font-size: 11px;
  color: var(--text-secondary);
}

/* ===== PROJECT FILTER & MANAGE PROJECTS BUTTON ===== */
.project-filter {
  padding: 0;
}

.project-filter label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.project-filter select {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.project-filter select:focus {
  outline: none;
  border-color: var(--accent);
}

.project-filter select:hover {
  background: var(--bg-tertiary);
}

.manage-projects-btn {
  width: 100%;
  padding: 10px 14px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.manage-projects-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
}

/* Drag and drop */
.conversation-card[draggable="true"] {
  cursor: grab;
}

.conversation-card[draggable="true"]:active {
  cursor: grabbing;
}

.conversation-card.dragging {
  opacity: 0.45;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.project-drop-zones {
  margin: 8px 0 4px;
}

.project-drop-zones label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 6px;
  padding: 0 4px;
}

.project-drop-zone {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px dashed var(--border-color);
  border-left: 3px solid transparent;
  margin-bottom: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  user-select: none;
}

.project-drop-zone:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.project-drop-zone.drag-over {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  border-left-color: var(--accent);
  color: var(--text-primary);
  transform: scale(1.02);
}

.drag-mode .project-drop-zone {
  border-style: dashed;
  animation: pulse-border 1.2s ease-in-out infinite alternate;
}

.drag-mode .project-drop-zone.drag-over {
  animation: none;
}

@keyframes pulse-border {
  from { border-color: var(--border-color); }
  to { border-color: var(--accent); }
}

.project-drop-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .overview-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-panels {
    grid-template-columns: 1fr;
  }

  .tag-manager-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1024px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(320px, calc(100vw - 32px));
    z-index: 40;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    transition: transform 0.3s ease;
  }

  .sidebar.collapsed,
  .sidebar-hidden .sidebar {
    width: min(320px, calc(100vw - 32px));
    transform: translateX(-100%);
  }

  .sidebar-collapse-handle {
    display: none;
  }

  .main-content {
    width: 100%;
  }

  .main-header-top {
    flex-wrap: wrap;
  }

  .main-header-text {
    min-width: min(100%, 460px);
  }

  .overview-hero {
    flex-direction: column;
  }

  .overview-hero-actions {
    min-width: 0;
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }
}

@media (max-width: 720px) {
  .content-area {
    padding: 16px;
  }

  .main-header {
    padding: 14px 16px;
  }

  .header-title {
    font-size: 20px;
  }

  .overview-title {
    font-size: 26px;
  }

  .overview-stats-grid {
    grid-template-columns: 1fr;
  }

  .sidebar-tool-grid {
    grid-template-columns: 1fr;
  }

  .message {
    padding: 16px;
    margin-bottom: 20px;
  }

  .message-header {
    gap: 12px;
    margin-bottom: 12px;
  }

  .message-content {
    margin-left: 0;
    padding: 14px;
  }

  .message-content::before {
    display: none;
  }

  .modal,
  .import-modal {
    min-width: 0;
    width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    padding: 18px;
  }

  .standalone-header {
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
  }
}

@media (max-width: 560px) {
  .sidebar-panel,
  .search-box {
    margin-left: 8px;
    margin-right: 8px;
  }

  .sidebar {
    width: calc(100vw - 16px);
  }

  .sidebar.collapsed,
  .sidebar-hidden .sidebar {
    width: calc(100vw - 16px);
  }

  .overview-conversation-card {
    flex-direction: column;
  }

  .overview-conversation-launch {
    align-self: flex-end;
  }

  .main-header-meta {
    align-items: stretch;
  }

  .header-meta-pill {
    width: 100%;
    justify-content: center;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal button {
    width: 100%;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-filter-chip,
.project-badge-btn {
  border: none;
}

.move-project-summary {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-tertiary);
}

.shortcut-modal {
  max-width: 560px;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-tertiary);
}

.shortcut-row span {
  color: var(--text-secondary);
}

.shortcut-row kbd {
  min-width: 132px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  font-family: "Consolas", "Monaco", monospace;
}

.analytics-modal {
  max-width: 960px;
}

.analytics-layout {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.analytics-state {
  text-align: center;
  padding: 48px 0;
  color: var(--text-secondary);
}

.analytics-card-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.analytics-card {
  padding: 20px 24px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.analytics-card-value {
  font-size: 28px;
  font-weight: 700;
}

.analytics-card-label {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.analytics-card-blue .analytics-card-value {
  color: #3B82F6;
}

.analytics-card-green .analytics-card-value {
  color: #10B981;
}

.analytics-card-amber .analytics-card-value {
  color: #F59E0B;
}

.analytics-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analytics-section-title {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.analytics-two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.analytics-empty {
  color: var(--text-muted);
  font-size: 13px;
}

.overview-action-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.overview-chip-button {
  cursor: pointer;
}

.icon-btn:focus-visible,
.import-btn:focus-visible,
.settings-btn:focus-visible,
.sidebar-tool-btn:focus-visible,
.pagination-btn:focus-visible,
.conversation-card:focus-visible,
.overview-conversation-main:focus-visible,
.project-drop-zone:focus-visible,
.tag-filter-chip:focus-visible,
.project-badge-btn:focus-visible,
.menu-item:focus-visible,
.close-btn:focus-visible,
.modal button:focus-visible,
.search-box input:focus-visible,
.source-filter select:focus-visible,
.tag-filter select:focus-visible,
.project-filter select:focus-visible,
.strategy-selector select:focus-visible,
.form-group input:focus-visible,
.form-group select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .overview-onboarding-grid,
  .overview-mini-stat-grid,
  .analytics-card-row,
  .analytics-two-column {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .conversation-card {
    padding: 14px;
  }

  .card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .card-right {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .project-badge-btn,
  .tag-filter-chip {
    max-width: 100%;
  }

  .shortcut-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .overview-action-grid .overview-secondary-btn {
    width: 100%;
  }
}
````

## File: backend/app/main.py
````python
from __future__ import annotations

import json
import logging
import sys
import threading
import time
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session, joinedload
import uvicorn

from app.database import get_db, DATABASE_MODE
from app.importers.chatgpt import parse_chatgpt_export
from app.importers.claude import parse_claude_export
from app.importers.gemini import parse_gemini_export
from app.importers.copilot import parse_copilot_export
from app.models import Base, Conversation, Message, ImportHistory, ImportSettings, Tag, ConversationTag, Project
from app.supabase_client import get_connection_info, get_dashboard_url, is_supabase_configured
from app.storage import upload_export_file, list_storage_files
from app.query_filters import apply_conversation_filters
from app.schemas import (
    ConversationResponse,
    ConversationDetail,
    ConversationListResponse,
    ImportHistoryResponse,
    ImportHistoryListResponse,
    ImportSettingsResponse,
    ImportSettingsUpdate,
    DuplicateConversation,
    DuplicateGroup,
    DuplicateGroupsResponse,
    BulkDeleteRequest,
    BulkDeleteResponse,
    TagCreate,
    TagUpdate,
    TagResponse,
    TagListResponse,
    AddTagRequest,
    AutoTagRequest,
    AutoTagResponse,
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    MoveToProjectRequest,
)
from app.tagger import get_tagging_engine

logger = logging.getLogger(__name__)

app = FastAPI(title="ChatArchive API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ============ Conversation Endpoints ============

@app.get("/conversations", response_model=ConversationListResponse)
def list_conversations(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    source: str | None = Query(None, description="Filter by source (chatgpt, claude, etc)"),
    tag: str | None = Query(None, description="Filter by tag name"),
    project_id: int | None = Query(None, description="Filter by project ID (use -1 for uncategorized)"),
    sort_by: Literal["created_at", "updated_at", "title", "message_count"] = Query(
        "created_at", description="Field to sort by"
    ),
    sort_order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
) -> ConversationListResponse:
    """List all conversations with pagination and filtering."""
    
    query = db.query(Conversation).options(joinedload(Conversation.tags), joinedload(Conversation.project))

    query = apply_conversation_filters(query, source=source, tag=tag, project_id=project_id)

    # Get total count
    total = query.count()
    
    # Apply sorting
    sort_column = getattr(Conversation, sort_by)
    if sort_order == "desc":
        sort_column = sort_column.desc()
    query = query.order_by(sort_column.nulls_last())
    
    # Apply pagination
    offset = (page - 1) * page_size
    conversations = query.offset(offset).limit(page_size).all()
    
    # Calculate total pages
    pages = (total + page_size - 1) // page_size
    
    return ConversationListResponse(
        items=[ConversationResponse.model_validate(c) for c in conversations],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@app.get("/conversations/sources")
def list_sources(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """List all unique sources with conversation counts."""
    results = (
        db.query(Conversation.source, func.count(Conversation.id))
        .group_by(Conversation.source)
        .all()
    )
    return [{"source": source, "count": count} for source, count in results]


@app.get("/conversations/search", response_model=ConversationListResponse)
def search_conversations(
    db: Session = Depends(get_db),
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    source: str | None = Query(None, description="Filter by source"),
    tag: str | None = Query(None, description="Filter by tag name"),
    project_id: int | None = Query(None, description="Filter by project ID (use -1 for uncategorized)"),
    search_messages: bool = Query(True, description="Also search message content"),
) -> ConversationListResponse:
    """Search conversations by title and message content using full-text search."""
    try:
        return _search_conversations_fts(db, q, page, page_size, source, tag, project_id)
    except OperationalError:
        return _search_conversations_ilike(db, q, page, page_size, source, tag, project_id, search_messages)


def _search_conversations_fts(
    db: Session,
    q: str,
    page: int,
    page_size: int,
    source: str | None,
    tag: str | None,
    project_id: int | None,
) -> ConversationListResponse:
    """Full-text search using PostgreSQL tsvector (requires migrate_add_fulltext_search)."""
    query = (
        db.query(Conversation)
        .options(joinedload(Conversation.tags))
        .filter(text("conversations.search_vector @@ plainto_tsquery('english', :q)"))
        .params(q=q)
    )

    query = apply_conversation_filters(query, source=source, tag=tag, project_id=project_id)

    total = query.count()
    offset = (page - 1) * page_size
    conversations = (
        query.order_by(
            text("ts_rank(conversations.search_vector, plainto_tsquery('english', :q)) DESC"),
            Conversation.created_at.desc().nulls_last(),
        )
        .offset(offset)
        .limit(page_size)
        .all()
    )
    pages = (total + page_size - 1) // page_size
    return ConversationListResponse(
        items=conversations,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def _search_conversations_ilike(
    db: Session,
    q: str,
    page: int,
    page_size: int,
    source: str | None,
    tag: str | None,
    project_id: int | None,
    search_messages: bool,
) -> ConversationListResponse:
    """Fallback ILIKE search when full-text search is not available."""
    search_term = f"%{q}%"
    conditions = [Conversation.title.ilike(search_term)]
    if search_messages:
        message_match = (
            db.query(Message.conversation_id)
            .filter(Message.content.ilike(search_term))
            .distinct()
            .subquery()
        )
        conditions.append(Conversation.id.in_(db.query(message_match.c.conversation_id)))

    query = (
        db.query(Conversation)
        .options(joinedload(Conversation.tags))
        .filter(or_(*conditions))
    )

    query = apply_conversation_filters(query, source=source, tag=tag, project_id=project_id)

    total = query.count()
    offset = (page - 1) * page_size
    conversations = (
        query.order_by(
            Conversation.title.ilike(search_term).desc(),
            Conversation.created_at.desc().nulls_last(),
        )
        .offset(offset)
        .limit(page_size)
        .all()
    )
    pages = (total + page_size - 1) // page_size
    return ConversationListResponse(
        items=conversations,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@app.get("/conversations/duplicates", response_model=DuplicateGroupsResponse)
def find_duplicates(
    db: Session = Depends(get_db),
    strategy: Literal["source_id", "title", "both"] = Query("source_id"),
    include_nulls: bool = Query(False),
) -> DuplicateGroupsResponse:
    """Find duplicate conversations using specified strategy."""

    if strategy == "source_id":
        groups = find_duplicates_by_source_id(db, include_nulls)
    elif strategy == "title":
        groups = find_duplicates_by_title(db)
    else:
        groups = find_duplicates_combined(db, include_nulls)

    total_duplicates = sum(group.count for group in groups)

    return DuplicateGroupsResponse(
        groups=groups,
        total_duplicates=total_duplicates,
        total_groups=len(groups),
        strategy=strategy,
    )


@app.get("/conversations/{conversation_id:int}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
) -> ConversationDetail:
    """Get a single conversation with all its messages."""
    
    conversation = (
        db.query(Conversation)
        .options(joinedload(Conversation.messages), joinedload(Conversation.tags), joinedload(Conversation.project))
        .filter(Conversation.id == conversation_id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Sort messages by order_index
    conversation.messages.sort(key=lambda m: m.order_index)
    
    return conversation


@app.delete("/conversations/{conversation_id:int}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a conversation and all its messages."""
    
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    db.delete(conversation)
    db.commit()
    
    return {"status": "deleted", "id": str(conversation_id)}


# ============ Import Helper Functions ============

def get_import_settings_record(db: Session) -> ImportSettings | None:
    """Get the current import settings."""
    return db.query(ImportSettings).first()


def conversation_exists(
    db: Session,
    source: str | None,
    source_id: str | None
) -> bool:
    """Check if a conversation with the given source and source_id already exists."""
    if not source or not source_id:
        return False

    existing = db.query(Conversation).filter(
        Conversation.source == source,
        Conversation.source_id == source_id
    ).first()

    return existing is not None


# ============ Duplicate Detection Helper Functions ============

def find_duplicates_by_source_id(
    db: Session,
    include_nulls: bool = False
) -> list[DuplicateGroup]:
    """Find duplicates by (source, source_id) combination."""

    query = (
        db.query(
            Conversation.source,
            Conversation.source_id,
            func.count(Conversation.id).label('count')
        )
        .group_by(Conversation.source, Conversation.source_id)
        .having(func.count(Conversation.id) > 1)
    )

    if not include_nulls:
        query = query.filter(Conversation.source_id != None)

    duplicate_keys = query.all()

    groups = []
    for source, source_id, count in duplicate_keys:
        conversations = (
            db.query(Conversation)
            .filter(
                Conversation.source == source,
                Conversation.source_id == source_id
            )
            .order_by(Conversation.created_at.desc().nulls_last())
            .all()
        )

        titles = [c.title for c in conversations if c.title]
        most_common_title = max(set(titles), key=titles.count) if titles else None

        groups.append(DuplicateGroup(
            key=f"{source}:{source_id or 'null'}",
            source=source,
            source_id=source_id,
            title=most_common_title,
            count=count,
            conversations=[DuplicateConversation.model_validate(c) for c in conversations],
            total_messages=sum(c.message_count for c in conversations)
        ))

    return groups


def find_duplicates_by_title(
    db: Session,
    min_title_length: int = 10
) -> list[DuplicateGroup]:
    """Find duplicates by exact title match within the same source."""

    query = (
        db.query(
            Conversation.source,
            Conversation.title,
            func.count(Conversation.id).label('count')
        )
        .filter(
            Conversation.title != None,
            func.length(Conversation.title) >= min_title_length
        )
        .group_by(Conversation.source, Conversation.title)
        .having(func.count(Conversation.id) > 1)
    )

    duplicate_keys = query.all()

    groups = []
    for source, title, count in duplicate_keys:
        conversations = (
            db.query(Conversation)
            .filter(
                Conversation.source == source,
                Conversation.title == title
            )
            .order_by(Conversation.created_at.desc().nulls_last())
            .all()
        )

        groups.append(DuplicateGroup(
            key=f"{source}:title:{title[:50]}",
            source=source,
            source_id=None,
            title=title,
            count=count,
            conversations=[DuplicateConversation.model_validate(c) for c in conversations],
            total_messages=sum(c.message_count for c in conversations)
        ))

    return groups


def find_duplicates_combined(
    db: Session,
    include_nulls: bool = False
) -> list[DuplicateGroup]:
    """Combine both strategies: source_id first, then title-based for remaining conversations."""

    source_id_groups = find_duplicates_by_source_id(db, include_nulls)

    duplicate_ids = {
        conv.id
        for group in source_id_groups
        for conv in group.conversations
    }

    query = (
        db.query(
            Conversation.source,
            Conversation.title,
            func.count(Conversation.id).label('count')
        )
        .filter(
            Conversation.title != None,
            func.length(Conversation.title) >= 10
        )
        .group_by(Conversation.source, Conversation.title)
        .having(func.count(Conversation.id) > 1)
    )

    if duplicate_ids:
        query = query.filter(~Conversation.id.in_(duplicate_ids))

    duplicate_keys = query.all()

    title_groups = []
    for source, title, count in duplicate_keys:
        conversations_query = (
            db.query(Conversation)
            .filter(
                Conversation.source == source,
                Conversation.title == title
            )
        )

        if duplicate_ids:
            conversations_query = conversations_query.filter(~Conversation.id.in_(duplicate_ids))

        conversations = conversations_query.order_by(Conversation.created_at.desc().nulls_last()).all()

        if len(conversations) > 1:
            title_groups.append(DuplicateGroup(
                key=f"{source}:title:{title[:50]}",
                source=source,
                source_id=None,
                title=title,
                count=len(conversations),
                conversations=[DuplicateConversation.model_validate(c) for c in conversations],
                total_messages=sum(c.message_count for c in conversations)
            ))

    return source_id_groups + title_groups


def bulk_delete_conversations(
    db: Session,
    conversation_ids: list[int]
) -> tuple[list[int], list[int]]:
    """Delete multiple conversations by ID. Returns (deleted_ids, failed_ids)."""

    if not conversation_ids:
        return [], []

    try:
        # Find which IDs actually exist
        existing_ids = {
            row[0]
            for row in db.query(Conversation.id)
            .filter(Conversation.id.in_(conversation_ids))
            .all()
        }
        failed_ids = [cid for cid in conversation_ids if cid not in existing_ids]

        if existing_ids:
            # Bulk-delete related rows (DB cascades would handle this, but
            # being explicit avoids ORM-level cascade loading every message)
            db.query(Message).filter(
                Message.conversation_id.in_(existing_ids)
            ).delete(synchronize_session=False)
            db.query(ConversationTag).filter(
                ConversationTag.conversation_id.in_(existing_ids)
            ).delete(synchronize_session=False)
            db.query(Conversation).filter(
                Conversation.id.in_(existing_ids)
            ).delete(synchronize_session=False)

        db.commit()
        return list(existing_ids), failed_ids
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to bulk delete conversations: {e}")
        return [], conversation_ids


@app.delete("/conversations/bulk")
def delete_conversations_bulk(
    request: BulkDeleteRequest,
    db: Session = Depends(get_db),
) -> BulkDeleteResponse:
    """Delete multiple conversations in bulk."""

    deleted_ids, failed_ids = bulk_delete_conversations(db, request.conversation_ids)

    return BulkDeleteResponse(
        deleted_count=len(deleted_ids),
        deleted_ids=deleted_ids,
        failed_ids=failed_ids,
    )


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Get overall statistics."""

    total_conversations = db.query(Conversation).count()
    total_messages = db.query(Message).count()

    # Get counts by source
    source_counts = (
        db.query(Conversation.source, func.count(Conversation.id))
        .group_by(Conversation.source)
        .all()
    )

    # Get date range
    oldest = db.query(func.min(Conversation.created_at)).scalar()
    newest = db.query(func.max(Conversation.created_at)).scalar()

    return {
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "sources": {source: count for source, count in source_counts},
        "date_range": {
            "oldest": oldest.isoformat() if oldest else None,
            "newest": newest.isoformat() if newest else None,
        }
    }


@app.get("/analytics")
def get_analytics(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Get detailed analytics data for the conversation insights dashboard."""

    # Totals
    total_conversations = db.query(Conversation).count()
    total_messages = db.query(Message).count()
    avg_msgs = db.query(func.avg(Conversation.message_count)).scalar() or 0

    # Source breakdown
    source_counts = (
        db.query(Conversation.source, func.count(Conversation.id))
        .group_by(Conversation.source)
        .all()
    )

    # Conversations grouped by month (PostgreSQL/Supabase)
    month_expr = func.to_char(Conversation.created_at, "YYYY-MM")

    conversations_by_month = (
        db.query(month_expr.label("month"), func.count(Conversation.id).label("count"))
        .filter(Conversation.created_at.isnot(None))
        .group_by(month_expr)
        .order_by(month_expr)
        .all()
    )

    # Activity by day of week (0=Sunday … 6=Saturday)
    day_expr = func.extract("dow", Conversation.created_at)

    activity_by_day_raw = (
        db.query(day_expr.label("day"), func.count(Conversation.id).label("count"))
        .filter(Conversation.created_at.isnot(None))
        .group_by(day_expr)
        .all()
    )

    # Message role distribution
    role_distribution = (
        db.query(Message.role, func.count(Message.id))
        .group_by(Message.role)
        .all()
    )

    # Top tags by conversation count
    top_tags = (
        db.query(Tag.name, Tag.color, func.count(ConversationTag.conversation_id).label("count"))
        .join(ConversationTag, Tag.id == ConversationTag.tag_id)
        .group_by(Tag.id, Tag.name, Tag.color)
        .order_by(func.count(ConversationTag.conversation_id).desc())
        .limit(10)
        .all()
    )

    # Projects breakdown
    project_stats = (
        db.query(Project.name, Project.color, func.count(Conversation.id).label("count"))
        .join(Conversation, Conversation.project_id == Project.id)
        .group_by(Project.id, Project.name, Project.color)
        .order_by(func.count(Conversation.id).desc())
        .all()
    )

    # Normalise day-of-week keys to integers 0–6
    activity_by_day: dict[str, int] = {}
    for day, count in activity_by_day_raw:
        if day is not None:
            activity_by_day[str(int(float(day)))] = count

    return {
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "avg_messages_per_conversation": round(float(avg_msgs), 1),
        "sources": {source: count for source, count in source_counts},
        "conversations_by_month": [
            {"month": month, "count": count}
            for month, count in conversations_by_month
            if month is not None
        ],
        "role_distribution": {role: count for role, count in role_distribution},
        "activity_by_day": activity_by_day,
        "top_tags": [
            {"name": name, "color": color or "#6B7280", "count": count}
            for name, color, count in top_tags
        ],
        "projects": [
            {"name": name, "color": color or "#8B5CF6", "count": count}
            for name, color, count in project_stats
        ],
    }


@app.post("/import/chatgpt", response_model=list[ConversationResponse])
async def import_chatgpt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    filename = file.filename
    if not filename or not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Upload raw export file to Supabase storage if configured
    if is_supabase_configured():
        try:
            upload_export_file(
                filename=filename,
                content=raw,
                source_type="chatgpt",
            )
        except Exception as e:
            logger.warning(f"Failed to upload file to Supabase storage: {e}")
    
    # Create import history record
    import_record = ImportHistory(
        filename=filename,
        source_location=None,  # Could be enhanced to track upload source
        source_type="chatgpt",
        file_format="json",
        status="processing",
        imported_count=0,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        import_record.status = "failure"
        import_record.error_message = "Invalid JSON format"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_chatgpt_export(payload)
    except ValueError as exc:
        import_record.status = "failure"
        import_record.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Get import settings
    settings = get_import_settings_record(db)
    auto_merge = settings.auto_merge_duplicates if settings else False

    records: list[Conversation] = []
    skipped_count = 0

    try:
        for item in parsed:
            # Check if conversation already exists
            source = item.get("source")
            source_id = item.get("source_id")

            if auto_merge and conversation_exists(db, source, source_id):
                skipped_count += 1
                continue

            # Extract messages before creating conversation
            messages_data = item.pop("messages", [])

            # Add import_history_id to track this import
            item["import_history_id"] = import_record.id
            
            convo = Conversation(**item)
            db.add(convo)
            db.flush()  # Get the conversation ID

            # Add messages
            for msg_data in messages_data:
                message = Message(conversation_id=convo.id, **msg_data)
                db.add(message)

            records.append(convo)

        db.commit()
        for convo in records:
            db.refresh(convo)

        # Update import record with success
        import_record.status = "success"
        import_record.imported_count = len(records)
        if skipped_count > 0:
            import_record.error_message = f"Skipped {skipped_count} duplicate(s)"
        db.commit()
        
    except (ValueError, KeyError) as exc:
        # Handle data validation errors
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "Invalid data format"
        db.commit()
        logger.error(f"Import validation error for {filename}: {exc}")
        raise HTTPException(status_code=400, detail="Invalid data format") from exc
    except IntegrityError as exc:
        # Handle database constraint violations (duplicates, foreign keys, etc.)
        db.rollback()
        import_record.status = "failure"
        error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
        import_record.error_message = f"Database constraint violation: {error_msg}"
        db.commit()
        logger.error(f"Import integrity error for {filename}: {exc}")
        raise HTTPException(
            status_code=409,
            detail=f"Database constraint violation: {error_msg}"
        ) from exc
    except OperationalError as exc:
        # Handle database operational errors (locks, connection issues, etc.)
        db.rollback()
        import_record.status = "failure"
        error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
        import_record.error_message = f"Database operation failed: {error_msg}"
        db.commit()
        logger.error(f"Import operational error for {filename}: {exc}")
        raise HTTPException(
            status_code=503,
            detail=f"Database temporarily unavailable: {error_msg}"
        ) from exc
    except Exception as exc:
        # Handle unexpected errors without exposing internals
        db.rollback()
        import_record.status = "failure"

        # Provide more detailed error information for debugging
        error_type = type(exc).__name__
        error_detail = str(exc)
        import_record.error_message = f"{error_type}: {error_detail}"
        db.commit()

        logger.exception(f"Unexpected error during import of {filename}")

        # Return detailed error for debugging (sanitize in production)
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {error_type} - {error_detail}"
        )

    return records


@app.post("/import/claude", response_model=list[ConversationResponse])
async def import_claude(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from Claude export."""
    filename = file.filename
    if not filename or not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Upload raw export file to Supabase storage if configured
    if is_supabase_configured():
        try:
            upload_export_file(
                filename=filename,
                content=raw,
                source_type="claude",
            )
        except Exception as e:
            logger.warning(f"Failed to upload file to Supabase storage: {e}")
    
    import_record = ImportHistory(
        filename=filename,
        source_type="claude",
        file_format="json",
        status="processing",
        imported_count=0,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        import_record.status = "failure"
        import_record.error_message = "Invalid JSON format"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_claude_export(payload)
    except ValueError as exc:
        import_record.status = "failure"
        import_record.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Get import settings
    settings = get_import_settings_record(db)
    auto_merge = settings.auto_merge_duplicates if settings else False

    records: list[Conversation] = []
    skipped_count = 0

    try:
        for item in parsed:
            # Check if conversation already exists
            source = item.get("source")
            source_id = item.get("source_id")

            if auto_merge and conversation_exists(db, source, source_id):
                skipped_count += 1
                continue

            messages_data = item.pop("messages", [])
            
            # Add import_history_id to track this import
            item["import_history_id"] = import_record.id
            
            convo = Conversation(**item)
            db.add(convo)
            db.flush()

            for msg_data in messages_data:
                message = Message(conversation_id=convo.id, **msg_data)
                db.add(message)

            records.append(convo)

        db.commit()
        for convo in records:
            db.refresh(convo)

        import_record.status = "success"
        import_record.imported_count = len(records)
        if skipped_count > 0:
            import_record.error_message = f"Skipped {skipped_count} duplicate(s)"
        db.commit()

    except Exception as exc:
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "Import failed"
        db.commit()
        logger.exception(f"Error importing Claude file {filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


@app.post("/import/gemini", response_model=list[ConversationResponse])
async def import_gemini(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from Gemini/Bard export."""
    filename = file.filename
    if not filename or not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Upload raw export file to Supabase storage if configured
    if is_supabase_configured():
        try:
            upload_export_file(
                filename=filename,
                content=raw,
                source_type="gemini",
            )
        except Exception as e:
            logger.warning(f"Failed to upload file to Supabase storage: {e}")
    
    import_record = ImportHistory(
        filename=filename,
        source_type="gemini",
        file_format="json",
        status="processing",
        imported_count=0,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        import_record.status = "failure"
        import_record.error_message = "Invalid JSON format"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_gemini_export(payload)
    except ValueError as exc:
        import_record.status = "failure"
        import_record.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Get import settings
    settings = get_import_settings_record(db)
    auto_merge = settings.auto_merge_duplicates if settings else False

    records: list[Conversation] = []
    skipped_count = 0

    try:
        for item in parsed:
            # Check if conversation already exists
            source = item.get("source")
            source_id = item.get("source_id")

            if auto_merge and conversation_exists(db, source, source_id):
                skipped_count += 1
                continue

            messages_data = item.pop("messages", [])
            
            # Add import_history_id to track this import
            item["import_history_id"] = import_record.id
            
            convo = Conversation(**item)
            db.add(convo)
            db.flush()

            for msg_data in messages_data:
                message = Message(conversation_id=convo.id, **msg_data)
                db.add(message)

            records.append(convo)

        db.commit()
        for convo in records:
            db.refresh(convo)

        import_record.status = "success"
        import_record.imported_count = len(records)
        if skipped_count > 0:
            import_record.error_message = f"Skipped {skipped_count} duplicate(s)"
        db.commit()

    except Exception as exc:
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "Import failed"
        db.commit()
        logger.exception(f"Error importing Gemini file {filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


@app.post("/import/copilot", response_model=list[ConversationResponse])
async def import_copilot(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from GitHub Copilot export."""
    filename = file.filename
    if not filename or not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Upload raw export file to Supabase storage if configured
    if is_supabase_configured():
        try:
            upload_export_file(
                filename=filename,
                content=raw,
                source_type="copilot",
            )
        except Exception as e:
            logger.warning(f"Failed to upload file to Supabase storage: {e}")
    
    import_record = ImportHistory(
        filename=filename,
        source_type="copilot",
        file_format="json",
        status="processing",
        imported_count=0,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        import_record.status = "failure"
        import_record.error_message = "Invalid JSON format"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_copilot_export(payload)
    except ValueError as exc:
        import_record.status = "failure"
        import_record.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Get import settings
    settings = get_import_settings_record(db)
    auto_merge = settings.auto_merge_duplicates if settings else False

    records: list[Conversation] = []
    skipped_count = 0

    try:
        for item in parsed:
            # Check if conversation already exists
            source = item.get("source")
            source_id = item.get("source_id")

            if auto_merge and conversation_exists(db, source, source_id):
                skipped_count += 1
                continue

            messages_data = item.pop("messages", [])
            
            # Add import_history_id to track this import
            item["import_history_id"] = import_record.id
            
            convo = Conversation(**item)
            db.add(convo)
            db.flush()

            for msg_data in messages_data:
                message = Message(conversation_id=convo.id, **msg_data)
                db.add(message)

            records.append(convo)

        db.commit()
        for convo in records:
            db.refresh(convo)

        import_record.status = "success"
        import_record.imported_count = len(records)
        if skipped_count > 0:
            import_record.error_message = f"Skipped {skipped_count} duplicate(s)"
        db.commit()

    except Exception as exc:
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "Import failed"
        db.commit()
        logger.exception(f"Error importing Copilot file {filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


# ============ Import History Endpoints ============

@app.get("/import/history", response_model=ImportHistoryListResponse)
def get_import_history(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    source_type: str | None = Query(None, description="Filter by source type"),
    status: str | None = Query(None, description="Filter by status"),
) -> ImportHistoryListResponse:
    """Get import history with pagination and filtering."""
    
    query = db.query(ImportHistory)
    
    # Apply filters
    if source_type:
        query = query.filter(ImportHistory.source_type == source_type)
    if status:
        query = query.filter(ImportHistory.status == status)
    
    # Get total count
    total = query.count()
    
    # Sort by most recent first
    query = query.order_by(ImportHistory.created_at.desc())
    
    # Apply pagination
    offset = (page - 1) * page_size
    history_items = query.offset(offset).limit(page_size).all()
    
    # Calculate total pages
    pages = (total + page_size - 1) // page_size
    
    return ImportHistoryListResponse(
        items=history_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@app.get("/import/history/{history_id}", response_model=ImportHistoryResponse)
def get_import_history_item(
    history_id: int,
    db: Session = Depends(get_db),
) -> ImportHistoryResponse:
    """Get a specific import history record."""
    
    history_item = db.query(ImportHistory).filter(ImportHistory.id == history_id).first()
    
    if not history_item:
        raise HTTPException(status_code=404, detail="Import history record not found")
    
    return history_item


@app.delete("/import/history/{history_id}")
def delete_import_history(
    history_id: int,
    delete_conversations: bool = Query(True, description="Also delete imported conversations"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Delete an import history record and optionally its conversations."""
    
    history_item = db.query(ImportHistory).filter(ImportHistory.id == history_id).first()
    
    if not history_item:
        raise HTTPException(status_code=404, detail="Import history record not found")
    
    deleted_conversations = 0
    
    # If delete_conversations is True, delete all conversations from this import
    if delete_conversations:
        # Find conversations that were created by this import
        conversations = db.query(Conversation).filter(
            Conversation.import_history_id == history_id
        ).all()
        
        deleted_conversations = len(conversations)
        
        # Delete the conversations (messages will cascade delete)
        for conv in conversations:
            db.delete(conv)
    
    # Delete the history record
    db.delete(history_item)
    db.commit()
    
    return {
        "deleted": True,
        "import_id": history_id,
        "deleted_conversations": deleted_conversations,
        "message": f"Deleted import history record" + 
                   (f" and {deleted_conversations} conversations" if delete_conversations else "")
    }


# ============ Import Settings Endpoints ============

@app.get("/settings/import", response_model=ImportSettingsResponse)
def get_import_settings(db: Session = Depends(get_db)) -> ImportSettingsResponse:
    """Get current import settings."""
    
    settings = db.query(ImportSettings).first()
    
    # Create default settings if none exist
    if not settings:
        settings = ImportSettings(
            allowed_formats="json,csv,xml",
            default_format="json",
            auto_merge_duplicates=False,
            keep_separate=True,
            skip_empty_conversations=True,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings


@app.put("/settings/import", response_model=ImportSettingsResponse)
def update_import_settings(
    updates: ImportSettingsUpdate,
    db: Session = Depends(get_db),
) -> ImportSettingsResponse:
    """Update import settings."""
    
    settings = db.query(ImportSettings).first()
    
    # Create if doesn't exist
    if not settings:
        settings = ImportSettings()
        db.add(settings)
    
    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    
    settings.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings)
    
    return settings


# ============ Tag Endpoints ============

@app.get("/tags", response_model=TagListResponse)
def list_tags(
    db: Session = Depends(get_db),
) -> TagListResponse:
    """List all tags with their usage counts."""
    # Get all tags with conversation count
    tags = db.query(Tag).all()
    
    # Calculate conversation count for each tag
    tag_responses = []
    for tag in tags:
        count = db.query(ConversationTag).filter(ConversationTag.tag_id == tag.id).count()
        tag_response = TagResponse(
            id=tag.id,
            name=tag.name,
            description=tag.description,
            color=tag.color,
            created_at=tag.created_at,
            conversation_count=count,
        )
        tag_responses.append(tag_response)
    
    return TagListResponse(items=tag_responses, total=len(tag_responses))


@app.post("/tags", response_model=TagResponse)
def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db),
) -> TagResponse:
    """Create a new tag."""
    # Check if tag already exists
    existing_tag = db.query(Tag).filter(Tag.name == tag.name).first()
    if existing_tag:
        raise HTTPException(status_code=400, detail=f"Tag '{tag.name}' already exists")
    
    # Create new tag
    new_tag = Tag(
        name=tag.name,
        description=tag.description,
        color=tag.color,
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return TagResponse(
        id=new_tag.id,
        name=new_tag.name,
        description=new_tag.description,
        color=new_tag.color,
        created_at=new_tag.created_at,
        conversation_count=0,
    )


@app.put("/tags/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: int,
    updates: TagUpdate,
    db: Session = Depends(get_db),
) -> TagResponse:
    """Update an existing tag."""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    update_data = updates.model_dump(exclude_unset=True)
    if "name" in update_data:
        name = update_data["name"].strip()
        if not name:
            raise HTTPException(status_code=400, detail="Tag name cannot be empty")
        existing_tag = (
            db.query(Tag)
            .filter(Tag.name == name, Tag.id != tag_id)
            .first()
        )
        if existing_tag:
            raise HTTPException(status_code=400, detail=f"Tag '{name}' already exists")
        update_data["name"] = name

    if "description" in update_data:
        update_data["description"] = update_data["description"] or None
    if "color" in update_data:
        update_data["color"] = update_data["color"] or None

    for key, value in update_data.items():
        setattr(tag, key, value)

    db.commit()
    db.refresh(tag)

    count = db.query(ConversationTag).filter(ConversationTag.tag_id == tag.id).count()
    return TagResponse(
        id=tag.id,
        name=tag.name,
        description=tag.description,
        color=tag.color,
        created_at=tag.created_at,
        conversation_count=count,
    )


@app.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a tag and remove it from all conversations."""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    db.delete(tag)
    db.commit()

    return {"status": "ok", "message": "Tag deleted"}


@app.post("/conversations/{conversation_id}/tags")
def add_tag_to_conversation(
    conversation_id: int,
    request: AddTagRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Add a tag to a conversation."""
    # Check if conversation exists
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get or create tag
    tag = db.query(Tag).filter(Tag.name == request.tag_name).first()
    if not tag:
        # Get tag info from tagging engine
        engine = get_tagging_engine()
        tag_info = engine.get_tag_info(request.tag_name)
        
        if tag_info:
            tag = Tag(
                name=tag_info["name"],
                description=tag_info["description"],
                color=tag_info["color"],
            )
        else:
            # Create tag with default values
            tag = Tag(name=request.tag_name)
        
        db.add(tag)
        db.commit()
        db.refresh(tag)
    
    # Check if tag is already assigned
    existing = db.query(ConversationTag).filter(
        ConversationTag.conversation_id == conversation_id,
        ConversationTag.tag_id == tag.id,
    ).first()
    
    if existing:
        return {"status": "ok", "message": "Tag already assigned to conversation"}
    
    # Add tag to conversation
    conversation_tag = ConversationTag(
        conversation_id=conversation_id,
        tag_id=tag.id,
        auto_tagged=request.auto_tagged,
    )
    db.add(conversation_tag)
    db.commit()
    
    return {"status": "ok", "message": "Tag added to conversation"}


@app.delete("/conversations/{conversation_id}/tags/{tag_id}")
def remove_tag_from_conversation(
    conversation_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Remove a tag from a conversation."""
    # Check if conversation exists
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if tag exists
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    # Remove tag association
    conversation_tag = db.query(ConversationTag).filter(
        ConversationTag.conversation_id == conversation_id,
        ConversationTag.tag_id == tag_id,
    ).first()
    
    if not conversation_tag:
        raise HTTPException(status_code=404, detail="Tag not assigned to conversation")
    
    db.delete(conversation_tag)
    db.commit()
    
    return {"status": "ok", "message": "Tag removed from conversation"}


@app.post("/conversations/auto-tag", response_model=AutoTagResponse)
def auto_tag_conversations(
    request: AutoTagRequest,
    db: Session = Depends(get_db),
) -> AutoTagResponse:
    """Automatically tag conversations based on content analysis."""
    engine = get_tagging_engine()

    # Ensure all predefined tags exist in database BEFORE loading conversations,
    # so the commit here doesn't expire the conversation objects mid-loop.
    for tag_info in engine.get_all_tags():
        existing_tag = db.query(Tag).filter(Tag.name == tag_info["name"]).first()
        if not existing_tag:
            new_tag = Tag(
                name=tag_info["name"],
                description=tag_info["description"],
                color=tag_info["color"],
            )
            db.add(new_tag)

    db.commit()

    # Get conversations to tag (loaded fresh after the commit above)
    if request.conversation_ids:
        conversations = db.query(Conversation).filter(
            Conversation.id.in_(request.conversation_ids)
        ).all()
    else:
        conversations = db.query(Conversation).all()

    if not conversations:
        raise HTTPException(status_code=404, detail="No conversations found")
    
    # Auto-tag each conversation
    tagged_count = 0
    tagged_ids = []
    tags_added: dict[str, int] = {}
    
    for conversation in conversations:
        # Load messages for content analysis
        messages = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.order_index).all()
        
        message_data = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        # Classify conversation
        tag_names = engine.classify_conversation(
            title=conversation.title,
            messages=message_data,
        )
        
        if not tag_names:
            continue
        
        # Remove existing auto-tags if overwrite is enabled
        if request.overwrite_existing:
            existing_auto_tags = db.query(ConversationTag).filter(
                ConversationTag.conversation_id == conversation.id,
                ConversationTag.auto_tagged.is_(True),
            ).all()
            for ct in existing_auto_tags:
                db.delete(ct)
        
        # Add new tags
        tags_added_to_conv = False
        for tag_name in tag_names:
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                continue
            
            # Check if already assigned
            existing = db.query(ConversationTag).filter(
                ConversationTag.conversation_id == conversation.id,
                ConversationTag.tag_id == tag.id,
            ).first()
            
            if not existing:
                conversation_tag = ConversationTag(
                    conversation_id=conversation.id,
                    tag_id=tag.id,
                    auto_tagged=True,
                )
                db.add(conversation_tag)
                tags_added_to_conv = True
                tags_added[tag_name] = tags_added.get(tag_name, 0) + 1
        
        if tags_added_to_conv:
            tagged_count += 1
            tagged_ids.append(conversation.id)
    
    db.commit()
    
    return AutoTagResponse(
        tagged_count=tagged_count,
        conversation_ids=tagged_ids,
        tags_added=tags_added,
    )


# ============ Project Endpoints ============

@app.get("/projects", response_model=ProjectListResponse)
def list_projects(
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    """List all projects with conversation counts."""
    
    # Get all projects with conversation counts in a single query
    projects_with_counts = (
        db.query(
            Project,
            func.count(Conversation.id).label('conversation_count')
        )
        .outerjoin(Conversation, Conversation.project_id == Project.id)
        .group_by(Project.id)
        .order_by(Project.name)
        .all()
    )
    
    project_responses = []
    for project, conversation_count in projects_with_counts:
        project_response = ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            color=project.color,
            created_at=project.created_at,
            conversation_count=conversation_count,
        )
        project_responses.append(project_response)
    
    return ProjectListResponse(
        items=project_responses,
        total=len(project_responses),
    )


@app.post("/projects", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create a new project."""
    
    # Check if project with this name already exists
    existing = db.query(Project).filter(Project.name == project.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Project with name '{project.name}' already exists"
        )
    
    # Create new project
    db_project = Project(
        name=project.name,
        description=project.description,
        color=project.color,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return ProjectResponse(
        id=db_project.id,
        name=db_project.name,
        description=db_project.description,
        color=db_project.color,
        created_at=db_project.created_at,
        conversation_count=0,
    )


@app.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Get a specific project."""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    conversation_count = db.query(Conversation).filter(
        Conversation.project_id == project.id
    ).count()
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        created_at=project.created_at,
        conversation_count=conversation_count,
    )


@app.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Update a project."""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if new name conflicts with existing project
    if project_update.name and project_update.name != project.name:
        existing = db.query(Project).filter(Project.name == project_update.name).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Project with name '{project_update.name}' already exists"
            )
        project.name = project_update.name
    
    if project_update.description is not None:
        project.description = project_update.description
    
    if project_update.color is not None:
        project.color = project_update.color
    
    db.commit()
    db.refresh(project)
    
    conversation_count = db.query(Conversation).filter(
        Conversation.project_id == project.id
    ).count()
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        created_at=project.created_at,
        conversation_count=conversation_count,
    )


@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a project. Conversations in this project will become uncategorized (via ON DELETE SET NULL)."""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Database will automatically set project_id to NULL via ON DELETE SET NULL constraint
    db.delete(project)
    db.commit()
    
    return {"status": "deleted", "id": str(project_id)}


@app.post("/conversations/{conversation_id}/move")
def move_conversation_to_project(
    conversation_id: int,
    request: MoveToProjectRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Move a conversation to a project (or remove from project if project_id is None)."""
    
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Validate project exists if project_id is provided
    if request.project_id is not None:
        project = db.query(Project).filter(Project.id == request.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    
    old_project_id = conversation.project_id
    conversation.project_id = request.project_id
    
    db.commit()
    db.refresh(conversation)
    
    return {
        "status": "moved",
        "conversation_id": conversation_id,
        "old_project_id": old_project_id,
        "new_project_id": request.project_id,
    }


# ============ Supabase Settings & Sync Endpoints ============

@app.get("/settings/supabase")
def get_supabase_settings() -> dict[str, Any]:
    """Get Supabase connection status and configuration (without exposing keys)."""
    connection_info = get_connection_info()
    return {
        "status": "connected" if connection_info["configured"] else "disconnected",
        "configured": connection_info["configured"],
        "url": connection_info["url"],
        "project_id": connection_info["project_id"],
        "bucket_name": connection_info["bucket_name"],
        "database_mode": DATABASE_MODE,
    }


@app.get("/settings/supabase-dashboard-url")
def get_supabase_dashboard() -> dict[str, Any]:
    """Get the Supabase admin dashboard URL."""
    dashboard_url = get_dashboard_url()
    
    if not dashboard_url:
        raise HTTPException(
            status_code=404,
            detail="Supabase not configured or project ID not available"
        )
    
    return {
        "dashboard_url": dashboard_url,
        "configured": is_supabase_configured(),
    }


@app.get("/storage/files")
def list_storage(
    source_type: str | None = Query(None, description="Filter by source type"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum files to return"),
    offset: int = Query(0, ge=0, description="Number of files to skip"),
) -> dict[str, Any]:
    """List files in Supabase storage bucket."""
    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail="Supabase storage not configured"
        )
    
    files = list_storage_files(source_type=source_type, limit=limit, offset=offset)
    
    if files is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to list storage files"
        )
    
    return {
        "files": files,
        "count": len(files),
        "source_type": source_type,
        "limit": limit,
        "offset": offset,
    }


@app.post("/sync/upload")
def sync_to_supabase(db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Manually trigger sync of local data to Supabase.
    This is a placeholder - full implementation would involve complex data syncing logic.
    """
    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail="Supabase not configured"
        )
    
    # Get count of local conversations
    conversation_count = db.query(func.count(Conversation.id)).scalar()
    
    return {
        "status": "not_implemented",
        "message": "Manual sync to Supabase is not yet fully implemented. Use the migration script instead.",
        "local_conversations": conversation_count,
        "database_mode": DATABASE_MODE,
    }


@app.post("/sync/download")
def sync_from_supabase(db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Pull data from Supabase to local database.
    This is a placeholder - full implementation would involve complex data syncing logic.
    """
    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail="Supabase not configured"
        )
    
    return {
        "status": "not_implemented",
        "message": "Manual sync from Supabase is not yet fully implemented. The app uses Supabase directly when configured.",
        "database_mode": DATABASE_MODE,
    }


def _get_frontend_dist() -> Path | None:
    """Locate the built React frontend, whether frozen or in development."""
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "frontend" / "dist"  # type: ignore[attr-defined]
    dev_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    return dev_dist if dev_dist.exists() else None


_frontend_dist = _get_frontend_dist()
if _frontend_dist and _frontend_dist.exists():
    _assets_dir = _frontend_dist / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def _serve_spa(full_path: str) -> FileResponse:
        file_path = _frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_frontend_dist / "index.html")


def _open_browser_delayed(url: str, delay: float = 2.0) -> None:
    time.sleep(delay)
    webbrowser.open(url)


if __name__ == "__main__":
    if getattr(sys, "frozen", False):
        # When running as a PyInstaller bundle there is no attached console,
        # so sys.stdout/stderr are None.  Redirect them to a log file so that
        # uvicorn's logging formatters (which call stream.isatty()) don't crash.
        log_path = Path(sys.executable).parent / "chatarchive.log"
        _log_file = open(log_path, "w", buffering=1, encoding="utf-8")
        sys.stdout = _log_file
        sys.stderr = _log_file
        logging.basicConfig(stream=_log_file, level=logging.INFO)

        threading.Thread(
            target=_open_browser_delayed,
            args=("http://localhost:8000",),
            daemon=True,
        ).start()
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_config=None,
        )
    else:
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
````

## File: frontend/src/App.tsx
````typescript
import React, { useState, useEffect } from "react";
import { Sparkles, Upload, Search, Menu, Sun, Moon, MoreVertical, Trash2, Download, Tag, Settings, Copy, Database, ExternalLink, ChevronLeft, ChevronRight, Maximize2, Minimize2, BarChart2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import ModalShell from "./components/ModalShell";

const API_URL = "http://localhost:8000";
const PAGE_SIZE = 100;

type Conversation = {
  id: number;
  source: string;
  source_id?: string | null;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message_count: number;
  last_message_preview?: string | null;
  word_count?: number;
  tags?: TagType[];
  project?: ProjectType | null;
};

type TagType = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  conversation_count: number;
};

type ProjectType = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  conversation_count: number;
};

type Message = {
  id: number;
  role: string;
  content: string;
  created_at?: string | null;
  order_index: number;
};

type ConversationDetail = Conversation & {
  messages: Message[];
};

type ImportHistory = {
  id: number;
  filename: string;
  source_location?: string | null;
  source_type: string;
  file_format: string;
  status: string;
  created_at: string;
  imported_count: number;
  error_message?: string | null;
};

type ImportSettings = {
  id: number;
  allowed_formats: string;
  default_format: string;
  auto_merge_duplicates: boolean;
  keep_separate: boolean;
  skip_empty_conversations: boolean;
  updated_at: string;
};

type DuplicateConversation = {
  id: number;
  source: string;
  source_id: string | null;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  message_count: number;
};

type DuplicateGroup = {
  key: string;
  source: string;
  source_id: string | null;
  title: string | null;
  count: number;
  conversations: DuplicateConversation[];
  total_messages: number;
};

type AnalyticsData = {
  total_conversations: number;
  total_messages: number;
  avg_messages_per_conversation: number;
  sources: Record<string, number>;
  conversations_by_month: { month: string; count: number }[];
  role_distribution: Record<string, number>;
  activity_by_day: Record<string, number>;
  top_tags: { name: string; color: string; count: number }[];
  projects: { name: string; color: string; count: number }[];
};

type DuplicatesData = {
  groups: DuplicateGroup[];
  total_duplicates: number;
  total_groups: number;
  strategy: string;
};

// Check if we're in standalone conversation view (opened in new window)
function getInitialConversationId(): number | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("conversation");
  return id ? parseInt(id, 10) : null;
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [standaloneMode, setStandaloneMode] = useState(() => getInitialConversationId() !== null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showMenu, setShowMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedConversationIndex, setSelectedConversationIndex] = useState<number>(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showMoveToProjectModal, setShowMoveToProjectModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [supabaseDashboardUrl, setSupabaseDashboardUrl] = useState<string | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [fullWidthConvo, setFullWidthConvo] = useState(false);
  const [draggedConversationId, setDraggedConversationId] = useState<number | null>(null);
  const [dragOverProject, setDragOverProject] = useState<number | 'uncategorized' | null>(null);

  // Load conversations on mount
  useEffect(() => {
    refreshConversationList(1);
    loadTags();
    loadProjects();
    checkSupabaseConfiguration();
  }, []);

  // When in standalone mode (opened via ?conversation=id), load that conversation
  useEffect(() => {
    const convId = getInitialConversationId();
    if (convId && standaloneMode) {
      loadConversation(convId);
    }
  }, [standaloneMode]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-box input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Ctrl/Cmd + I: Open import modal
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        setShowImportModal(true);
      }

      // Ctrl/Cmd + ,: Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettingsModal(true);
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowImportModal(false);
        setShowSettingsModal(false);
        setShowDuplicatesModal(false);
        setShowAnalyticsModal(false);
        setShowTagModal(false);
        setShowProjectModal(false);
        setShowMoveToProjectModal(false);
        setShowShortcutsModal(false);
        setShowMenu(false);
      }

      // Arrow keys: Navigate conversations
      if (e.key === 'ArrowDown' && conversations.length > 0) {
        e.preventDefault();
        const newIndex = Math.min(selectedConversationIndex + 1, conversations.length - 1);
        setSelectedConversationIndex(newIndex);
        loadConversation(conversations[newIndex].id);
      }

      if (e.key === 'ArrowUp' && conversations.length > 0) {
        e.preventDefault();
        const newIndex = Math.max(selectedConversationIndex - 1, 0);
        setSelectedConversationIndex(newIndex);
        loadConversation(conversations[newIndex].id);
      }

      // Ctrl/Cmd + E: Export current conversation
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && selectedConversation) {
        e.preventDefault();
        setShowMenu(!showMenu);
      }

      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
      }

      // ?: Show keyboard shortcuts help
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversations, selectedConversationIndex, selectedConversation, showMenu, sidebarCollapsed]);

  // Update selected index when conversations change
  useEffect(() => {
    if (selectedConversation && conversations.length > 0) {
      const index = conversations.findIndex(c => c.id === selectedConversation.id);
      setSelectedConversationIndex(index);
    }
  }, [selectedConversation, conversations]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const loadConversations = async (source?: string, page = 1, tag?: string | null, projectId?: number | null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });
      if (source && source !== "all") {
        params.append("source", source);
      }
      if (tag) {
        params.append("tag", tag);
      }
      if (projectId !== null && projectId !== undefined) {
        params.append("project_id", projectId.toString());
      }
      const response = await fetch(`${API_URL}/conversations?${params}`);
      const data = await response.json();
      setConversations(data.items || []);
      setCurrentPage(data.page ?? page);
      setTotalPages(data.pages ?? 0);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      setLoading(false);
    }
  };

  const loadSearchResults = async (
    query: string,
    page = 1,
    source?: string,
    tag?: string | null,
    projectId?: number | null
  ) => {
    try {
      setLoading(true);
      setIsSearching(true);
      const params = new URLSearchParams({
        q: query,
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });
      if (source && source !== "all") {
        params.append("source", source);
      }
      if (tag) {
        params.append("tag", tag);
      }
      if (projectId !== null && projectId !== undefined) {
        params.append("project_id", projectId.toString());
      }
      const response = await fetch(`${API_URL}/conversations/search?${params}`);
      const data = await response.json();
      setConversations(data.items || []);
      setCurrentPage(data.page ?? page);
      setTotalPages(data.pages ?? 0);
      setLoading(false);
    } catch (error) {
      console.error("Search failed:", error);
      setLoading(false);
    } finally {
      setIsSearching(false);
    }
  };

  const refreshConversationList = (page = currentPage, source?: string, tag?: string | null, projectId?: number | null) => {
    const nextSource = source ?? sourceFilter;
    const nextTag = tag ?? selectedTag;
    const nextProject = projectId !== undefined ? projectId : selectedProject;
    if (searchQuery.trim()) {
      loadSearchResults(searchQuery.trim(), page, nextSource, nextTag, nextProject);
      return;
    }
    loadConversations(nextSource, page, nextTag, nextProject);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1) return;
    if (totalPages && nextPage > totalPages) return;
    refreshConversationList(nextPage);
  };

  const loadConversation = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/conversations/${id}`);
      const data = await response.json();
      setSelectedConversation(data);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  const openConversationInNewWindow = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?conversation=${id}`;
    window.open(url, "_blank", "noopener,noreferrer,width=900,height=700");
  };

  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    if (!query.trim()) {
      setIsSearching(false);
      loadConversations(sourceFilter, 1, selectedTag, selectedProject);
      return;
    }

    await loadSearchResults(query.trim(), 1, sourceFilter, selectedTag, selectedProject);
  };

  // Tag-related functions
  const loadTags = async () => {
    try {
      const response = await fetch(`${API_URL}/tags`);
      const data = await response.json();
      const tags = data.items || [];
      setAllTags(tags);
      if (selectedTag && !tags.some((tag: TagType) => tag.name === selectedTag)) {
        setSelectedTag(null);
      }
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/projects`);
      const data = await response.json();
      const projects = data.items || [];
      setAllProjects(projects);
      if (selectedProject && !projects.some((proj: ProjectType) => proj.id === selectedProject)) {
        setSelectedProject(null);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const handleTagFilter = (tagName: string | null) => {
    setSelectedTag(tagName);
    setCurrentPage(1);
    refreshConversationList(1, undefined, tagName, selectedProject);
  };

  const handleProjectFilter = (projectId: number | null) => {
    setSelectedProject(projectId);
    setCurrentPage(1);
    refreshConversationList(1, undefined, selectedTag, projectId);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSourceFilter("all");
    setSelectedTag(null);
    setSelectedProject(null);
    setCurrentPage(1);
    setIsSearching(false);
    loadConversations("all", 1, null, null);
  };

  const checkSupabaseConfiguration = async () => {
    try {
      const response = await fetch(`${API_URL}/settings/supabase-dashboard-url`);
      if (response.ok) {
        const data = await response.json();
        setSupabaseDashboardUrl(data.dashboard_url);
        setSupabaseConfigured(data.configured);
      } else {
        setSupabaseConfigured(false);
        setSupabaseDashboardUrl(null);
      }
    } catch (error) {
      console.error("Failed to check Supabase configuration:", error);
      setSupabaseConfigured(false);
      setSupabaseDashboardUrl(null);
    }
  };

  const autoTagAllConversations = async () => {
    try {
      setAutoTagging(true);
      const response = await fetch(`${API_URL}/conversations/auto-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite_existing: false }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to auto-tag conversations');
      }
      
      const result = await response.json();
      console.log('Auto-tagging result:', result);
      
      // Reload conversations and tags
      await loadTags();
      refreshConversationList(currentPage);
      
      alert(`Successfully tagged ${result.tagged_count} conversations!`);
    } catch (error) {
      console.error("Failed to auto-tag conversations:", error);
      alert("Failed to auto-tag conversations. Please try again.");
    } finally {
      setAutoTagging(false);
    }
  };

  const removeTagFromConversation = async (conversationId: number, tagId: number) => {
    try {
      const response = await fetch(`${API_URL}/conversations/${conversationId}/tags/${tagId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove tag');
      }
      
      // Reload the conversation to get updated tags
      if (selectedConversation?.id === conversationId) {
        await loadConversation(conversationId);
      }
      
      // Refresh the conversation list
      refreshConversationList(currentPage);
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const createProject = async (name: string, description: string, color: string) => {
    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create project');
      }
      
      await loadProjects();
      return true;
    } catch (error) {
      console.error("Failed to create project:", error);
      alert(error instanceof Error ? error.message : 'Failed to create project');
      return false;
    }
  };

  const moveConversationToProject = async (conversationId: number, projectId: number | null) => {
    try {
      const response = await fetch(`${API_URL}/conversations/${conversationId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to move conversation');
      }
      
      // Reload the conversation to get updated project
      if (selectedConversation?.id === conversationId) {
        await loadConversation(conversationId);
      }
      
      // Refresh the conversation list and projects
      await loadProjects();
      refreshConversationList(currentPage);
      setShowMoveToProjectModal(false);
    } catch (error) {
      console.error("Failed to move conversation:", error);
      alert('Failed to move conversation to project');
    }
  };

  const extractTags = (title: string | null | undefined): string[] => {
    if (!title) return [];
    const words = title.split(/\s+/);
    return words.slice(0, 2).filter(w => w.length > 3);
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPreview = (title: string | null | undefined): string => {
    if (!title) return "Untitled conversation";
    return title.length > 60 ? title.slice(0, 60) + "..." : title;
  };

  const getMessagePreview = (conversation: Conversation): string => {
    if (conversation.last_message_preview) {
      return conversation.last_message_preview.length > 80
        ? conversation.last_message_preview.slice(0, 80) + "..."
        : conversation.last_message_preview;
    }
    return "No messages yet";
  };

  const getRelativeTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatDate(dateStr);
  };

  const estimateReadingTime = (wordCount?: number): string => {
    if (!wordCount || wordCount === 0) return "";
    const wordsPerMinute = 200;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes === 1 ? "1 min read" : `${minutes} min read`;
  };

  const getSourceInfo = (source: string) => {
    const sources: Record<string, { icon: string; name: string; color: string }> = {
      chatgpt: { icon: '💬', name: 'ChatGPT', color: 'var(--chatgpt-color)' },
      claude: { icon: '🤖', name: 'Claude', color: 'var(--claude-color)' },
      gemini: { icon: '✨', name: 'Gemini', color: 'var(--gemini-color)' },
      copilot: { icon: '👨‍💻', name: 'Copilot', color: 'var(--copilot-color)' },
    };
    return sources[source] || { icon: '📝', name: source, color: 'var(--accent)' };
  };

  const handleSourceFilter = (source: string) => {
    setSourceFilter(source);
    setCurrentPage(1);
    if (searchQuery.trim()) {
      loadSearchResults(searchQuery.trim(), 1, source, selectedTag, selectedProject);
      return;
    }
    loadConversations(source, 1, selectedTag, selectedProject);
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation || !confirm('Delete this conversation?')) return;

    try {
      await fetch(`${API_URL}/conversations/${selectedConversation.id}`, {
        method: 'DELETE'
      });
      setSelectedConversation(null);
      refreshConversationList();
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const sanitizeFilename = (value: string): string => {
    return value
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  };

  const getOrderedMessages = (conversation: ConversationDetail): Message[] => {
    return [...conversation.messages].sort((a, b) => a.order_index - b.order_index);
  };

  const getExportFilename = (conversation: ConversationDetail, extension: string): string => {
    const title = conversation.title || `conversation-${conversation.id}`;
    const safeTitle = sanitizeFilename(title) || `conversation-${conversation.id}`;
    return `${safeTitle}.${extension}`;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const renderHighlightedText = (text: string, query: string): React.ReactNode => {
    const trimmed = query.trim();
    if (!trimmed) return text;
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;
    const escapedTokens = tokens.map(escapeRegExp);
    const regex = new RegExp(`(${escapedTokens.join("|")})`, "gi");
    const lowerTokens = new Set(tokens.map((token) => token.toLowerCase()));
    return text.split(regex).map((part, index) => {
      if (lowerTokens.has(part.toLowerCase())) {
        return (
          <mark key={`${part}-${index}`} className="search-highlight">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const applyHighlightToNode = (node: React.ReactNode, query: string): React.ReactNode => {
    const trimmed = query.trim();
    if (!trimmed) return node;
    if (typeof node === "string") {
      return renderHighlightedText(node, trimmed);
    }
    if (Array.isArray(node)) {
      return node.map((child, index) => (
        <React.Fragment key={index}>{applyHighlightToNode(child, trimmed)}</React.Fragment>
      ));
    }
    if (React.isValidElement(node)) {
      const elementType = typeof node.type === "string" ? node.type : "";
      if (elementType === "code" || elementType === "pre") {
        return node;
      }
      const children = node.props?.children;
      if (!children) return node;
      return React.cloneElement(node, {
        ...node.props,
        children: applyHighlightToNode(children, trimmed),
      });
    }
    return node;
  };

  const getHighlightMarkdownComponents = (query: string) => {
    const withHighlight =
      (Tag: keyof JSX.IntrinsicElements) =>
      ({ children, ...props }: any) =>
        (
          <Tag {...props}>{applyHighlightToNode(children, query)}</Tag>
        );
    return {
      p: withHighlight("p"),
      li: withHighlight("li"),
      h1: withHighlight("h1"),
      h2: withHighlight("h2"),
      h3: withHighlight("h3"),
      h4: withHighlight("h4"),
      h5: withHighlight("h5"),
      h6: withHighlight("h6"),
      blockquote: withHighlight("blockquote"),
      strong: withHighlight("strong"),
      em: withHighlight("em"),
      a: withHighlight("a"),
      span: withHighlight("span"),
    };
  };

  const buildMarkdownExport = (conversation: ConversationDetail): string => {
    const title = (conversation.title || "Untitled conversation").trim() || "Untitled conversation";
    const sourceName = getSourceInfo(conversation.source).name;
    const metaLines: string[] = [];

    if (sourceName) metaLines.push(`- Source: ${sourceName}`);
    if (conversation.source_id) metaLines.push(`- Source ID: ${conversation.source_id}`);
    if (conversation.created_at) metaLines.push(`- Created: ${formatDateTime(conversation.created_at)}`);
    if (conversation.updated_at) metaLines.push(`- Updated: ${formatDateTime(conversation.updated_at)}`);
    if (conversation.message_count) metaLines.push(`- Messages: ${conversation.message_count}`);

    const lines: string[] = [`# ${title}`];
    if (metaLines.length > 0) {
      lines.push("", ...metaLines);
    }
    lines.push("");

    const orderedMessages = getOrderedMessages(conversation);

    orderedMessages.forEach((msg, index) => {
      const roleLabel =
        msg.role === "user"
          ? "User"
          : msg.role === "assistant"
            ? "Assistant"
            : msg.role;
      lines.push(`## ${roleLabel}`, "");
      if (msg.content) {
        lines.push(msg.content.trimEnd());
      }
      if (index < orderedMessages.length - 1) {
        lines.push("", "---", "");
      }
    });

    return lines.join("\n").trim() + "\n";
  };

  const buildJsonExport = (conversation: ConversationDetail) => {
    const orderedMessages = getOrderedMessages(conversation);
    return {
      ...conversation,
      message_count: orderedMessages.length,
      messages: orderedMessages,
    };
  };

  const buildHtmlExport = (conversation: ConversationDetail): string => {
    const title = (conversation.title || "Untitled conversation").trim() || "Untitled conversation";
    const sourceName = getSourceInfo(conversation.source).name;
    const metaLines: string[] = [];

    if (sourceName) metaLines.push(`Source: ${sourceName}`);
    if (conversation.source_id) metaLines.push(`Source ID: ${conversation.source_id}`);
    if (conversation.created_at) metaLines.push(`Created: ${formatDateTime(conversation.created_at)}`);
    if (conversation.updated_at) metaLines.push(`Updated: ${formatDateTime(conversation.updated_at)}`);
    const messageCount = conversation.message_count || conversation.messages.length;
    metaLines.push(`Messages: ${messageCount}`);

    const orderedMessages = getOrderedMessages(conversation);
    const metaHtml = metaLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    const messagesHtml = orderedMessages
      .map((msg) => {
        const roleLabel =
          msg.role === "user"
            ? "User"
            : msg.role === "assistant"
              ? "Assistant"
              : msg.role;
        const content = msg.content ? escapeHtml(msg.content) : "";
        return `
          <section class="message">
            <h2>${escapeHtml(roleLabel)}</h2>
            <div class="message-content">${content}</div>
          </section>
        `;
      })
      .join("\n");

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            :root {
              color: #111;
              font-family: "Helvetica Neue", Arial, sans-serif;
            }
            body {
              margin: 32px;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 12px;
            }
            .meta {
              margin-bottom: 24px;
              padding-left: 18px;
              color: #444;
            }
            .message {
              margin-bottom: 24px;
              page-break-inside: avoid;
            }
            .message h2 {
              font-size: 18px;
              margin-bottom: 8px;
            }
            .message-content {
              white-space: pre-wrap;
              line-height: 1.5;
              background: #f6f6f6;
              border-radius: 8px;
              padding: 12px;
            }
            @media print {
              body {
                margin: 20mm;
              }
              .message-content {
                background: #fff;
                border: 1px solid #e5e5e5;
              }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <ul class="meta">${metaHtml}</ul>
          ${messagesHtml}
        </body>
      </html>
    `;
  };

  const handleExportMarkdown = () => {
    if (!selectedConversation) return;

    const markdown = buildMarkdownExport(selectedConversation);
    const filename = getExportFilename(selectedConversation, "md");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, filename);
    setShowMenu(false);
  };

  const handleExportJson = () => {
    if (!selectedConversation) return;

    const jsonPayload = buildJsonExport(selectedConversation);
    const filename = getExportFilename(selectedConversation, "json");
    const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, filename);
    setShowMenu(false);
  };

  const handleExportPdf = () => {
    if (!selectedConversation) return;

    const exportWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!exportWindow) {
      alert("Unable to open the export window. Please allow popups and try again.");
      return;
    }

    exportWindow.document.open();
    exportWindow.document.write(buildHtmlExport(selectedConversation));
    exportWindow.document.close();
    exportWindow.focus();

    const triggerPrint = () => {
      exportWindow.print();
    };

    exportWindow.onload = triggerPrint;
    exportWindow.onafterprint = () => {
      exportWindow.close();
    };
    setTimeout(triggerPrint, 300);
    setShowMenu(false);
  };

  const highlightQuery = searchQuery.trim();
  const markdownComponents = highlightQuery ? getHighlightMarkdownComponents(highlightQuery) : undefined;
  const sourceBreakdown = Object.entries(
    conversations.reduce((acc, conv) => {
      acc[conv.source] = (acc[conv.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, countA], [, countB]) => countB - countA);
  const totalMessagesInView = conversations.reduce((sum, conv) => sum + conv.message_count, 0);
  const visibleProjects = new Set(
    conversations.map((conv) => conv.project?.id).filter((projectId): projectId is number => projectId !== undefined)
  );
  const uncategorizedCount = conversations.filter((conv) => !conv.project).length;
  const recentConversations = conversations.slice(0, 4);
  const supportedSources = ["chatgpt", "claude", "gemini", "copilot"];
  const topTags = [...allTags]
    .sort((tagA, tagB) => tagB.conversation_count - tagA.conversation_count)
    .slice(0, 5);
  const topProjects = [...allProjects]
    .sort((projectA, projectB) => projectB.conversation_count - projectA.conversation_count)
    .slice(0, 4);
  const hasActiveFilters =
    sourceFilter !== "all" ||
    selectedTag !== null ||
    selectedProject !== null ||
    Boolean(highlightQuery);
  const selectedProjectLabel =
    selectedProject === null
      ? null
      : selectedProject === -1
        ? "Uncategorized"
        : allProjects.find((project) => project.id === selectedProject)?.name || "Selected project";
  const activeFilters = [
    sourceFilter !== "all" ? getSourceInfo(sourceFilter).name : null,
    selectedTag ? `Tag: ${selectedTag}` : null,
    selectedProjectLabel ? `Project: ${selectedProjectLabel}` : null,
    highlightQuery ? `Search: "${highlightQuery}"` : null,
  ].filter((value): value is string => Boolean(value));

  // Standalone mode: show only the conversation (opened in new window)
  if (standaloneMode) {
    return (
      <div className="app-container standalone-view">
        <div className="standalone-header">
          <h1 className="standalone-title">{selectedConversation?.title || "Loading..."}</h1>
          <a
            href={window.location.pathname}
            target="_self"
            className="icon-btn back-link"
            title="Back to ChatArchive"
          >
            ← Back to ChatArchive
          </a>
        </div>
        <div className="standalone-content">
          {selectedConversation ? (
            <div className="conversation-view">
              {getOrderedMessages(selectedConversation).map((msg, index) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-header">
                    <div className="message-avatar">
                      {msg.role === "user" ? (
                        <div className="user-avatar">👤</div>
                      ) : (
                        <div className="assistant-avatar" data-source={selectedConversation.source}>
                          {getSourceInfo(selectedConversation.source).icon}
                        </div>
                      )}
                    </div>
                    <div className="message-meta">
                      <div className="message-role">
                        {msg.role === "user" ? "You" : getSourceInfo(selectedConversation.source).name}
                      </div>
                      <div className="message-time">
                        {formatDateTime(msg.created_at)}
                        {index < selectedConversation.messages.length - 1 && (
                          <span className="message-number">Message {index + 1}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="message-content markdown-content">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="welcome-state">
              <p>Loading conversation...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container${fullWidthConvo && selectedConversation ? ' sidebar-hidden' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <Sparkles size={20} />
            {!sidebarCollapsed && <span>ChatArchive</span>}
          </div>
          <div className="header-buttons">
            {!sidebarCollapsed && supabaseConfigured && supabaseDashboardUrl && (
              <a
                href={supabaseDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="icon-btn supabase-link"
                title="Open Supabase Dashboard"
              >
                <Database size={18} />
              </a>
            )}
            {!sidebarCollapsed && (
              <button
                className="icon-btn keyboard-shortcut-hint"
                title="Press Shift+? for keyboard shortcuts"
                aria-label="Open keyboard shortcuts"
                onClick={() => setShowShortcutsModal(true)}
              >
                <span className="keyboard-hint">⌨️</span>
              </button>
            )}
            <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {!sidebarCollapsed && (
          <div className="sidebar-top">
            <div className="search-box">
              <label className="sr-only" htmlFor="conversation-search">Search conversations</label>
              <Search size={16} className="search-icon" />
              <input
                id="conversation-search"
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <section className="sidebar-panel sidebar-primary-panel">
              <div className="sidebar-panel-header">
                <div>
                  <p className="sidebar-panel-label">Library</p>
                  <h2 className="sidebar-panel-title">{highlightQuery ? "Search results" : "Browse archive"}</h2>
                </div>
                <span className="sidebar-panel-meta">{conversations.length} shown</span>
              </div>

              <button className="import-btn" onClick={() => setShowImportModal(true)}>
                <Upload size={16} />
                Import Conversations
              </button>

              <div className="sidebar-summary-grid">
                <div className="sidebar-summary-card">
                  <span className="sidebar-summary-label">Messages</span>
                  <strong>{totalMessagesInView}</strong>
                </div>
                <div className="sidebar-summary-card">
                  <span className="sidebar-summary-label">Sources</span>
                  <strong>{sourceBreakdown.length}</strong>
                </div>
              </div>
            </section>

            <section className="sidebar-panel">
              <div className="sidebar-panel-header">
                <div>
                  <p className="sidebar-panel-label">Filters</p>
                  <h2 className="sidebar-panel-title">Narrow the view</h2>
                </div>
                {hasActiveFilters && (
                  <button className="sidebar-inline-action" onClick={clearAllFilters}>
                    Clear
                  </button>
                )}
              </div>

              <div className="sidebar-filters">
                <div className="source-filter">
                  <label htmlFor="source-filter">Filter by source:</label>
                  <select id="source-filter" value={sourceFilter} onChange={(e) => handleSourceFilter(e.target.value)}>
                    <option value="all">All Sources</option>
                    <option value="chatgpt">💬 ChatGPT</option>
                    <option value="claude">🤖 Claude</option>
                    <option value="gemini">✨ Gemini</option>
                    <option value="copilot">👨‍💻 Copilot</option>
                  </select>
                </div>

                <div className="tag-filter">
                  <label htmlFor="tag-filter">Filter by tag:</label>
                  <select
                    id="tag-filter"
                    value={selectedTag || "all"}
                    onChange={(e) => handleTagFilter(e.target.value === "all" ? null : e.target.value)}
                  >
                    <option value="all">All Tags</option>
                    {allTags.map((tag) => (
                      <option key={tag.id} value={tag.name}>
                        {tag.name} ({tag.conversation_count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="project-filter">
                  <label htmlFor="project-filter">Filter by project:</label>
                  <select
                    id="project-filter"
                    value={selectedProject !== null ? selectedProject.toString() : "all"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "all") {
                        handleProjectFilter(null);
                      } else if (val === "-1") {
                        handleProjectFilter(-1);
                      } else {
                        handleProjectFilter(parseInt(val, 10));
                      }
                    }}
                  >
                    <option value="all">All Projects</option>
                    <option value="-1">📂 Uncategorized ({uncategorizedCount})</option>
                    {allProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        📁 {project.name} ({project.conversation_count})
                      </option>
                    ))}
                  </select>
                </div>

                {allProjects.length > 0 && (
                  <div className={`project-drop-zones ${draggedConversationId ? "drag-mode" : ""}`}>
                    <label>Projects - drag here to assign</label>
                    <div
                      className={`project-drop-zone${dragOverProject === "uncategorized" ? " drag-over" : ""}`}
                      role="button"
                      tabIndex={0}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverProject("uncategorized");
                      }}
                      onDragLeave={() => setDragOverProject(null)}
                      onDrop={async () => {
                        if (draggedConversationId !== null) {
                          await moveConversationToProject(draggedConversationId, null);
                        }
                        setDragOverProject(null);
                        setDraggedConversationId(null);
                      }}
                      onClick={() => handleProjectFilter(-1)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleProjectFilter(-1);
                        }
                      }}
                      title="Uncategorized conversations"
                    >
                      📂 Uncategorized
                    </div>
                    {allProjects.map((project) => (
                      <div
                        key={project.id}
                        className={`project-drop-zone${dragOverProject === project.id ? " drag-over" : ""}`}
                        style={{ borderLeftColor: project.color || "#8B5CF6" }}
                        role="button"
                        tabIndex={0}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverProject(project.id);
                        }}
                        onDragLeave={() => setDragOverProject(null)}
                        onDrop={async () => {
                          if (draggedConversationId !== null) {
                            await moveConversationToProject(draggedConversationId, project.id);
                          }
                          setDragOverProject(null);
                          setDraggedConversationId(null);
                        }}
                        onClick={() => handleProjectFilter(project.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleProjectFilter(project.id);
                          }
                        }}
                        title={project.description || project.name}
                      >
                        <span
                          className="project-drop-color-dot"
                          style={{ backgroundColor: project.color || "#8B5CF6" }}
                        />
                        {project.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="sidebar-panel sidebar-tools-panel">
              <div className="sidebar-panel-header">
                <div>
                  <p className="sidebar-panel-label">Tools</p>
                  <h2 className="sidebar-panel-title">Organize the archive</h2>
                </div>
              </div>

              <div className="sidebar-tool-grid">
                <button className="sidebar-tool-btn" onClick={() => setShowAnalyticsModal(true)}>
                  <BarChart2 size={16} />
                  Analytics
                </button>

                <button className="sidebar-tool-btn" onClick={() => setShowDuplicatesModal(true)}>
                  <Copy size={16} />
                  Duplicates
                </button>

                <button
                  className="sidebar-tool-btn sidebar-tool-btn-accent"
                  onClick={autoTagAllConversations}
                  disabled={autoTagging}
                  title="Automatically tag all conversations based on content"
                >
                  <Tag size={16} />
                  {autoTagging ? "Auto-tagging..." : "Auto-tag all"}
                </button>

                <button className="sidebar-tool-btn" onClick={() => setShowTagModal(true)}>
                  <Tag size={16} />
                  Manage tags
                </button>

                <button className="sidebar-tool-btn" onClick={() => setShowProjectModal(true)}>
                  <Settings size={16} />
                  Manage projects
                </button>

                <button className="sidebar-tool-btn" onClick={() => setShowSettingsModal(true)}>
                  <Settings size={16} />
                  Settings
                </button>
              </div>
            </section>
          </div>
        )}

        <div className="conversations-list sidebar-list" aria-label="Conversation list in sidebar">
          {loading || isSearching ? (
            <div className="skeleton-container">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-header">
                    <div className="skeleton-avatar"></div>
                    <div className="skeleton-info">
                      <div className="skeleton-title"></div>
                      <div className="skeleton-meta"></div>
                    </div>
                  </div>
                  <div className="skeleton-preview"></div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>No conversations yet</h3>
              <p>Import your first conversation to get started</p>
              <button className="empty-action-btn" onClick={() => setShowImportModal(true)}>
                <Upload size={16} />
                Import Conversations
              </button>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-card ${selectedConversation?.id === conv.id ? "active" : ""} ${draggedConversationId === conv.id ? "dragging" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={selectedConversation?.id === conv.id}
                aria-label={conv.title || "Untitled conversation"}
                onClick={() => loadConversation(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    loadConversation(conv.id);
                  }
                }}
                draggable={true}
                onDragStart={(e) => {
                  setDraggedConversationId(conv.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(conv.id));
                }}
                onDragEnd={() => {
                  setDraggedConversationId(null);
                  setDragOverProject(null);
                }}
              >
                <div className="card-header">
                  <div className="card-left">
                    <div className="source-avatar" data-source={conv.source}>
                      {getSourceInfo(conv.source).icon}
                    </div>
                    <div className="conv-info">
                      <h3 className="conv-title">
                        {renderHighlightedText(conv.title || "Untitled", highlightQuery)}
                      </h3>
                      <div className="conv-meta">
                        <span className="conv-time">{getRelativeTime(conv.updated_at || conv.created_at)}</span>
                        <span className="conv-stats">
                          {conv.message_count} message{conv.message_count !== 1 ? 's' : ''}
                        </span>
                        {conv.word_count && (
                          <span className="conv-stats">{estimateReadingTime(conv.word_count)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="card-right">
                    <button
                      className="icon-btn open-new-window-btn"
                      title="Open in new window"
                      onClick={(e) => openConversationInNewWindow(conv.id, e)}
                    >
                      <ExternalLink size={16} />
                    </button>
                    <span className="tag source" data-source={conv.source}>
                      {getSourceInfo(conv.source).name}
                    </span>
                  </div>
                </div>
                <div className="card-preview">
                  <p className="conv-preview">
                    {renderHighlightedText(getMessagePreview(conv), highlightQuery)}
                  </p>
                </div>
                {conv.tags && conv.tags.length > 0 && (
                  <div className="card-tags">
                    {conv.tags.map((tag) => (
                      <button 
                        key={tag.id} 
                        type="button"
                        className="tag tag-badge tag-filter-chip" 
                        style={{
                          backgroundColor: tag.color || '#6B7280',
                          color: 'white',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagFilter(tag.name);
                        }}
                        title={tag.description || tag.name}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
                {conv.project && (
                  <div className="card-project">
                    <button 
                      type="button"
                      className="project-badge project-badge-btn" 
                      style={{
                        backgroundColor: conv.project.color || '#8B5CF6',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-block',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProjectFilter(conv.project!.id);
                      }}
                      title={conv.project.description || conv.project.name}
                    >
                      📁 {conv.project.name}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!sidebarCollapsed && totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={loading || currentPage <= 1}
            >
              Prev
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={loading || currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        )}

        {/* Sidebar collapse handle */}
        <button
          className="sidebar-collapse-handle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="main-header-top">
            <div className="main-header-leading">
              <button className="icon-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Toggle sidebar">
                <Menu size={20} />
              </button>
              {selectedConversation && (
                <button
                  className="icon-btn"
                  onClick={() => setFullWidthConvo(!fullWidthConvo)}
                  title={fullWidthConvo ? "Show sidebar" : "Full width view"}
                >
                  {fullWidthConvo ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              )}
            </div>

            <div className="main-header-text">
              <p className="header-kicker">
                {selectedConversation
                  ? getSourceInfo(selectedConversation.source).name
                  : highlightQuery
                    ? "Search results"
                    : "Archive overview"}
              </p>
              <h2 className="header-title">
                {selectedConversation?.title || "Browse and organize your conversations"}
              </h2>
              {!selectedConversation && (
                <p className="header-subtitle">
                  Use the sidebar to filter the archive, then pick a conversation to preview here or open it in a
                  dedicated window.
                </p>
              )}
            </div>

            {selectedConversation && (
              <div className="header-actions">
                <button className="icon-btn" onClick={() => setShowMenu(!showMenu)} title="More options">
                  <MoreVertical size={20} />
                </button>
                {showMenu && (
                  <div className="dropdown-menu">
                    <button
                      className="menu-item"
                      onClick={() => {
                        setShowMoveToProjectModal(true);
                        setShowMenu(false);
                      }}
                    >
                      <Settings size={16} />
                      Move to project
                    </button>
                    <button className="menu-item" onClick={handleDeleteConversation}>
                      <Trash2 size={16} />
                      Delete conversation
                    </button>
                    <button className="menu-item" onClick={handleExportMarkdown}>
                      <Download size={16} />
                      Export as Markdown
                    </button>
                    <button className="menu-item" onClick={handleExportJson}>
                      <Download size={16} />
                      Export as JSON
                    </button>
                    <button className="menu-item" onClick={handleExportPdf}>
                      <Download size={16} />
                      Export as PDF
                    </button>
                    <button className="menu-item" onClick={() => setShowMenu(false)}>
                      <Tag size={16} />
                      Add tags
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedConversation && (
            <div className="main-header-meta">
              <span className="header-meta-pill source-pill" data-source={selectedConversation.source}>
                {getSourceInfo(selectedConversation.source).icon} {getSourceInfo(selectedConversation.source).name}
              </span>

              {selectedConversation.project && (
                <button
                  className="header-meta-pill project-pill"
                  style={{ backgroundColor: selectedConversation.project.color || "#8B5CF6" }}
                  onClick={() => handleProjectFilter(selectedConversation.project!.id)}
                  title={selectedConversation.project.description || selectedConversation.project.name}
                >
                  📁 {selectedConversation.project.name}
                </button>
              )}

              <span className="header-meta-pill">{selectedConversation.message_count} messages</span>

              {selectedConversation.word_count ? (
                <span className="header-meta-pill">{estimateReadingTime(selectedConversation.word_count)}</span>
              ) : null}

              <span className="header-meta-pill">
                Updated {getRelativeTime(selectedConversation.updated_at || selectedConversation.created_at)}
              </span>

              {selectedConversation.tags && selectedConversation.tags.length > 0 && (
                <div className="conversation-tags-header">
                  {selectedConversation.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="tag tag-badge"
                      style={{
                        backgroundColor: tag.color || "#6B7280",
                        color: "white",
                      }}
                      title={tag.description || tag.name}
                    >
                      {tag.name}
                      <button
                        className="tag-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove tag "${tag.name}" from this conversation?`)) {
                            removeTagFromConversation(selectedConversation.id, tag.id);
                          }
                        }}
                        style={{
                          marginLeft: "4px",
                          cursor: "pointer",
                          border: "none",
                          background: "transparent",
                          color: "white",
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        <div className="content-area content-area-scrollable">
          {!selectedConversation ? (
            <div className="overview-layout">
              <section className="overview-hero">
                <div className="overview-hero-copy">
                  <span className="overview-kicker">ChatArchive</span>
                  <h2 className="overview-title">
                    {conversations.length === 0
                      ? hasActiveFilters
                        ? "No conversations match this view"
                        : "Bring your AI conversations into one calm workspace"
                      : "Your archive is ready to browse"}
                  </h2>
                  <p className="overview-description">
                    {conversations.length === 0
                      ? hasActiveFilters
                        ? "Try clearing a filter or broadening your search to bring conversations back into view."
                        : "Import a chat export to start searching, tagging, and organizing everything in one local-first workspace."
                      : "Use the sidebar to filter the archive, then preview any conversation here or pop it into a dedicated reading window."}
                  </p>
                  <div className="overview-chip-list">
                    {supportedSources.map((source) => (
                      <span key={source} className="overview-chip">
                        {getSourceInfo(source).icon} {getSourceInfo(source).name}
                      </span>
                    ))}
                    <span className="overview-chip">Local-first archive</span>
                  </div>
                </div>

                <div className="overview-hero-actions">
                  <button className="empty-action-btn" onClick={() => setShowImportModal(true)}>
                    <Upload size={16} />
                    Import Conversations
                  </button>
                  {hasActiveFilters && (
                    <button className="overview-secondary-btn" onClick={clearAllFilters}>
                      Clear filters
                    </button>
                  )}
                  {!hasActiveFilters && conversations.length > 0 && recentConversations[0] && (
                    <button className="overview-secondary-btn" onClick={() => loadConversation(recentConversations[0].id)}>
                      Open latest conversation
                    </button>
                  )}
                  {!hasActiveFilters && conversations.length > 0 && (
                    <button className="overview-secondary-btn" onClick={() => setShowAnalyticsModal(true)}>
                      Review analytics
                    </button>
                  )}
                </div>
              </section>

              {loading || isSearching ? (
                <div className="skeleton-container center-skeleton">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-header">
                        <div className="skeleton-avatar"></div>
                        <div className="skeleton-info">
                          <div className="skeleton-title"></div>
                          <div className="skeleton-meta"></div>
                        </div>
                      </div>
                      <div className="skeleton-preview"></div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="overview-panels">
                  <section className="overview-panel overview-empty-panel">
                    <div className="overview-panel-header">
                      <div>
                        <h3>{hasActiveFilters ? "Current filters" : "Getting started"}</h3>
                        <p>
                          {hasActiveFilters
                            ? "These filters are active right now."
                            : "A few helpful next steps once you import your first archive."}
                        </p>
                      </div>
                    </div>

                    {hasActiveFilters ? (
                      <div className="overview-chip-list">
                        {activeFilters.map((filterLabel) => (
                          <span key={filterLabel} className="overview-chip">
                            {filterLabel}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="overview-onboarding-grid">
                        <div className="overview-onboarding-card">
                          <span className="overview-section-label">Supported imports</span>
                          <div className="overview-source-list">
                            {supportedSources.map((source) => (
                              <div key={source} className="overview-source-row">
                                <span className="overview-source-name">
                                  <span className="source-indicator">{getSourceInfo(source).icon}</span>
                                  {getSourceInfo(source).name}
                                </span>
                                <strong>Ready</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="overview-onboarding-card">
                          <span className="overview-section-label">After import</span>
                          <div className="overview-checklist">
                            <div className="overview-check-item">Search across titles and message content from one place.</div>
                            <div className="overview-check-item">Use tags and projects to group related work.</div>
                            <div className="overview-check-item">Open long threads in a dedicated reader when you want a calmer view.</div>
                          </div>
                          <p className="overview-empty-copy">Your archive stays local unless you explicitly connect external storage.</p>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              ) : (
                <>
                  <div className="overview-stats-grid">
                    <article className="overview-stat-card">
                      <span className="overview-stat-label">Conversations in view</span>
                      <strong>{conversations.length}</strong>
                    </article>
                    <article className="overview-stat-card">
                      <span className="overview-stat-label">Messages in view</span>
                      <strong>{totalMessagesInView}</strong>
                    </article>
                    <article className="overview-stat-card">
                      <span className="overview-stat-label">Projects represented</span>
                      <strong>{visibleProjects.size + (uncategorizedCount > 0 ? 1 : 0)}</strong>
                    </article>
                    <article className="overview-stat-card">
                      <span className="overview-stat-label">Sources represented</span>
                      <strong>{sourceBreakdown.length}</strong>
                    </article>
                  </div>

                  <div className="overview-panels">
                    <section className="overview-panel">
                      <div className="overview-panel-header">
                        <div>
                          <h3>Recent conversations</h3>
                          <p>The latest items in your current view.</p>
                        </div>
                      </div>

                      <div className="overview-recent-list">
                        {recentConversations.map((conv) => (
                          <article key={conv.id} className="overview-conversation-card">
                            <button className="overview-conversation-main" onClick={() => loadConversation(conv.id)}>
                              <div className="source-avatar" data-source={conv.source}>
                                {getSourceInfo(conv.source).icon}
                              </div>
                              <div className="overview-conversation-copy">
                                <h4>{renderHighlightedText(conv.title || "Untitled", highlightQuery)}</h4>
                                <p>{renderHighlightedText(getMessagePreview(conv), highlightQuery)}</p>
                                <div className="overview-conversation-meta">
                                  <span>{getRelativeTime(conv.updated_at || conv.created_at)}</span>
                                  <span>{conv.message_count} messages</span>
                                  {conv.word_count ? <span>{estimateReadingTime(conv.word_count)}</span> : null}
                                </div>
                              </div>
                            </button>

                            <button
                              className="icon-btn overview-conversation-launch"
                              title="Open in new window"
                              onClick={(e) => openConversationInNewWindow(conv.id, e)}
                            >
                              <ExternalLink size={16} />
                            </button>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="overview-panel">
                      <div className="overview-panel-header">
                        <div>
                          <h3>Current focus</h3>
                          <p>What this view is showing right now.</p>
                        </div>
                      </div>

                      <div className="overview-focus-stack">
                        <div>
                          <span className="overview-section-label">Active filters</span>
                          <div className="overview-chip-list">
                            {activeFilters.length > 0 ? (
                              activeFilters.map((filterLabel) => (
                                <span key={filterLabel} className="overview-chip">
                                  {filterLabel}
                                </span>
                              ))
                            ) : (
                              <span className="overview-empty-copy">No filters applied. You're looking at the broad archive view.</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Source mix</span>
                          <div className="overview-source-list">
                            {sourceBreakdown.map(([source, count]) => (
                              <div key={source} className="overview-source-row">
                                <span className="overview-source-name">
                                  <span className="source-indicator">{getSourceInfo(source).icon}</span>
                                  {getSourceInfo(source).name}
                                </span>
                                <strong>{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Archive health</span>
                          <div className="overview-mini-stat-grid">
                            <div className="overview-mini-stat">
                              <strong>{allTags.length}</strong>
                              <span>saved tags</span>
                            </div>
                            <div className="overview-mini-stat">
                              <strong>{allProjects.length}</strong>
                              <span>projects</span>
                            </div>
                            <div className="overview-mini-stat">
                              <strong>{uncategorizedCount}</strong>
                              <span>uncategorized in view</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Top tags</span>
                          <div className="overview-chip-list">
                            {topTags.length > 0 ? (
                              topTags.map((tag) => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  className="overview-chip overview-chip-button"
                                  onClick={() => handleTagFilter(tag.name)}
                                >
                                  {tag.name} ({tag.conversation_count})
                                </button>
                              ))
                            ) : (
                              <span className="overview-empty-copy">Tags will appear here after you import or classify conversations.</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Top projects</span>
                          <div className="overview-chip-list">
                            {topProjects.length > 0 ? (
                              topProjects.map((project) => (
                                <button
                                  key={project.id}
                                  type="button"
                                  className="overview-chip overview-chip-button"
                                  onClick={() => handleProjectFilter(project.id)}
                                >
                                  {project.name} ({project.conversation_count})
                                </button>
                              ))
                            ) : (
                              <span className="overview-empty-copy">Create projects once you want to group related threads.</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="overview-section-label">Quick actions</span>
                          <div className="overview-action-grid">
                            <button type="button" className="overview-secondary-btn" onClick={() => setShowAnalyticsModal(true)}>
                              Open analytics
                            </button>
                            <button type="button" className="overview-secondary-btn" onClick={() => setShowTagModal(true)}>
                              Manage tags
                            </button>
                            <button type="button" className="overview-secondary-btn" onClick={() => setShowProjectModal(true)}>
                              Manage projects
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="conversation-view">
              {getOrderedMessages(selectedConversation).map((msg, index) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-header">
                    <div className="message-avatar">
                      {msg.role === "user" ? (
                        <div className="user-avatar">👤</div>
                      ) : (
                        <div className="assistant-avatar" data-source={selectedConversation.source}>
                          {getSourceInfo(selectedConversation.source).icon}
                        </div>
                      )}
                    </div>
                    <div className="message-meta">
                      <div className="message-role">
                        {msg.role === "user" ? "You" : getSourceInfo(selectedConversation.source).name}
                      </div>
                      <div className="message-time">
                        {formatDateTime(msg.created_at)}
                        {index < selectedConversation.messages.length - 1 && (
                          <span className="message-number">Message {index + 1}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="message-content markdown-content">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onSuccess={() => refreshConversationList()} />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {showDuplicatesModal && (
        <DuplicatesModal
          onClose={() => setShowDuplicatesModal(false)}
          onSuccess={() => refreshConversationList()}
        />
      )}

      {showTagModal && (
        <TagManagerModal
          tags={allTags}
          onClose={() => setShowTagModal(false)}
          onTagsUpdated={loadTags}
        />
      )}

      {showProjectModal && (
        <ProjectManagerModal
          projects={allProjects}
          onClose={() => setShowProjectModal(false)}
          onProjectsUpdated={loadProjects}
        />
      )}

      {showMoveToProjectModal && selectedConversation && (
        <MoveToProjectModal
          conversation={selectedConversation}
          projects={allProjects}
          onClose={() => setShowMoveToProjectModal(false)}
          onMove={moveConversationToProject}
        />
      )}

      {showAnalyticsModal && (
        <AnalyticsDashboard onClose={() => setShowAnalyticsModal(false)} />
      )}

      {showShortcutsModal && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}
    </div>
  );
}

function TagManagerModal({
  tags,
  onClose,
  onTagsUpdated,
}: {
  tags: TagType[];
  onClose: () => void;
  onTagsUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#3B82F6");
    setEditingTag(null);
    setError(null);
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    setName(tag.name);
    setDescription(tag.description || "");
    setColor(tag.color || "#3B82F6");
    setStatus(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tag name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      color: color.trim() || null,
    };

    setSaving(true);
    try {
      const response = await fetch(
        editingTag ? `${API_URL}/tags/${editingTag.id}` : `${API_URL}/tags`,
        {
          method: editingTag ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save tag.");
      }

      await onTagsUpdated();
      resetForm();
      setStatus(editingTag ? "Tag updated." : "Tag created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tag.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagType) => {
    const message = `Delete tag "${tag.name}"? This will remove it from all conversations.`;
    if (!confirm(message)) return;

    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/tags/${tag.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete tag.");
      }
      await onTagsUpdated();
      if (editingTag?.id === tag.id) {
        resetForm();
      }
      setStatus("Tag deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Manage Tags" onClose={onClose} className="tag-manager-modal" bodyClassName="tag-manager-content">
      <form className="tag-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tag name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. research"
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>
        <div className="form-group">
          <label>Color</label>
          <div className="tag-color-row">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Tag color"
            />
            <span className="tag-preview" style={{ backgroundColor: color }}>
              {name.trim() || "Preview"}
            </span>
          </div>
        </div>

        <div className="tag-form-actions">
          {editingTag && (
            <button type="button" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingTag ? "Save Tag" : "Create Tag"}
          </button>
        </div>

        {status && <div className="status-success">{status}</div>}
        {error && <div className="status-error">{error}</div>}
      </form>

      <div className="tag-list">
        <div className="tag-list-header">Existing tags</div>
        {tags.length === 0 ? (
          <div className="empty">No tags created yet.</div>
        ) : (
          <div className="tag-list-items">
            {tags.map((tag) => (
              <div key={tag.id} className="tag-row">
                <div className="tag-row-main">
                  <span className="tag-badge" style={{ backgroundColor: tag.color || "#6B7280", color: "white" }}>
                    {tag.name}
                  </span>
                  <div className="tag-row-info">
                    <div className="tag-row-name">{tag.name}</div>
                    <div className="tag-row-meta">
                      {tag.description || "No description"}
                    </div>
                  </div>
                </div>
                <div className="tag-row-actions">
                  <span className="tag-count">{tag.conversation_count} conv</span>
                  <button type="button" onClick={() => handleEdit(tag)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => handleDelete(tag)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'chatgpt' | 'claude' | 'gemini' | 'copilot'>('chatgpt');
  const [settings, setSettings] = useState<ImportSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/settings/import`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  type SourceInfo = {
    name: string;
    description: string;
    icon: string;
    exportUrl?: string;
    exportSteps: string[];
  };

  const sourceInfo: Record<'chatgpt' | 'claude' | 'gemini' | 'copilot', SourceInfo> = {
    chatgpt: {
      name: 'ChatGPT',
      description: 'OpenAI ChatGPT conversations.json export',
      icon: '💬',
      exportUrl: 'https://chatgpt.com/#settings/DataControls',
      exportSteps: [
        'Go to ChatGPT Settings → Data Controls → Export Data',
        'Click "Export" and wait for the email confirmation',
        'Download the archive and extract conversations.json',
      ],
    },
    claude: {
      name: 'Claude',
      description: 'Anthropic Claude conversation export',
      icon: '🤖',
      exportUrl: 'https://claude.ai/settings',
      exportSteps: [
        'Visit claude.ai/settings',
        'Navigate to "Data & Privacy"',
        'Click "Request your data export"',
        'Wait for the email with your export (may take a few hours)',
        'Download and extract the JSON file',
      ],
    },
    gemini: {
      name: 'Gemini',
      description: 'Google Gemini/Bard conversation export',
      icon: '✨',
      exportUrl: 'https://takeout.google.com/',
      exportSteps: [
        'Visit Google Takeout',
        'Deselect all products, then select only "Gemini Apps Activity"',
        'Choose JSON format and create export',
        'Wait for the download link, then download and extract',
      ],
    },
    copilot: {
      name: 'GitHub Copilot',
      description: 'GitHub Copilot Chat conversation export',
      icon: '👨‍💻',
      exportSteps: [
        'In VS Code: Extensions → Copilot → Settings → Export Chat History',
        'Or on GitHub.com: Visit your Copilot settings and request an export',
        'Download the JSON file',
      ],
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setStatus("Uploading...");
      setError(null);
      const response = await fetch(`${API_URL}/import/${source}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Import failed");
      }

      const data = await response.json();
      const countMsg = data.length === 1 ? "1 conversation" : `${data.length} conversations`;
      const dupeMsg = settings?.auto_merge_duplicates ? " (duplicates skipped)" : "";
      setStatus(`Imported ${countMsg} from ${sourceInfo[source].name}!${dupeMsg}`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <ModalShell title="Import Conversations" onClose={onClose} className="import-modal">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="source-select">Select Source</label>
          <select 
            id="source-select"
            value={source} 
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="source-select"
          >
            {Object.entries(sourceInfo).map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.name}
              </option>
            ))}
          </select>
          <p className="source-description">{sourceInfo[source].description}</p>
        </div>

        <details className="export-help">
          <summary>📥 Need your export file? Here's how to get it</summary>
          <ol>
            {sourceInfo[source].exportSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {sourceInfo[source].exportUrl && (
            <a href={sourceInfo[source].exportUrl} target="_blank" rel="noopener noreferrer" className="export-link">
              → Open {sourceInfo[source].name} export page
            </a>
          )}
        </details>

        <div className="form-group">
          <label htmlFor="file-input">Select File</label>
          <input
            id="file-input"
            type="file"
            accept="application/json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="file-input"
          />
          {file && <p className="file-name">📄 {file.name}</p>}
        </div>

        {settings?.auto_merge_duplicates && (
          <div className="import-info">
            ℹ️ Auto-merge duplicates is enabled. Existing conversations will be skipped.
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!file}>
            Import from {sourceInfo[source].name}
          </button>
        </div>
      </form>
      {status && <div className="status-success">{status}</div>}
      {error && <div className="status-error">{error}</div>}
    </ModalShell>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');
  const [settings, setSettings] = useState<ImportSettings | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/settings/import`);
      const data = await response.json();
      setSettings(data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/import/history?page_size=20`);
      const data = await response.json();
      setHistory(data.items || []);
    } catch (error) {
      console.error("Failed to load import history:", error);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/settings/import`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        const updated = await response.json();
        setSettings(updated);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ImportSettings>(key: K, value: ImportSettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const handleDeleteImport = async (historyId: number) => {
    const message = "Delete this import and all its conversations? This cannot be undone.";
    if (!confirm(message)) return;
    
    try {
      const response = await fetch(`${API_URL}/import/history/${historyId}?delete_conversations=true`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete import");
      }
      
      const result = await response.json();
      alert(`Deleted import and ${result.deleted_conversations} conversation(s)`);
      
      // Refresh history list
      await loadHistory();
    } catch (error) {
      console.error("Failed to delete import:", error);
      alert("Failed to delete import");
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      success: '#10b981',
      failure: '#ef4444',
      partial: '#f59e0b',
      processing: '#3b82f6'
    };
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        backgroundColor: colors[status] || '#6b7280',
        color: 'white'
      }}>
        {status}
      </span>
    );
  };

  return (
    <ModalShell title="Import & Export Settings" onClose={onClose} className="settings-modal">
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button 
          className={activeTab === 'import' ? 'active' : ''} 
          onClick={() => setActiveTab('import')}
          role="tab"
          aria-selected={activeTab === 'import'}
        >
          Import Settings
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
          role="tab"
          aria-selected={activeTab === 'history'}
        >
          Import History
        </button>
      </div>

      <div className="settings-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : activeTab === 'import' && settings ? (
          <div className="settings-panel">
            <div className="settings-section">
              <h3>File Format Preferences</h3>
              <div className="form-group">
                <label>Allowed Formats (comma-separated):</label>
                <input
                  type="text"
                  value={settings.allowed_formats}
                  onChange={(e) => updateSetting('allowed_formats', e.target.value)}
                  placeholder="json,csv,xml"
                />
                <small>Supported: json, csv, xml</small>
              </div>
              <div className="form-group">
                <label>Default Format:</label>
                <select
                  value={settings.default_format}
                  onChange={(e) => updateSetting('default_format', e.target.value)}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="xml">XML</option>
                </select>
              </div>
            </div>

            <div className="settings-section">
              <h3>Import Behavior</h3>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.auto_merge_duplicates}
                    onChange={(e) => updateSetting('auto_merge_duplicates', e.target.checked)}
                  />
                  Auto-merge duplicate conversations
                </label>
                <small>Automatically merge imported conversations with existing ones if they have the same source ID</small>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.keep_separate}
                    onChange={(e) => updateSetting('keep_separate', e.target.checked)}
                  />
                  Keep imported data separate
                </label>
                <small>Create separate archives for each import instead of merging with existing data</small>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.skip_empty_conversations}
                    onChange={(e) => updateSetting('skip_empty_conversations', e.target.checked)}
                  />
                  Skip empty conversations
                </label>
                <small>Don't import conversations that have no messages</small>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={onClose}>Close</button>
              <button 
                className="primary" 
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        ) : (
          <div className="history-panel">
            <div className="history-header">
              <h3>Past Imports</h3>
              <p className="text-muted">View and manage your import history</p>
            </div>
            {history.length === 0 ? (
              <div className="empty">No import history yet</div>
            ) : (
              <div className="history-list">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>File Name</th>
                      <th>Source</th>
                      <th>Format</th>
                      <th>Status</th>
                      <th>Imported</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.created_at)}</td>
                        <td className="filename">{item.filename}</td>
                        <td>{item.source_type}</td>
                        <td>{item.file_format.toUpperCase()}</td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td>{item.imported_count} conversations</td>
                        <td>
                          <button
                            className="icon-btn delete-import-btn"
                            onClick={() => handleDeleteImport(item.id)}
                            title="Delete this import and its conversations"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {history.some(h => h.error_message) && (
                  <div className="error-details">
                    <h4>Error Details</h4>
                    {history.filter(h => h.error_message).map(h => (
                      <div key={h.id} className="error-item">
                        <strong>{h.filename}:</strong> {h.error_message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function DuplicatesModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [duplicates, setDuplicates] = useState<DuplicatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<'source_id' | 'title' | 'both'>('source_id');
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const getSourceInfo = (source: string) => {
    const sources: Record<string, { icon: string; name: string }> = {
      chatgpt: { icon: '💬', name: 'ChatGPT' },
      claude: { icon: '🤖', name: 'Claude' },
      gemini: { icon: '✨', name: 'Gemini' },
      copilot: { icon: '👨‍💻', name: 'Copilot' },
    };
    return sources[source] || { icon: '📝', name: source };
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    loadDuplicates();
  }, [strategy]);

  const loadDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/conversations/duplicates?strategy=${strategy}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setDuplicates(data);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
      setDuplicates(null);
      setError("Couldn't load duplicate scan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpanded = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleSelection = (convId: number) => {
    const newSelected = new Set(selectedForDeletion);
    if (newSelected.has(convId)) {
      newSelected.delete(convId);
    } else {
      newSelected.add(convId);
    }
    setSelectedForDeletion(newSelected);
  };

  const selectAllInGroup = (group: DuplicateGroup) => {
    const newSelected = new Set(selectedForDeletion);
    group.conversations.forEach(conv => newSelected.add(conv.id));
    setSelectedForDeletion(newSelected);
  };

  const keepNewestInGroup = (group: DuplicateGroup) => {
    const sorted = [...group.conversations].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    const newSelected = new Set(selectedForDeletion);
    sorted.slice(1).forEach(conv => newSelected.add(conv.id));
    setSelectedForDeletion(newSelected);
  };

  const keepOldestInGroup = (group: DuplicateGroup) => {
    const sorted = [...group.conversations].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    const newSelected = new Set(selectedForDeletion);
    sorted.slice(1).forEach(conv => newSelected.add(conv.id));
    setSelectedForDeletion(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedForDeletion.size === 0) {
      alert("Please select conversations to delete");
      return;
    }

    const message = `Delete ${selectedForDeletion.size} conversation(s)? This cannot be undone.`;
    if (!confirm(message)) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/conversations/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_ids: Array.from(selectedForDeletion)
        })
      });

      if (!response.ok) {
        throw new Error("Failed to delete conversations");
      }

      const result = await response.json();
      alert(`Successfully deleted ${result.deleted_count} conversation(s)`);

      // Update local state instead of re-querying
      setDuplicates(prev => {
        if (!prev) return prev;
        const updatedGroups = prev.groups
          .map(group => ({
            ...group,
            conversations: group.conversations.filter(c => !selectedForDeletion.has(c.id)),
            count: group.conversations.filter(c => !selectedForDeletion.has(c.id)).length,
            total_messages: group.conversations
              .filter(c => !selectedForDeletion.has(c.id))
              .reduce((sum, c) => sum + c.message_count, 0),
          }))
          .filter(group => group.conversations.length > 1);
        return {
          ...prev,
          groups: updatedGroups,
          total_groups: updatedGroups.length,
          total_duplicates: updatedGroups.reduce((sum, g) => sum + g.count, 0),
        };
      });
      setSelectedForDeletion(new Set());
      onSuccess();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete conversations");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell
      title="Find Duplicate Conversations"
      onClose={onClose}
      className="duplicates-modal"
      actions={
        <>
          <button onClick={onClose}>Cancel</button>
          <button
            className="danger"
            onClick={handleBulkDelete}
            disabled={selectedForDeletion.size === 0 || deleting}
          >
            {deleting ? "Deleting..." : `Delete Selected (${selectedForDeletion.size})`}
          </button>
        </>
      }
    >
      <div className="strategy-selector">
        <label>Detection Method:</label>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}>
          <option value="source_id">By Source ID (original conversation ID)</option>
          <option value="title">By Title (exact match)</option>
          <option value="both">Both Methods (comprehensive)</option>
        </select>
      </div>

      {!loading && duplicates && (
        <div className="duplicates-summary">
          <div className="stat">
            <span className="label">Duplicate Groups:</span>
            <span className="value">{duplicates.total_groups}</span>
          </div>
          <div className="stat">
            <span className="label">Total Duplicates:</span>
            <span className="value">{duplicates.total_duplicates}</span>
          </div>
          <div className="stat">
            <span className="label">Selected for Deletion:</span>
            <span className="value">{selectedForDeletion.size}</span>
          </div>
        </div>
      )}

      <div className="duplicates-content">
        {loading ? (
          <div className="loading">Loading duplicates...</div>
        ) : error ? (
          <div className="status-error">{error}</div>
        ) : !duplicates || duplicates.groups.length === 0 ? (
          <div className="empty">
            <p>No duplicate conversations found!</p>
            <small>Try a different detection method or import more conversations.</small>
          </div>
        ) : (
          <div className="duplicate-groups">
            {duplicates.groups.map((group) => (
                <div key={group.key} className="duplicate-group">
                  <div
                    className="group-header"
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedGroups.has(group.key)}
                    onClick={() => toggleGroupExpanded(group.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleGroupExpanded(group.key);
                      }
                    }}
                  >
                  <div className="group-info">
                    <h3>
                      {getSourceInfo(group.source).icon} {group.title || "Untitled"}
                    </h3>
                    <div className="group-meta">
                      <span>{group.count} duplicates</span>
                      <span>•</span>
                      <span>{group.total_messages} total messages</span>
                      {group.source_id && (
                        <>
                          <span>•</span>
                          <span>ID: {group.source_id.slice(0, 8)}...</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button className="expand-btn">
                    {expandedGroups.has(group.key) ? "▼" : "▶"}
                  </button>
                </div>

                {expandedGroups.has(group.key) && (
                  <div className="group-content">
                    <div className="group-actions">
                      <button onClick={() => keepNewestInGroup(group)}>
                        Keep Newest
                      </button>
                      <button onClick={() => keepOldestInGroup(group)}>
                        Keep Oldest
                      </button>
                      <button onClick={() => selectAllInGroup(group)}>
                        Select All
                      </button>
                    </div>

                    <div className="conversations-list">
                      {group.conversations.map((conv) => (
                        <div key={conv.id} className="duplicate-conversation">
                          <input
                            type="checkbox"
                            checked={selectedForDeletion.has(conv.id)}
                            onChange={() => toggleSelection(conv.id)}
                          />
                          <div className="conv-info">
                            <div className="conv-title">
                              {conv.title || "Untitled"}
                            </div>
                            <div className="conv-details">
                              <span>ID: {conv.id}</span>
                              <span>•</span>
                              <span>{conv.message_count} messages</span>
                              {conv.created_at && (
                                <>
                                  <span>•</span>
                                  <span>{formatDateTime(conv.created_at)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function ProjectManagerModal({
  projects,
  onClose,
  onProjectsUpdated,
}: {
  projects: ProjectType[];
  onClose: () => void;
  onProjectsUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#8B5CF6");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      color: color.trim() || null,
    };

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create project.");
      }

      await onProjectsUpdated();
      resetForm();
      setStatus("Project created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: ProjectType) => {
    const message = `Delete project "${project.name}"? Conversations will become uncategorized.`;
    if (!confirm(message)) return;

    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete project.");
      }
      await onProjectsUpdated();
      setStatus("Project deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Manage Projects" onClose={onClose} className="tag-manager-modal" bodyClassName="tag-manager-content">
      <form onSubmit={handleSubmit} className="tag-form">
        <h3>Create New Project</h3>
        <div className="form-group">
          <label htmlFor="project-name">Project name</label>
          <input
            id="project-name"
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="project-description">Description</label>
          <input
            id="project-description"
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="form-group">
          <label>Color</label>
          <div className="tag-color-row">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={saving}
              aria-label="Project color"
            />
            <span className="tag-preview" style={{ backgroundColor: color }}>
              {name.trim() || "Preview"}
            </span>
          </div>
        </div>
        <div className="tag-form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
        {status && <div className="status-success">{status}</div>}
        {error && <div className="status-error">{error}</div>}
      </form>

      <div className="tag-list">
        <div className="tag-list-header">Existing projects</div>
        {projects.length === 0 ? (
          <div className="empty">No projects yet. Create one above.</div>
        ) : (
          <div className="tag-list-items">
            {projects.map((project) => (
              <div key={project.id} className="tag-row">
                <div className="tag-row-main">
                  <span className="tag-badge" style={{ backgroundColor: project.color || "#8B5CF6", color: "white" }}>
                    {project.name}
                  </span>
                  <div className="tag-row-info">
                    <div className="tag-row-name">{project.name}</div>
                    <div className="tag-row-meta">
                      {project.description || "No description"}
                    </div>
                  </div>
                </div>
                <div className="tag-row-actions">
                  <span className="tag-count">{project.conversation_count} conv</span>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(project)}
                    disabled={saving}
                    title="Delete project"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function AnalyticsDashboard({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/analytics`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const SOURCE_COLORS: Record<string, string> = {
    chatgpt: "#10B981",
    claude: "#F59E0B",
    gemini: "#3B82F6",
    copilot: "#8B5CF6",
  };

  const ROLE_COLORS: Record<string, string> = {
    user: "#3B82F6",
    assistant: "#10B981",
    system: "#F59E0B",
    tool: "#EC4899",
  };

  function HorizontalBar({ label, value, max, color, count }: {
    label: string; value: number; max: number; color: string; count: number;
  }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
          <span style={{ color: "var(--text-secondary)" }}>{count.toLocaleString()}</span>
        </div>
        <div style={{ height: 8, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
      </div>
    );
  }

  function TimelineChart({ months }: { months: { month: string; count: number }[] }) {
    if (months.length === 0) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No data yet.</p>;
    const maxCount = Math.max(...months.map((m) => m.count), 1);
    const chartH = 120;
    const barW = Math.max(16, Math.min(40, Math.floor(560 / months.length) - 4));
    const gap = 4;
    const totalW = months.length * (barW + gap);

    return (
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <svg width={Math.max(totalW, 200)} height={chartH + 36} style={{ display: "block" }}>
          {months.map((m, i) => {
            const barH = Math.max(2, (m.count / maxCount) * chartH);
            const x = i * (barW + gap);
            const labelYear = m.month.slice(0, 4);
            const labelMon = m.month.slice(5, 7);
            const isJan = labelMon === "01";
            return (
              <g key={m.month}>
                <rect
                  x={x}
                  y={chartH - barH}
                  width={barW}
                  height={barH}
                  fill="#3B82F6"
                  rx={3}
                  opacity={0.85}
                >
                  <title>{m.month}: {m.count}</title>
                </rect>
                {(isJan || months.length <= 18) && (
                  <text
                    x={x + barW / 2}
                    y={chartH + 16}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--text-muted)"
                  >
                    {isJan ? labelYear : labelMon}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  function DayChart({ activityByDay }: { activityByDay: Record<string, number> }) {
    const values = DAY_NAMES.map((_, i) => activityByDay[String(i)] || 0);
    const max = Math.max(...values, 1);
    const chartH = 80;
    const barW = 32;
    const gap = 6;

    return (
      <svg width={DAY_NAMES.length * (barW + gap)} height={chartH + 28} style={{ display: "block" }}>
        {DAY_NAMES.map((name, i) => {
          const barH = Math.max(2, (values[i] / max) * chartH);
          const x = i * (barW + gap);
          return (
            <g key={name}>
              <rect x={x} y={chartH - barH} width={barW} height={barH} fill="#8B5CF6" rx={3} opacity={0.85}>
                <title>{name}: {values[i]}</title>
              </rect>
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                {name}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <ModalShell title="Conversation Analytics" onClose={onClose} className="analytics-modal">
      {loading && (
        <div className="analytics-state">Loading analytics…</div>
      )}

      {error && (
        <div className="status-error">Failed to load analytics: {error}</div>
      )}

      {data && (
        <div className="analytics-layout">
          <div className="analytics-card-row">
            <div className="analytics-card analytics-card-blue">
              <div className="analytics-card-value">
                {data.total_conversations.toLocaleString()}
              </div>
              <div className="analytics-card-label">Total Conversations</div>
            </div>
            <div className="analytics-card analytics-card-green">
              <div className="analytics-card-value">
                {data.total_messages.toLocaleString()}
              </div>
              <div className="analytics-card-label">Total Messages</div>
            </div>
            <div className="analytics-card analytics-card-amber">
              <div className="analytics-card-value">
                {data.avg_messages_per_conversation.toFixed(1)}
              </div>
              <div className="analytics-card-label">Avg Messages / Conv.</div>
            </div>
          </div>

          <section className="analytics-section">
            <div className="analytics-section-title">Conversations Over Time</div>
            <TimelineChart months={data.conversations_by_month} />
          </section>

          <div className="analytics-two-column">
            <section className="analytics-section">
              <div className="analytics-section-title">By Source</div>
              {Object.keys(data.sources).length === 0 ? (
                <p className="analytics-empty">No data.</p>
              ) : (() => {
                const maxSrc = Math.max(...Object.values(data.sources));
                return Object.entries(data.sources)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, cnt]) => (
                    <HorizontalBar
                      key={src}
                      label={src.charAt(0).toUpperCase() + src.slice(1)}
                      value={cnt}
                      max={maxSrc}
                      color={SOURCE_COLORS[src] || "#6B7280"}
                      count={cnt}
                    />
                  ));
              })()}
            </section>

            <section className="analytics-section">
              <div className="analytics-section-title">Messages by Role</div>
              {Object.keys(data.role_distribution).length === 0 ? (
                <p className="analytics-empty">No data.</p>
              ) : (() => {
                const maxRole = Math.max(...Object.values(data.role_distribution));
                return Object.entries(data.role_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([role, cnt]) => (
                    <HorizontalBar
                      key={role}
                      label={role.charAt(0).toUpperCase() + role.slice(1)}
                      value={cnt}
                      max={maxRole}
                      color={ROLE_COLORS[role] || "#6B7280"}
                      count={cnt}
                    />
                  ));
              })()}
            </section>
          </div>

          <div className="analytics-two-column">
            <section className="analytics-section">
              <div className="analytics-section-title">Activity by Day of Week</div>
              <DayChart activityByDay={data.activity_by_day} />
            </section>

            {data.top_tags.length > 0 && (
              <section className="analytics-section">
                <div className="analytics-section-title">Top Tags</div>
                {(() => {
                  const maxTag = Math.max(...data.top_tags.map((t) => t.count));
                  return data.top_tags.map((tag) => (
                    <HorizontalBar
                      key={tag.name}
                      label={tag.name}
                      value={tag.count}
                      max={maxTag}
                      color={tag.color}
                      count={tag.count}
                    />
                  ));
                })()}
              </section>
            )}
          </div>

          {data.projects.length > 0 && (
            <section className="analytics-section">
              <div className="analytics-section-title">Conversations by Project</div>
              {(() => {
                const maxProj = Math.max(...data.projects.map((p) => p.count));
                return data.projects.map((proj) => (
                  <HorizontalBar
                    key={proj.name}
                    label={proj.name}
                    value={proj.count}
                    max={maxProj}
                    color={proj.color}
                    count={proj.count}
                  />
                ));
              })()}
            </section>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function MoveToProjectModal({
  conversation,
  projects,
  onClose,
  onMove,
}: {
  conversation: ConversationDetail;
  projects: ProjectType[];
  onClose: () => void;
  onMove: (conversationId: number, projectId: number | null) => Promise<void>;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    conversation.project?.id || null
  );
  const [moving, setMoving] = useState(false);

  const handleMove = async () => {
    setMoving(true);
    try {
      await onMove(conversation.id, selectedProjectId);
      onClose();
    } catch (error) {
      console.error("Failed to move conversation:", error);
    } finally {
      setMoving(false);
    }
  };

  return (
    <ModalShell
      title="Move to Project"
      onClose={onClose}
      className="move-project-modal"
      actions={
        <>
          <button onClick={onClose} disabled={moving}>
            Cancel
          </button>
          <button onClick={handleMove} disabled={moving} className="primary">
            {moving ? "Moving..." : "Move"}
          </button>
        </>
      }
    >
      <div className="move-project-summary">
        <p><strong>Conversation:</strong> {conversation.title || "Untitled"}</p>
        <p><strong>Current Project:</strong> {conversation.project?.name || "Uncategorized"}</p>
      </div>

      <div className="form-group">
        <label htmlFor="move-project-select"><strong>Move to:</strong></label>
        <select
          id="move-project-select"
          value={selectedProjectId !== null ? selectedProjectId.toString() : "none"}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedProjectId(val === "none" ? null : parseInt(val, 10));
          }}
        >
          <option value="none">📂 Uncategorized</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              📁 {project.name}
            </option>
          ))}
        </select>
      </div>
    </ModalShell>
  );
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ["Ctrl/Cmd + K", "Focus search"],
    ["Ctrl/Cmd + I", "Open import"],
    ["Ctrl/Cmd + ,", "Open settings"],
    ["Ctrl/Cmd + E", "Open export menu"],
    ["Ctrl/Cmd + B", "Toggle sidebar"],
    ["Arrow Up / Down", "Navigate conversations"],
    ["Esc", "Close open overlays"],
    ["Shift + ?", "Open keyboard shortcuts"],
  ];

  return (
    <ModalShell title="Keyboard Shortcuts" onClose={onClose} className="shortcut-modal">
      <div className="shortcut-list">
        {shortcuts.map(([keys, description]) => (
          <div key={keys} className="shortcut-row">
            <kbd>{keys}</kbd>
            <span>{description}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
````
