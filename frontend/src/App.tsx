import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import FormulationsPage from "./pages/FormulationsPage";
import FormulationDetailPage from "./pages/FormulationDetailPage";
import MaterialsPage from "./pages/MaterialsPage";
import ColorMatchingPage from "./pages/ColorMatchingPage";
import PredictionsPage from "./pages/PredictionsPage";
import OptimizerPage from "./pages/OptimizerPage";
import AssistantPage from "./pages/AssistantPage";
import BatchesPage from "./pages/BatchesPage";
import BatchCalculatorPage from "./pages/BatchCalculatorPage";
import CostPage from "./pages/CostPage";
import ManufacturingPage from "./pages/ManufacturingPage";
import SuppliersPage from "./pages/SuppliersPage";
import PricesPage from "./pages/PricesPage";
import MachineryPage from "./pages/MachineryPage";
import MarketPage from "./pages/MarketPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import KnowledgePage from "./pages/KnowledgePage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Authenticating…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/formulations" element={<FormulationsPage />} />
        <Route path="/formulations/:id" element={<FormulationDetailPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/color-matching" element={<ColorMatchingPage />} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/optimizer" element={<OptimizerPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/batches" element={<BatchesPage />} />
        <Route path="/batch-calculator" element={<BatchCalculatorPage />} />
        <Route path="/cost" element={<CostPage />} />
        <Route path="/manufacturing" element={<ManufacturingPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/prices" element={<PricesPage />} />
        <Route path="/machinery" element={<MachineryPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
