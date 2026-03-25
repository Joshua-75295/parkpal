import { Navigate, useLocation } from "react-router-dom";
import Loader from "./Loader.jsx";
import { useAuth } from "../context/auth-context.js";
import { APP_ROUTES } from "../utils/constants.js";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <Loader label="Restoring your session..." />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={APP_ROUTES.login}
        replace
        state={{ from: location }}
      />
    );
  }

  return children;
}

export default ProtectedRoute;
