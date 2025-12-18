from flask import Flask, request, jsonify, Response, make_response
from flask_cors import CORS
from config import Config
from db_connector import DBConnector
from schema_inspector import SchemaInspector
from llm_query_generator import LLMQueryGenerator
from query_executor import QueryExecutor
from table_manager import TableManager
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
table_manager = TableManager(db_connector)

from functools import wraps

def require_db_connection(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not db_connector.is_connected():
            # Try to auto-reconnect
            if not db_connector.try_reconnect():
                return jsonify({
                    "success": False, 
                    "error": "Database not connected. Please connect first.",
                    "code": "DB_NOT_CONNECTED"
                }), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "service": "QueryPop Backend"}), 200

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



@app.route('/api/databases', methods=['GET'])
@require_db_connection
def get_databases():
    """Get list of available databases."""
    result = table_manager.get_databases()
    if result["success"]:
        return jsonify(result), 200
    return jsonify(result), 400

@app.route('/api/connect/database', methods=['POST'])
@require_db_connection
def switch_database():
    """Switch active database."""
    data = request.json
    db_name = data.get('database')
    
    if not db_name:
        return jsonify({"success": False, "error": "Database name required"}), 400
        
    success, message = db_connector.switch_database(db_name)
    
    if success:
        # Re-introspect schema for new DB
        schema_inspector.inspect_and_cache_schema(db_connector)
        return jsonify({"success": True, "message": f"Switched to {db_name}"}), 200
    else:
        return jsonify({"success": False, "message": message}), 400

# ============ Table Management Endpoints ============

@app.route('/api/tables', methods=['GET'])
@require_db_connection
def get_tables():
    """Get list of all tables."""
    result = table_manager.get_tables()
    if result["success"]:
        return jsonify(result), 200
    return jsonify(result), 400

@app.route('/api/tables/<table_name>/structure', methods=['GET'])
@require_db_connection
def get_table_structure(table_name):
    """Get structure of a specific table."""
    result = table_manager.get_table_structure(table_name)
    if result["success"]:
        return jsonify(result), 200
    return jsonify(result), 400

@app.route('/api/tables/<table_name>/data', methods=['GET'])
@require_db_connection
def get_table_data(table_name):
    """Get paginated data from a table."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    order_by = request.args.get('order_by', None)
    order_dir = request.args.get('order_dir', 'asc')
    
    result = table_manager.get_table_data(table_name, page, per_page, order_by, order_dir)
    if result["success"]:
        return jsonify(result), 200
    return jsonify(result), 400

@app.route('/api/tables/<table_name>/rows', methods=['POST'])
@require_db_connection
def insert_row(table_name):
    """Insert a new row into the table."""
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Row data required"}), 400
    
    result = table_manager.insert_row(table_name, data)
    if result["success"]:
        return jsonify(result), 201
    return jsonify(result), 400

@app.route('/api/tables/<table_name>/rows/<pk_value>', methods=['PUT'])
@require_db_connection
def update_row(table_name, pk_value):
    """Update a row in the table."""
    data = request.json
    pk_column = request.args.get('pk_column', 'id')
    
    if not data:
        return jsonify({"success": False, "error": "Row data required"}), 400
    
    result = table_manager.update_row(table_name, pk_column, pk_value, data)
    if result["success"]:
        return jsonify(result), 200
    return jsonify(result), 400

@app.route('/api/tables/<table_name>/rows/<pk_value>', methods=['DELETE'])
@require_db_connection
def delete_row(table_name, pk_value):
    """Delete a row from the table."""
    pk_column = request.args.get('pk_column', 'id')
    
    result = table_manager.delete_row(table_name, pk_column, pk_value)
    if result["success"]:
        return jsonify(result), 200
    return jsonify(result), 400

# ============ Query Endpoints ============

@app.route('/api/query/generate', methods=['POST'])
@require_db_connection
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
@require_db_connection
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
@require_db_connection
def get_history():
    limit = request.args.get('limit', 20, type=int)
    history = query_executor.get_history(limit)
    return jsonify(history), 200

# ============ Export Endpoints ============

@app.route('/api/tables/<table_name>/export/csv', methods=['GET'])
@require_db_connection
def export_table_csv(table_name):
    """Export table data as CSV."""
    from export_manager import ExportManager
    export_manager = ExportManager(db_connector)
    
    csv_content, error = export_manager.export_to_csv(table_name)
    if error:
        return jsonify({"success": False, "error": error}), 400
    
    response = make_response(csv_content)
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename={table_name}.csv'
    return response

@app.route('/api/tables/<table_name>/export/sql', methods=['GET'])
@require_db_connection
def export_table_sql(table_name):
    """Export table as SQL."""
    from export_manager import ExportManager
    export_manager = ExportManager(db_connector)
    
    sql_content, error = export_manager.export_to_sql(table_name)
    if error:
        return jsonify({"success": False, "error": error}), 400
    
    response = make_response(sql_content)
    response.headers['Content-Type'] = 'application/sql'
    response.headers['Content-Disposition'] = f'attachment; filename={table_name}.sql'
    return response

@app.route('/api/export/database', methods=['GET'])
@require_db_connection
def export_database():
    """Export entire database as SQL."""
    from export_manager import ExportManager
    export_manager = ExportManager(db_connector)
    
    sql_content, error = export_manager.export_database_sql()
    if error:
        return jsonify({"success": False, "error": error}), 400
    
    response = make_response(sql_content)
    response.headers['Content-Type'] = 'application/sql'
    response.headers['Content-Disposition'] = 'attachment; filename=database_export.sql'
    return response

# ============ Import Endpoints ============

@app.route('/api/import/sql', methods=['POST'])
@require_db_connection
def import_sql():
    """Import SQL file."""
    from import_manager import ImportManager
    import_manager = ImportManager(db_connector)
    
    # Check for file upload
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400
        sql_content = file.read().decode('utf-8')
    elif request.json and 'sql' in request.json:
        sql_content = request.json['sql']
    else:
        return jsonify({"success": False, "error": "No SQL content provided"}), 400
    
    result = import_manager.import_sql(sql_content)
    if result["success"]:
        # Refresh schema cache after import
        schema_inspector.inspect_and_cache_schema(db_connector)
        return jsonify(result), 200
    return jsonify(result), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
