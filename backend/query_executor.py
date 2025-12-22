import re
import time
import sqlite3
from sqlalchemy import inspect
from config import Config
from logger import setup_logger
from safety_validator import SafetyValidator

logger = setup_logger(__name__)

class QueryExecutor:
    def __init__(self, db_connector):
        self.db_connector = db_connector
        self.app_db_path = Config.APP_DB_PATH
        self._init_history_db()

    def _init_history_db(self):
        try:
            with sqlite3.connect(self.app_db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS query_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        question TEXT,
                        sql TEXT,
                        status TEXT,
                        execution_time_ms REAL,
                        row_count INTEGER,
                        error_message TEXT
                    )
                """)
        except Exception as e:
            logger.error(f"Failed to init history DB: {e}")

    def execute_and_log(self, sql_query, question=""):
        """
        Validates, executes, and logs a query.
        """
        start_time = time.time()
        status = "error"
        row_count = 0
        execution_time_ms = 0
        error_msg = None
        result = None

        # 1. Safety Check
        is_safe, reason = SafetyValidator.validate(sql_query)
        if not is_safe:
            error_msg = f"Safety Warning: {reason}"
            self._log_query(question, sql_query, "blocked", 0, 0, error_msg)
            return {"success": False, "error": error_msg}

        # 2. Execution
        try:
            # Timeout logic could be here or in db_connector. 
            # For MVP, let's rely on DB driver timeout or simple threading if needed.
            # db_connector.execute_query is synchronous.
            # We can use a thread with timeout if strict 30s is required.
            # Implementation pending threading complexity, for now assumes db driver handles reasonable timeouts
            # or we set query timeout in connection args.
            
            result = self.db_connector.execute_query(sql_query)
            
            execution_time_ms = (time.time() - start_time) * 1000
            
            if result.get("success"):
                status = "success"
                row_count = result.get("row_count", 0)
                
                # Try to detect table and PK for editing
                affected_table = None
                primary_keys = []
                
                try:
                    # Simple regex to find single table SELECT
                    # Matches: SELECT ... FROM `table` ... or FROM table ...
                    # Ignores queries with JOIN, comma-separated tables (implicit join)
                    # This is conservative to avoid enabling editing on ambiguous results
                    
                    # Normalize spaces
                    clean_sql = ' '.join(sql_query.split())
                    
                    # Check for explicit JOIN or comma joins
                    if " JOIN " in clean_sql.upper() or "," in clean_sql.upper().split(" FROM ")[-1]:
                        pass # Complex query, skip editing
                    else:
                        match = re.search(r'(?i)FROM\s+[`"]?([a-zA-Z0-9_]+)[`"]?', clean_sql)
                        if match:
                            table_name = match.group(1)
                            # Verify table exists and get PKs
                            inspector = self.db_connector.get_inspector()
                            if inspector.has_table(table_name):
                                affected_table = table_name
                                pk_constraint = inspector.get_pk_constraint(table_name)
                                if pk_constraint and pk_constraint.get("constrained_columns"):
                                    primary_keys = pk_constraint["constrained_columns"]
                except Exception as e:
                    logger.warning(f"Failed to detect table metadata: {e}")

                return {
                    "success": True, 
                    "rows": result["rows"], 
                    "columns": result["columns"],
                    "execution_time_ms": execution_time_ms,
                    "row_count": row_count,
                    "affected_table": affected_table,
                    "primary_keys": primary_keys
                }
            else:
                error_msg = result.get("error")
                return {"success": False, "error": error_msg}
                
        except Exception as e:
            execution_time_ms = (time.time() - start_time) * 1000
            error_msg = str(e)
            logger.error(f"Execution exception: {e}")
            return {"success": False, "error": error_msg}
            
        finally:
            self._log_query(question, sql_query, status, execution_time_ms, row_count, error_msg)

    def _log_query(self, question, sql, status, exec_time, rows, error):
        try:
            with sqlite3.connect(self.app_db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO query_history 
                    (question, sql, status, execution_time_ms, row_count, error_message)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (question, sql, status, exec_time, rows, error)
                )
        except Exception as e:
            logger.error(f"Failed to log query history: {e}")

    def get_history(self, limit=20):
        try:
            with sqlite3.connect(self.app_db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT * FROM query_history ORDER BY timestamp DESC LIMIT ?", 
                    (limit,)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to fetch history: {e}")
            return []
