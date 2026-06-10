import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import EnquiryListPage from "../pages/Enquiries/EnquiryListPage";

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="enquiries" element={<EnquiryListPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;