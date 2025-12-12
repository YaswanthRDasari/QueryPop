from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError
from logger import setup_logger

logger = setup_logger(__name__)

class DBConnector:
    def __init__(self):
        self.engine = None
        self.connection_string = None
        self.db_type = None # 'mysql' or 'postgresql'
        self.config_file = "db_config.json"
        
        # Try to auto-connect on initialization
        self.try_reconnect()

    def save_config(self, connection_string):
        """Saves the working connection string to a local file."""
        import json
        import os
        try:
            with open(self.config_file, 'w') as f:
                json.dump({"connection_string": connection_string}, f)
        except Exception as e:
            logger.error(f"Failed to save db config: {str(e)}")

    def load_config(self):
        """Loads the connection string from the local file."""
        import json
        import os
        if not os.path.exists(self.config_file):
            return None
        
        try:
            with open(self.config_file, 'r') as f:
                data = json.load(f)
                return data.get("connection_string")
        except Exception as e:
            logger.error(f"Failed to load db config: {str(e)}")
            return None

    def try_reconnect(self):
        """Attempts to reconnect using the saved configuration."""
        saved_conn_str = self.load_config()
        if saved_conn_str:
            logger.info("Found saved DB config. Attempting auto-reconnect...")
            success, msg = self.connect(saved_conn_str)
            if success:
                logger.info("Auto-reconnection successful.")
            else:
                logger.warning(f"Auto-reconnection failed: {msg}")
            return success
        return False

    def is_connected(self):
        """Checks if there is an active engine."""
        return self.engine is not None

    def connect(self, connection_string):
        """
        Validates and establishes a connection to the database.
        Returns (success, message).
        """
        try:
            logger.info(f"Attempting connection with string repr: {repr(connection_string)}")
            
            # Sanitize input: Remove null bytes and strip whitespace
            if not connection_string:
                return False, "Connection string cannot be empty"
            
            # Log if we find null bytes
            if '\x00' in connection_string:
                logger.warning("Found null bytes in connection string! removing them.")
                
            connection_string = connection_string.replace('\x00', '').strip()
            
            # Basic validation of string format
            db_type = None
            processed_conn_string = connection_string
            
            if connection_string.startswith("mysql://"):
                db_type = "mysql"
                # Use pymysql instead of mysql-connector-python to avoid corruption issues
                processed_conn_string = connection_string.replace("mysql://", "mysql+pymysql://", 1)
            elif connection_string.startswith("postgres://") or connection_string.startswith("postgresql://"):
                db_type = "postgresql"
                if connection_string.startswith("postgres://"):
                    # SQLAlchemy 1.4+ prefers postgresql://
                    processed_conn_string = connection_string.replace("postgres://", "postgresql://", 1)
            else:
                return False, "Unsupported database type. Use mysql:// or postgresql://"

            # Create engine. echo=False to avoid spamming logs with SQL
            # pool_pre_ping=True helps detect stale connections
            engine = create_engine(processed_conn_string, echo=False, pool_pre_ping=True)
            
            # Test connection
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            # Only update state if successful
            self.engine = engine
            self.connection_string = connection_string
            self.db_type = db_type
            
            # Persist successful connection string
            self.save_config(connection_string)
            
            logger.info(f"Successfully connected to {self.db_type} DB")
            return True, "Connected successfully"

        except SQLAlchemyError as e:
            error_msg = str(e)
            logger.error(f"Connection failed: {error_msg}")
            return False, f"Connection failed: {error_msg}"
        except Exception as e:
            logger.exception("Detailed Connection Error Traceback:") # This prints the full stack trace
            error_msg = str(e)
            return False, f"Unexpected error: {error_msg}"

    def get_inspector(self):
        if not self.engine:
            raise Exception("Not connected to any database")
        return inspect(self.engine)

    def execute_query(self, sql_query):
        """
        Executes a raw SQL query and returns results.
        Should only be called after safety validation.
        """
        if not self.engine:
            raise Exception("Not connected to database")
            
        try:
            with self.engine.connect() as conn:
                # Use stream_results for large datasets if needed, but MVP limits rows
                result = conn.execute(text(sql_query))
                
                # Check if query returns rows (SELECT)
                if result.returns_rows:
                    columns = list(result.keys())
                    rows = [dict(zip(columns, row)) for row in result.fetchall()]
                    return {
                        "success": True,
                        "columns": columns,
                        "rows": rows,
                        "row_count": len(rows)
                    }
                else:
                    # Non-SELECT queries (though validation should prevent these)
                    return {
                        "success": True,
                        "columns": [],
                        "rows": [],
                        "row_count": result.rowcount
                    }
        except SQLAlchemyError as e:
            logger.error(f"Query execution error: {str(e)}")
            return {"success": False, "error": str(e)}
