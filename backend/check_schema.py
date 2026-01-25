import sqlite3
conn = sqlite3.connect('chatarchive.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(conversations)")
columns = cursor.fetchall()
print("Conversations columns:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")
conn.close()
