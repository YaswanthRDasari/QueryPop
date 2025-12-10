"""
Import Manager - Import SQL files into the database
"""
from sqlalchemy import text
from logger import setup_logger

logger = setup_logger(__name__)


class ImportManager:
    def __init__(self, db_connector):
        self.db_connector = db_connector

    def import_sql(self, sql_content):
        """Import SQL statements into the database."""
        if not self.db_connector.engine:
            return {"success": False, "error": "Not connected to database"}

        try:
            # Split SQL content into individual statements
            statements = self._parse_sql_statements(sql_content)
            
            executed = 0
            errors = []
            
            with self.db_connector.engine.connect() as conn:
                for stmt in statements:
                    stmt = stmt.strip()
                    if not stmt or stmt.startswith('--'):
                        continue
                    
                    try:
                        conn.execute(text(stmt))
                        executed += 1
                    except Exception as e:
                        error_msg = f"Error executing: {stmt[:50]}... - {str(e)}"
                        errors.append(error_msg)
                        logger.warning(error_msg)
                
                conn.commit()
            
            result = {
                "success": True,
                "statements_executed": executed,
                "message": f"Successfully executed {executed} statements"
            }
            
            if errors:
                result["warnings"] = errors[:10]  # Limit to first 10 errors
                result["warning_count"] = len(errors)
            
            return result
            
        except Exception as e:
            logger.error(f"SQL import failed: {e}")
            return {"success": False, "error": str(e)}

    def _parse_sql_statements(self, sql_content):
        """Parse SQL content into individual statements."""
        statements = []
        current_statement = []
        in_string = False
        string_char = None
        
        for line in sql_content.split('\n'):
            line = line.strip()
            
            # Skip empty lines and comments
            if not line or line.startswith('--'):
                continue
            
            i = 0
            while i < len(line):
                char = line[i]
                
                # Handle string literals
                if char in ("'", '"') and (i == 0 or line[i-1] != '\\'):
                    if not in_string:
                        in_string = True
                        string_char = char
                    elif char == string_char:
                        in_string = False
                
                # Check for statement end
                if char == ';' and not in_string:
                    current_statement.append(line[:i+1])
                    statements.append(' '.join(current_statement))
                    current_statement = []
                    line = line[i+1:].strip()
                    i = -1
                
                i += 1
            
            if line:
                current_statement.append(line)
        
        # Add any remaining statement
        if current_statement:
            remaining = ' '.join(current_statement).strip()
            if remaining:
                statements.append(remaining)
        
        return statements
