"""
Table Manager - CRUD operations for table data
"""
from sqlalchemy import text, inspect
import time
from logger import setup_logger

logger = setup_logger(__name__)


class TableManager:
    def __init__(self, db_connector):
        self.db_connector = db_connector



    def get_databases(self):
        """Get list of all available databases."""
        if not self.db_connector.engine:
            return {"success": False, "error": "Not connected to database"}
            
        try:
            databases = []
            with self.db_connector.engine.connect() as conn:
                if self.db_connector.db_type == "mysql":
                    query = "SHOW DATABASES"
                    result = conn.execute(text(query))
                    # Filter out system databases
                    system_dbs = {'information_schema', 'mysql', 'performance_schema', 'sys'}
                    databases = [row[0] for row in result.fetchall() if row[0] not in system_dbs]
                else: # postgresql
                    query = "SELECT datname FROM pg_database WHERE datistemplate = false;"
                    result = conn.execute(text(query))
                    databases = [row[0] for row in result.fetchall()]
            
            return {"success": True, "databases": sorted(databases)}
        except Exception as e:
            logger.error(f"Failed to get databases: {e}")
            return {"success": False, "error": str(e)}

    def get_tables(self):
        """Get list of all tables with basic info using optimized raw SQL."""
        if not self.db_connector.engine:
            return {"success": False, "error": "Not connected to database"}

        try:
            tables = []
            
            if self.db_connector.db_type == "mysql":
                # Single query to get all tables with column counts and primary keys
                query = """
                    SELECT 
                        t.TABLE_NAME,
                        t.TABLE_ROWS,
                        COUNT(c.COLUMN_NAME) as column_count,
                        GROUP_CONCAT(
                            CASE WHEN c.COLUMN_KEY = 'PRI' THEN c.COLUMN_NAME END
                        ) as primary_keys
                    FROM INFORMATION_SCHEMA.TABLES t
                    LEFT JOIN INFORMATION_SCHEMA.COLUMNS c 
                        ON t.TABLE_NAME = c.TABLE_NAME 
                        AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
                    WHERE t.TABLE_SCHEMA = DATABASE()
                        AND t.TABLE_TYPE = 'BASE TABLE'
                        AND t.TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
                    GROUP BY t.TABLE_NAME, t.TABLE_ROWS
                    ORDER BY t.TABLE_NAME
                """
            else:  # postgresql
                query = """
                    SELECT 
                        t.table_name,
                        COUNT(c.column_name) as column_count,
                        STRING_AGG(
                            CASE WHEN pk.column_name IS NOT NULL THEN c.column_name END, ','
                        ) as primary_keys
                    FROM information_schema.tables t
                    LEFT JOIN information_schema.columns c 
                        ON t.table_name = c.table_name 
                        AND t.table_schema = c.table_schema
                    LEFT JOIN (
                        SELECT ku.table_name, ku.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage ku 
                            ON tc.constraint_name = ku.constraint_name
                        WHERE tc.constraint_type = 'PRIMARY KEY'
                            AND tc.table_schema = current_schema()
                    ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
                    WHERE t.table_schema = current_schema()  -- Usually 'public'
                        AND t.table_type = 'BASE TABLE'
                        AND t.table_schema NOT IN ('information_schema', 'pg_catalog') 
                    GROUP BY t.table_name
                    ORDER BY t.table_name
                """
            
            with self.db_connector.engine.connect() as conn:
                result = conn.execute(text(query))
                for row in result.fetchall():
                    pk_str = row[2] if self.db_connector.db_type == "mysql" else row[2]
                    pk_index = 3 if self.db_connector.db_type == "mysql" else 2
                    pk_str = row[pk_index]
                    primary_keys = [pk for pk in (pk_str.split(',') if pk_str else []) if pk]
                    
                    tables.append({
                        "name": row[0],
                        "column_count": row[2] if self.db_connector.db_type == "mysql" else row[1],
                        "primary_keys": primary_keys
                    })
            
            return {"success": True, "tables": tables}
        except Exception as e:
            logger.error(f"Failed to get tables: {e}")
            return {"success": False, "error": str(e)}

    def get_table_structure(self, table_name):
        """Get detailed structure of a specific table using optimized raw SQL."""
        if not self.db_connector.engine:
            return {"success": False, "error": "Not connected to database"}

        try:
            columns = []
            primary_keys = []
            indexes = []
            foreign_keys = []
            
            with self.db_connector.engine.connect() as conn:
                if self.db_connector.db_type == "mysql":
                    # Get columns
                    col_query = """
                        SELECT 
                            COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
                            EXTRA, COLUMN_KEY
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name
                        ORDER BY ORDINAL_POSITION
                    """
                    result = conn.execute(text(col_query), {"table_name": table_name})
                    for row in result.fetchall():
                        columns.append({
                            "name": row[0],
                            "type": row[1],
                            "nullable": row[2] == 'YES',
                            "default": row[3],
                            "autoincrement": 'auto_increment' in (row[4] or '').lower()
                        })
                        if row[5] == 'PRI':
                            primary_keys.append(row[0])
                    
                    # Get indexes
                    idx_query = """
                        SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX), NON_UNIQUE
                        FROM INFORMATION_SCHEMA.STATISTICS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name
                        GROUP BY INDEX_NAME, NON_UNIQUE
                    """
                    result = conn.execute(text(idx_query), {"table_name": table_name})
                    for row in result.fetchall():
                        if row[0] != 'PRIMARY':  # Skip primary key index
                            indexes.append({
                                "name": row[0],
                                "columns": row[1].split(',') if row[1] else [],
                                "unique": row[2] == 0
                            })
                    
                    # Get foreign keys
                    fk_query = """
                        SELECT 
                            CONSTRAINT_NAME,
                            GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION),
                            REFERENCED_TABLE_NAME,
                            GROUP_CONCAT(REFERENCED_COLUMN_NAME ORDER BY ORDINAL_POSITION)
                        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                        WHERE TABLE_SCHEMA = DATABASE() 
                            AND TABLE_NAME = :table_name
                            AND REFERENCED_TABLE_NAME IS NOT NULL
                        GROUP BY CONSTRAINT_NAME, REFERENCED_TABLE_NAME
                    """
                    result = conn.execute(text(fk_query), {"table_name": table_name})
                    for row in result.fetchall():
                        foreign_keys.append({
                            "name": row[0],
                            "columns": row[1].split(',') if row[1] else [],
                            "referred_table": row[2],
                            "referred_columns": row[3].split(',') if row[3] else []
                        })
                
                else:  # postgresql
                    # Get columns
                    col_query = """
                        SELECT 
                            c.column_name, c.data_type, c.is_nullable, c.column_default,
                            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
                        FROM information_schema.columns c
                        LEFT JOIN (
                            SELECT ku.column_name
                            FROM information_schema.table_constraints tc
                            JOIN information_schema.key_column_usage ku 
                                ON tc.constraint_name = ku.constraint_name
                            WHERE tc.constraint_type = 'PRIMARY KEY'
                                AND tc.table_schema = current_schema()
                                AND tc.table_name = :table_name
                        ) pk ON c.column_name = pk.column_name
                        WHERE c.table_schema = current_schema() AND c.table_name = :table_name
                        ORDER BY c.ordinal_position
                    """
                    result = conn.execute(text(col_query), {"table_name": table_name})
                    for row in result.fetchall():
                        columns.append({
                            "name": row[0],
                            "type": row[1],
                            "nullable": row[2] == 'YES',
                            "default": row[3],
                            "autoincrement": 'nextval' in (row[3] or '').lower()
                        })
                        if row[4]:
                            primary_keys.append(row[0])
                    
                    # Get indexes
                    idx_query = """
                        SELECT i.relname, array_agg(a.attname), ix.indisunique
                        FROM pg_class t
                        JOIN pg_index ix ON t.oid = ix.indrelid
                        JOIN pg_class i ON i.oid = ix.indexrelid
                        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                        WHERE t.relname = :table_name AND NOT ix.indisprimary
                        GROUP BY i.relname, ix.indisunique
                    """
                    result = conn.execute(text(idx_query), {"table_name": table_name})
                    for row in result.fetchall():
                        indexes.append({
                            "name": row[0],
                            "columns": list(row[1]) if row[1] else [],
                            "unique": row[2]
                        })
                    
                    # Get foreign keys
                    fk_query = """
                        SELECT 
                            tc.constraint_name,
                            array_agg(kcu.column_name),
                            ccu.table_name,
                            array_agg(ccu.column_name)
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                        JOIN information_schema.constraint_column_usage ccu 
                            ON ccu.constraint_name = tc.constraint_name
                        WHERE tc.constraint_type = 'FOREIGN KEY'
                            AND tc.table_schema = current_schema()
                            AND tc.table_name = :table_name
                        GROUP BY tc.constraint_name, ccu.table_name
                    """
                    result = conn.execute(text(fk_query), {"table_name": table_name})
                    for row in result.fetchall():
                        foreign_keys.append({
                            "name": row[0],
                            "columns": list(row[1]) if row[1] else [],
                            "referred_table": row[2],
                            "referred_columns": list(row[3]) if row[3] else []
                        })
            
            return {
                "success": True,
                "table_name": table_name,
                "columns": columns,
                "primary_keys": primary_keys,
                "indexes": indexes,
                "foreign_keys": foreign_keys
            }
        except Exception as e:
            logger.error(f"Failed to get table structure: {e}")
            return {"success": False, "error": str(e)}

    def get_table_data(self, table_name, page=1, per_page=25, order_by=None, order_dir='asc', filters=None):
        """Get paginated table data with optional filtering."""
        if not self.db_connector.engine:
            return {"success": False, "error": "Not connected to database"}

        try:
            offset = (page - 1) * per_page
            
            # Build query - escape table name for safety
            # Note: In production, validate table_name against known tables
            
            where_clauses = []
            params = {}
            
            if filters:
                for col, val in filters.items():
                    # Simple LIKE matching for now
                    # We use named parameters to prevent SQL injection
                    clean_col = col.replace("`", "") # Basic sanitization
                    where_clauses.append(f"`{clean_col}` LIKE :filter_{clean_col}")
                    params[f"filter_{clean_col}"] = f"%{val}%"
            
            where_stmt = ""
            if where_clauses:
                where_stmt = "WHERE " + " AND ".join(where_clauses)

            order_clause = ""
            if order_by:
                direction = "DESC" if order_dir.lower() == 'desc' else "ASC"
                order_clause = f" ORDER BY `{order_by}` {direction}"
            
            # Get total count
            count_query = f"SELECT COUNT(*) as cnt FROM `{table_name}` {where_stmt}"
            
            # Get data with pagination
            data_query = f"SELECT * FROM `{table_name}` {where_stmt}{order_clause} LIMIT {per_page} OFFSET {offset}"
            
            start_time = time.time()
            with self.db_connector.engine.connect() as conn:
                # Get count
                count_result = conn.execute(text(count_query), params)
                total_count = count_result.fetchone()[0]
                
                # Get data
                result = conn.execute(text(data_query), params)
                columns = list(result.keys())
                rows = [dict(zip(columns, row)) for row in result.fetchall()]
                
                total_pages = (total_count + per_page - 1) // per_page
                
                end_time = time.time()
                execution_time = (end_time - start_time)
                
                return {
                    "success": True,
                    "table_name": table_name,
                    "columns": columns,
                    "rows": rows,
                    "sql_query": data_query,
                    "execution_time": execution_time,
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total_count": total_count,
                        "total_pages": total_pages
                    }
                }
        except Exception as e:
            logger.error(f"Failed to get table data: {e}")
            return {"success": False, "error": str(e)}

    def insert_row(self, table_name, data):
        """Insert a new row into the table."""
        if not self.db_connector.engine:
            return {"success": False, "error": "Not connected to database"}

        try:
            columns = ', '.join([f"`{k}`" for k in data.keys()])
            placeholders = ', '.join([f":{k}" for k in data.keys()])
            query = f"INSERT INTO `{table_name}` ({columns}) VALUES ({placeholders})"
            
            with self.db_connector.engine.connect() as conn:
                conn.execute(text(query), data)
                conn.commit()
                
            return {"success": True, "message": "Row inserted successfully"}
        except Exception as e:
            logger.error(f"Failed to insert row: {e}")
            return {"success": False, "error": str(e)}

    def update_row(self, table_name, primary_key_col, primary_key_val, data):
        """Update a row in the table."""
        if not self.db_connector.engine:
            return {"success": False, "error": "Not connected to database"}

        try:
            set_clause = ', '.join([f"`{k}` = :{k}" for k in data.keys()])
            query = f"UPDATE `{table_name}` SET {set_clause} WHERE `{primary_key_col}` = :pk_val"
            
            params = {**data, "pk_val": primary_key_val}
            
            with self.db_connector.engine.connect() as conn:
                result = conn.execute(text(query), params)
                conn.commit()
                
            return {"success": True, "message": "Row updated successfully", "rows_affected": result.rowcount}
        except Exception as e:
            logger.error(f"Failed to update row: {e}")
            return {"success": False, "error": str(e)}

    def delete_row(self, table_name, primary_key_col, primary_key_val):
        """Delete a row from the table."""
        if not self.db_connector.engine:
            return {"success": False, "error": "Not connected to database"}

        try:
            query = f"DELETE FROM `{table_name}` WHERE `{primary_key_col}` = :pk_val"
            
            with self.db_connector.engine.connect() as conn:
                result = conn.execute(text(query), {"pk_val": primary_key_val})
                conn.commit()
                
            return {"success": True, "message": "Row deleted successfully", "rows_affected": result.rowcount}
        except Exception as e:
            logger.error(f"Failed to delete row: {e}")
            return {"success": False, "error": str(e)}
