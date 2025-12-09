import unittest
import json
from app import app
from unittest.mock import patch, MagicMock

class DBCoPilotTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    @patch('app.db_connector.connect')
    @patch('app.schema_inspector.inspect_and_cache_schema')
    def test_connect_success(self, mock_inspect, mock_connect):
        mock_connect.return_value = (True, "Connected successfully")
        mock_inspect.return_value = (True, "Schema cached")
        
        payload = {"connection_string": "postgresql://user:pass@localhost:5432/db"}
        response = self.app.post('/api/connect', 
                                 data=json.dumps(payload),
                                 content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

    @patch('app.llm_generator.generate_sql')
    @patch('app.schema_inspector.get_schema_summary')
    def test_generate_query(self, mock_get_schema, mock_generate):
        mock_get_schema.return_value = "Table: users, Columns: id, name"
        mock_generate.return_value = {
            "sql": "SELECT * FROM users",
            "explanation": "Selects all users",
            "confidence": "high"
        }
        
        payload = {"question": "Show all users"}
        response = self.app.post('/api/query/generate',
                                 data=json.dumps(payload),
                                 content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['sql'], "SELECT * FROM users")

    @patch('app.query_executor.execute_and_log')
    def test_execute_query(self, mock_execute):
        mock_execute.return_value = {
            "success": True,
            "rows": [{"id": 1, "name": "Alice"}],
            "columns": ["id", "name"],
            "row_count": 1,
            "execution_time_ms": 10
        }
        
        payload = {"sql": "SELECT * FROM users", "question": "Show all users"}
        response = self.app.post('/api/query/execute',
                                 data=json.dumps(payload),
                                 content_type='application/json')
                                 
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(len(data['rows']), 1)

if __name__ == '__main__':
    unittest.main()
