from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from db_connector import DBConnector
from schema_inspector import SchemaInspector
from llm_query_generator import LLMQueryGenerator
from query_executor import QueryExecutor
from logger import setup_logger

logger = setup_logger(__name__)

app = Flask(__name__)
# Allow CORS for all domains for MVP
CORS(app) 

# Initialize components
# Single user session, so we can keep single instances? 
# For MVP, yes. In real app, connection per session/user.
# We'll stick to a global connector for the single-user local MVP.
db_connector = DBConnector()
schema_inspector = SchemaInspector()
llm_generator = LLMQueryGenerator()
query_executor = QueryExecutor(db_connector)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "service": "DBCoPilot Backend"}), 200

@app.route('/api/connect', methods=['POST'])
def connect_db():
    data = request.json
    connection_string = data.get('connection_string')
    
    if not connection_string:
        return jsonify({"error": "Connection string required"}), 400
        
    success, message = db_connector.connect(connection_string)
    
    if success:
        # Introspect schema
        schema_success, schema_msg = schema_inspector.inspect_and_cache_schema(db_connector)
        if not schema_success:
             return jsonify({"success": True, "message": f"Connected, but schema failed: {schema_msg}"}), 200
             
        table_count, col_count = schema_inspector.get_stats()
        return jsonify({
            "success": True, 
            "message": "Connected successfully",
            "table_count": table_count,
            "column_count": col_count
        }), 200
    else:
        return jsonify({"success": False, "message": message}), 400

@app.route('/api/query/generate', methods=['POST'])
def generate_query():
    data = request.json
    question = data.get('question')
    
    if not question:
        return jsonify({"error": "Question required"}), 400
        
    schema_summary = schema_inspector.get_schema_summary()
    if not schema_summary:
        return jsonify({"error": "No schema found. Connect to DB first."}), 400
    
    result = llm_generator.generate_sql(question, schema_summary, db_connector.db_type or "SQL")
    
    if result:
        return jsonify(result), 200
    else:
        return jsonify({"error": "Failed to generate SQL"}), 500

@app.route('/api/query/execute', methods=['POST'])
def execute_query():
    data = request.json
    sql = data.get('sql')
    question = data.get('question', '') # Optional context for logging
    
    if not sql:
        return jsonify({"error": "SQL query required"}), 400
        
    result = query_executor.execute_and_log(sql, question)
    
    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@app.route('/api/query-history', methods=['GET'])
def get_history():
    limit = request.args.get('limit', 20, type=int)
    history = query_executor.get_history(limit)
    return jsonify(history), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
