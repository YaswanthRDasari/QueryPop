import asyncio
import json
import logging
import threading
import uuid
from typing import Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.wsgi import WSGIMiddleware
import os


# Set flag before importing Flask app to prevent double CORS headers
os.environ["FASTAPI_MODE"] = "1"

# Import existing Flask app and components
from app import app as flask_app, db_connector
from query_runner import QueryRunner
from logger import setup_logger

# Setup logging
logger = setup_logger("fastapi_main")

# Initialize FastAPI
app = FastAPI()

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize QueryRunner
query_runner = QueryRunner(db_connector)

# Store active queries: query_id -> { "cancel_event": Event, "task": asyncio.Task }
active_queries: Dict[str, Dict[str, Any]] = {}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    """
    WebSocket endpoint for SQL console.
    """
    # Authenticate (Stub)
    if not token:
        # For simplicity, we might allow no token for local dev or reject
        pass 
        # await websocket.close(code=4001)
        # return

    await websocket.accept()
    
    connection_id = str(uuid.uuid4())
    logger.info(f"WebSocket connected: {connection_id}")

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                request_id = message.get("requestId")
                payload = message.get("payload", {})

                if msg_type == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "requestId": request_id,
                        "payload": {}
                    })

                elif msg_type == "runQuery":
                    await handle_run_query(websocket, request_id, payload)

                elif msg_type == "cancelQuery":
                    query_id = payload.get("queryId")
                    if query_id and query_id in active_queries:
                        active_queries[query_id]["cancel_event"].set()
                        await websocket.send_json({
                            "type": "queryCanceled",
                            "payload": {"queryId": query_id}
                        })
                        logger.info(f"Canceled query {query_id}")

            except json.JSONDecodeError:
                logger.error("Invalid JSON received")
            except Exception as e:
                logger.error(f"Error processing message: {e}")

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
        # Cancel all active queries for this connection? 
        # We need to track which queries belong to this connection if we support multiple Tabs per socket.
        # For now, let's just leave them or cleanup if we tracked them.
        pass

async def handle_run_query(websocket: WebSocket, request_id: str, payload: Dict[str, Any]):
    sql = payload.get("sql")
    query_id = str(uuid.uuid4())
    
    # Notify accepted
    await websocket.send_json({
        "type": "queryAccepted",
        "requestId": request_id,
        "payload": {"queryId": query_id}
    })

    # Prepare cancellation
    cancel_event = threading.Event()
    
    # Define async wrapper for streaming
    async def stream_query():
        try:
            # Inform UI running
            await websocket.send_json({
                "type": "queryProgress",
                "payload": {"queryId": query_id, "status": "running", "rowsSent": 0}
            })

            # Run blocking generator in thread pool
            iterator = await asyncio.to_thread(
                query_runner.run_sql_streaming, 
                sql, 
                cancel_event
            )
            
            # Iterate over the generator. 
            # Note: The generator yields chunks. The generator execution itself happens in the thread 
            # but we need to iterate it. 
            # Wait, `run_sql_streaming` is a generator function. 
            # Calling it returns a generator object immediately. 
            # We need to iterate over the generator object, which will execute code.
            # BUT the generator code needs to run in the thread.
            # So `asyncio.to_thread` on the generator function just returns the generator object, it doesn't run it.
            
            # Correction: We need a helper that runs the iteration in the thread and pushes into a queue, 
            # OR we simply iterate in the thread and use a callback to the loop?
            # Or use `run_in_executor` to iterate?
            
            # Let's adjust: We can use an async iterator wrapper if we modify `query_runner`?
            # Or simpler: run the WHOLE loop in the thread, and use `asyncio.run_coroutine_threadsafe` 
            # to send messages back to the websocket?
            
            # Let's try the `run_coroutine_threadsafe` approach. It's robust for this.
            
            # However, I need to pass the `loop` to the thread.
            loop = asyncio.get_event_loop()
            
            def thread_target():
                try:
                    gen = query_runner.run_sql_streaming(sql, cancel_event)
                    for chunk in gen:
                        if chunk["type"] == "chunk":
                             # Send chunk
                             asyncio.run_coroutine_threadsafe(
                                 websocket.send_json({
                                     "type": "queryRows",
                                     "payload": {
                                         "queryId": query_id,
                                         "columns": chunk["columns"],
                                         "rows": chunk["rows"]
                                     }
                                 }), loop
                             ).result() # Wait for send? Or fire and forget? 
                             # `result()` waits, which provides backpressure! Nice.
                             
                        elif chunk["type"] == "done":
                            asyncio.run_coroutine_threadsafe(
                                websocket.send_json({
                                    "type": "queryDone",
                                    "payload": {
                                        "queryId": query_id,
                                        "stats": chunk["stats"]
                                    }
                                }), loop
                            ).result()
                            
                except Exception as e:
                    asyncio.run_coroutine_threadsafe(
                        websocket.send_json({
                            "type": "queryError",
                            "payload": {
                                "queryId": query_id,
                                "message": str(e)
                            }
                        }), loop
                    )

            # Start the thread
            await asyncio.to_thread(thread_target)
            
        except Exception as e:
            logger.error(f"Async wrapper error: {e}")
        finally:
            active_queries.pop(query_id, None)

    # Start task
    task = asyncio.create_task(stream_query())
    active_queries[query_id] = {"cancel_event": cancel_event, "task": task}


# Mount Flask app for REST API
# Path /api and others fall through to Flask
app.mount("/", WSGIMiddleware(flask_app))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
