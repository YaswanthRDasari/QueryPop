"""
Export Manager - Export table data to various formats
"""
import csv
import io
from sqlalchemy import text
from logger import setup_logger

logger = setup_logger(__name__)


class ExportManager:
    def __init__(self, db_connector):
        self.db_connector = db_connector

    def export_to_csv(self, table_name):
        """Export table data to CSV format."""
        if not self.db_connector.engine:
            return None, "Not connected to database"

        try:
            query = f"SELECT * FROM `{table_name}`"
            
            with self.db_connector.engine.connect() as conn:
                result = conn.execute(text(query))
                columns = list(result.keys())
                rows = result.fetchall()
            
            # Create CSV in memory
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow(columns)
            
            # Write data rows
            for row in rows:
                writer.writerow(row)
            
            csv_content = output.getvalue()
            output.close()
            
            return csv_content, None
            
        except Exception as e:
            logger.error(f"CSV export failed: {e}")
            return None, str(e)

    def export_to_sql(self, table_name, include_structure=True):
        """Export table to SQL INSERT statements."""
        if not self.db_connector.engine:
            return None, "Not connected to database"

        try:
            sql_statements = []
            
            # Get table structure if requested
            if include_structure:
                # For MySQL, get CREATE TABLE statement
                try:
                    with self.db_connector.engine.connect() as conn:
                        result = conn.execute(text(f"SHOW CREATE TABLE `{table_name}`"))
                        row = result.fetchone()
                        if row:
                            create_stmt = row[1] if len(row) > 1 else row[0]
                            sql_statements.append(f"-- Table structure for `{table_name}`")
                            sql_statements.append(f"DROP TABLE IF EXISTS `{table_name}`;")
                            sql_statements.append(create_stmt + ";")
                            sql_statements.append("")
                except Exception as e:
                    logger.warning(f"Could not get CREATE TABLE: {e}")
            
            # Get data
            query = f"SELECT * FROM `{table_name}`"
            
            with self.db_connector.engine.connect() as conn:
                result = conn.execute(text(query))
                columns = list(result.keys())
                rows = result.fetchall()
            
            if rows:
                sql_statements.append(f"-- Data for `{table_name}`")
                
                for row in rows:
                    values = []
                    for val in row:
                        if val is None:
                            values.append("NULL")
                        elif isinstance(val, str):
                            escaped = val.replace("'", "''")
                            values.append(f"'{escaped}'")
                        elif isinstance(val, (int, float)):
                            values.append(str(val))
                        else:
                            escaped = str(val).replace("'", "''")
                            values.append(f"'{escaped}'")
                    
                    cols_str = ", ".join([f"`{c}`" for c in columns])
                    vals_str = ", ".join(values)
                    sql_statements.append(f"INSERT INTO `{table_name}` ({cols_str}) VALUES ({vals_str});")
            
            return "\n".join(sql_statements), None
            
        except Exception as e:
            logger.error(f"SQL export failed: {e}")
            return None, str(e)

    def export_database_sql(self):
        """Export all tables to SQL format."""
        if not self.db_connector.engine:
            return None, "Not connected to database"

        try:
            from sqlalchemy import inspect
            inspector = inspect(self.db_connector.engine)
            tables = inspector.get_table_names()
            
            all_sql = []
            all_sql.append("-- QueryPop Database Export")
            all_sql.append(f"-- Tables: {len(tables)}")
            all_sql.append("")
            
            for table in tables:
                sql_content, error = self.export_to_sql(table, include_structure=True)
                if sql_content:
                    all_sql.append(sql_content)
                    all_sql.append("")
            
            return "\n".join(all_sql), None
            
        except Exception as e:
            logger.error(f"Database export failed: {e}")
            return None, str(e)
