import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import AdminRoute from "./components/AdminRoute.jsx";
import Loader from "./components/Loader.jsx";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { APP_ROUTES } from "./utils/constants.js";

const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const MyBookingsPage = lazy(() => import("./pages/MyBookingsPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const SearchPage = lazy(() => import("./pages/SearchPage.jsx"));

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

const routeLoaderStyle = {
  display: "grid",
  placeItems: "center",
  minHeight: "50vh",
};

const RouteLoader = () => (
  <div style={routeLoaderStyle}>
    <Loader label="Loading page..." />
  </div>
);

function App() {
  return (
    <Router>
      <div style={appStyle}>
        <Navbar />

        <main style={contentStyle}>
          <Suspense fallback={<RouteLoader />}>
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
          </Suspense>
        </main>
      </div>
    </Router>
  );
}

export default App;
