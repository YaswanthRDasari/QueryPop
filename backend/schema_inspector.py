import os
import sqlite3
import json
from sqlalchemy import inspect
from config import Config
from logger import setup_logger

logger = setup_logger(__name__)

class SchemaInspector:
    def __init__(self):
        self.app_db_path = Config.APP_DB_PATH
        self._init_cache_db()

    def _init_cache_db(self):
        """Initialize the local SQLite DB for caching schema."""
        os.makedirs(os.path.dirname(self.app_db_path), exist_ok=True)
        try:
            with sqlite3.connect(self.app_db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS schema_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        table_name TEXT,
                        columns_json TEXT, -- List of {name, type}
                        row_count INTEGER,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                # We clear cache on restart for MVP simplicity or just manage it? 
                # PROMPT: "cached in SQLite locally; refresh on demand"
                # Let's clean it on "connect" usually.
        except Exception as e:
            logger.error(f"Failed to init cache DB: {e}")

    def inspect_and_cache_schema(self, db_connector):
        """
        Introspects the connected DB and saves metadata to local cache.
        """
        if not db_connector.engine:
            return False, "No database connection"

        try:
            inspector = db_connector.get_inspector()
            
            # Clear old cache (for MVP we assume one active connection schema)
            with sqlite3.connect(self.app_db_path) as local_conn:
                local_conn.execute("DELETE FROM schema_cache")
                
                table_names = inspector.get_table_names()
                logger.info(f"Found tables: {table_names}")
                
                for table in table_names:
                    # Get columns
                    columns = []
                    for col in inspector.get_columns(table):
                        columns.append({
                            "name": col["name"],
                            "type": str(col["type"])
                        })
                    
                    # Estimate row count (optional, can be slow on big tables)
                    # We'll skip exact count for big tables if needed, but for MVP SELECT count(*) is okay?
                    # Or just 0 if too risky. Let's try to get simple count if safe.
                    # Actually, inspector doesn't give row count easily. 
                    # We can run SELECT count(*) FROM table using the connection.
                    # But be careful with huge tables.
                    # For MVP, maybe skip row count or do a quick estimate if possible.
                    # Let's skip row count execution to be fast/safe, just cache structure.
                    row_count = 0 
                    
                    local_conn.execute(
                        "INSERT INTO schema_cache (table_name, columns_json, row_count) VALUES (?, ?, ?)",
                        (table, json.dumps(columns), row_count)
                    )
            
            return True, f"Schema cached for {len(table_names)} tables"

        except Exception as e:
            logger.error(f"Schema inspection failed: {e}")
            return False, f"Schema inspection failed: {str(e)}"

    def get_schema_summary(self):
        """
        Returns a string representation of the schema for the LLM.
        """
        try:
            summary_lines = []
            with sqlite3.connect(self.app_db_path) as conn:
                cursor = conn.execute("SELECT table_name, columns_json FROM schema_cache")
                rows = cursor.fetchall()
                
                for table, cols_json in rows:
                    cols = json.loads(cols_json)
                    col_strs = [f"{c['name']} ({c['type']})" for c in cols]
                    summary_lines.append(f"Table: {table}")
                    summary_lines.append(f"Columns: {', '.join(col_strs)}")
                    summary_lines.append("---")
            
            return "\n".join(summary_lines)
        except Exception as e:
            logger.error(f"Failed to get schema summary: {e}")
            return ""

    def get_stats(self):
        """Return (table_count, column_count_total)"""
        try:
            with sqlite3.connect(self.app_db_path) as conn:
                cursor = conn.execute("SELECT columns_json FROM schema_cache")
                rows = cursor.fetchall()
                table_count = len(rows)
                col_count = sum(len(json.loads(r[0])) for r in rows)
                return table_count, col_count
        except:
            return 0, 0
