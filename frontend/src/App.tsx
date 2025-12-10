
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConnectDB } from './pages/ConnectDB';
import { QueryInterface } from './pages/QueryInterface';
import { DatabaseBrowser } from './pages/DatabaseBrowser';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/connect" replace />} />
        <Route path="/connect" element={<ConnectDB />} />
        <Route path="/browse" element={<DatabaseBrowser />} />
        <Route path="/query" element={<QueryInterface />} />
      </Routes>
    </Router>
  );
}

export default App;
