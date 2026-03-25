import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import AdminRoute from "./components/AdminRoute.jsx";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MyBookingsPage from "./pages/MyBookingsPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import { APP_ROUTES } from "./utils/constants.js";

const appStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, rgba(19, 78, 74, 0.14), transparent 35%), linear-gradient(180deg, #f4fbf8 0%, #edf4ff 100%)",
  color: "#102a43",
};

const contentStyle = {
  maxWidth: "1120px",
  margin: "0 auto",
  padding: "0 20px 40px",
};

function App() {
  return (
    <Router>
      <div style={appStyle}>
        <Navbar />

        <main style={contentStyle}>
          <Routes>
            <Route path={APP_ROUTES.home} element={<DashboardPage />} />
            <Route path={APP_ROUTES.login} element={<LoginPage />} />
            <Route path={APP_ROUTES.register} element={<RegisterPage />} />
            <Route
              path={APP_ROUTES.search}
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={APP_ROUTES.bookings}
              element={
                <ProtectedRoute>
                  <MyBookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={APP_ROUTES.admin}
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to={APP_ROUTES.home} replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
