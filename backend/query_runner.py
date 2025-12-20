import asyncio
import logging
import threading
import time
from typing import Any, Dict, List, Optional, Generator
from sqlalchemy import text
from db_connector import DBConnector

logger = logging.getLogger(__name__)

class QueryRunner:
    def __init__(self, db_connector: DBConnector):
        self.db_connector = db_connector

    def run_sql_streaming(
        self, 
        sql: str, 
        cancel_event: threading.Event, 
        batch_size: int = 100
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Executes SQL and yields chunks of rows.
        Run this in a separate thread (e.g. via asyncio.to_thread).
        """
        if not self.db_connector.is_connected():
            raise Exception("Database not connected")

        engine = self.db_connector.engine
        start_time = time.time()
        row_count = 0
        
        try:
            # Connect and execute with streaming
            # execution_options(yield_per=batch_size) is key for server-side cursors on some drivers
            with engine.connect().execution_options(yield_per=batch_size) as conn:
                logger.info(f"Executing query: {sql[:50]}...")
                
                # Check cancellation before starting
                if cancel_event.is_set():
                    logger.info("Query canceled before execution")
                    return

                try:
                    result = conn.execute(text(sql))
                except Exception as e:
                    # Reraise as specific error for caller to handle
                    raise e

                # If returns rows, stream them
                if result.returns_rows:
                    columns = list(result.keys())
                    
                    while True:
                        if cancel_event.is_set():
                            logger.info("Query canceled during fetching")
                            break
                            
                        # Fetch a batch
                        chunk = result.fetchmany(batch_size)
                        if not chunk:
                            break
                            
                        # Convert to dicts or simple lists. 
                        # Lists are smaller over wire, but dicts connect to columns.
                        # Let's send rows as lists of values to save bandwidth, 
                        # as we send columns once.
                        rows = [list(row) for row in chunk]
                        row_count += len(rows)
                        
                        yield {
                            "type": "chunk",
                            "columns": columns, # Send every time? Or just first time? 
                                                # Protocol says "queryRows" has columns. 
                                                # Redundant but safe for now.
                            "rows": rows
                        }
                else:
                    # UPDATE/INSERT/DELETE
                    row_count = result.rowcount
                    
                total_time = (time.time() - start_time) * 1000
                yield {
                    "type": "done",
                    "stats": {
                        "elapsedMs": round(total_time, 2),
                        "totalRows": row_count
                    }
                }
                
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise e
