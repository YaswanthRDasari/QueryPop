from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError
from logger import setup_logger

logger = setup_logger(__name__)

class DBConnector:
    def __init__(self):
        self.engine = None
        self.connection_string = None
        self.db_type = None # 'mysql' or 'postgresql'

    def switch_database(self, db_name):
        """Switches the active connection to a different database."""
        if not self.connection_string:
             return False, "No active connection"
        
        try:
            from sqlalchemy.engine.url import make_url
            
            # Parse current URL
            url = make_url(self.connection_string)
            
            # Update database
            new_url = url.set(database=db_name)
            
            # Connect with new URL (explicitly reveal password for connection string)
            success, msg = self.connect(new_url.render_as_string(hide_password=False))
            return success, msg
        except Exception as e:
            logger.error(f"Failed to switch database: {e}")
            return False, str(e)



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

            # DEBUG: Print the processed connection string (careful with secrets)
            safe_conn_string = processed_conn_string
            if "@" in safe_conn_string:
                part1, part2 = safe_conn_string.rsplit("@", 1)
                if ":" in part1:
                    # mask password
                    scheme_user, _ = part1.rsplit(":", 1)
                    safe_conn_string = f"{scheme_user}:***@{part2}"
            logger.info(f"DEBUG: Connecting with: {safe_conn_string}")

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
            
            logger.info(f"Successfully connected to {self.db_type} DB")
            return True, "Connected successfully"

        except SQLAlchemyError as e:
            error_msg = str(e)
            logger.error(f"Connection failed: {error_msg}")
            
            # Check for common MySQL connection errors
            if "2003" in error_msg and "timed out" in error_msg:
                return False, (
                    "Connection timed out. This is usually due to network or firewall settings.\n"
                    "1. Check AWS RDS Security Group to allow inbound traffic from your IP.\n"
                    "2. Ensure the RDS instance is 'Publicly Accessible' if connecting from outside VPC."
                )
            
            return False, f"Connection failed: {error_msg}"
        except Exception as e:
            logger.exception("Detailed Connection Error Traceback:") # This prints the full stack trace
            error_msg = str(e)
    def get_connection_details(self):
        """Returns safe connection details (host, user, db, type)."""
        if not self.connection_string:
            return None
        try:
            from sqlalchemy.engine.url import make_url
            url = make_url(self.connection_string)
            return {
                "type": self.db_type,
                "host": url.host,
                "port": url.port,
                "user": url.username,
                "database": url.database
            }
        except Exception as e:
            logger.error(f"Failed to parse connection string: {e}")
            return None

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
