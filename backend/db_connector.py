from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError
from logger import setup_logger

logger = setup_logger(__name__)

class DBConnector:
    def __init__(self):
        self.engine = None
        self.connection_string = None
        self.db_type = None # 'mysql' or 'postgresql'

    def connect(self, connection_string):
        """
        Validates and establishes a connection to the database.
        Returns (success, message).
        """
        try:
            # Basic validation of string format
            if connection_string.startswith("mysql://"):
                self.db_type = "mysql"
                # Replace mysql:// with mysql+mysqlconnector:// to use mysql-connector-python
                connection_string = connection_string.replace("mysql://", "mysql+mysqlconnector://", 1)
            elif connection_string.startswith("postgres://") or connection_string.startswith("postgresql://"):
                self.db_type = "postgresql"
                if connection_string.startswith("postgres://"):
                    # SQLAlchemy 1.4+ prefers postgresql://
                    connection_string = connection_string.replace("postgres://", "postgresql://", 1)
            else:
                return False, "Unsupported database type. Use mysql:// or postgresql://"

            self.connection_string = connection_string
            # Create engine. echo=False to avoid spamming logs with SQL
            # pool_pre_ping=True helps detect stale connections
            self.engine = create_engine(connection_string, echo=False, pool_pre_ping=True)
            
            # Test connection
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            logger.info(f"Successfully connected to {self.db_type} DB")
            return True, "Connected successfully"

        except SQLAlchemyError as e:
            logger.error(f"Connection failed: {str(e)}")
            return False, f"Connection failed: {str(e)}"
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return False, f"Unexpected error: {str(e)}"

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
