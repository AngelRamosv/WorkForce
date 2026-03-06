import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Plan from './pages/Plan';
import Simulator from './pages/Simulator';
import Audit from './pages/Audit';
import Reports from './pages/Reports';
import LiveDashboard from './pages/LiveDashboard';
import Vacations from './pages/Vacations';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/plan" replace />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/live" element={<LiveDashboard />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/vacations" element={<Vacations />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
