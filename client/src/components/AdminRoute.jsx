import { Navigate, useLocation } from "react-router-dom";
import Loader from "./Loader.jsx";
import { useAuth } from "../context/auth-context.js";
import { APP_ROUTES } from "../utils/constants.js";

function AdminRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return <Loader label="Restoring your session..." />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        replace
        state={{ from: location }}
        to={APP_ROUTES.login}
      />
    );
  }

  if (!["admin", "super_admin"].includes(user?.role)) {
    return <Navigate replace to={APP_ROUTES.home} />;
  }

  return children;
}

export default AdminRoute;
