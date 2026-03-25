import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import { useAuth } from "../context/auth-context.js";
import { getApiErrorMessage } from "../services/api.js";
import { loginUser } from "../services/authService.js";
import { APP_ROUTES } from "../utils/constants.js";

const wrapperStyle = {
  display: "grid",
  placeItems: "center",
  padding: "48px 0",
};

const cardStyle = {
  width: "100%",
  maxWidth: "460px",
  background: "#ffffff",
  borderRadius: "24px",
  padding: "28px",
  border: "1px solid rgba(16, 42, 67, 0.08)",
  boxShadow: "0 18px 40px rgba(16, 42, 67, 0.08)",
};

const titleStyle = {
  marginTop: 0,
  marginBottom: "8px",
  color: "#102a43",
};

const subtitleStyle = {
  marginTop: 0,
  marginBottom: "22px",
  color: "#486581",
};

const formStyle = {
  display: "grid",
  gap: "14px",
};

const labelStyle = {
  display: "grid",
  gap: "8px",
  color: "#334e68",
  fontWeight: 600,
};

const inputStyle = {
  border: "1px solid #bcccdc",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "0.98rem",
  background: "#f8fbfd",
};

const buttonStyle = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  background: "#134e4a",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: "4px",
};

const messageStyle = {
  marginBottom: "16px",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#fef3f2",
  color: "#b42318",
  border: "1px solid #fecdca",
};

function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isBootstrapping, login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(APP_ROUTES.search, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (event) => {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const authPayload = await loginUser(form);
      login(authPayload);

      navigate(location.state?.from?.pathname ?? APP_ROUTES.search, {
        replace: true,
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Login failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isBootstrapping) {
    return <Loader label="Checking your session..." />;
  }

  return (
    <section style={wrapperStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Login</h1>
        <p style={subtitleStyle}>
          Sign in to search slots, create bookings, and manage your trips.
        </p>

        {error ? <p style={messageStyle}>{error}</p> : null}

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={handleChange}
              placeholder="you@example.com"
              required
              style={inputStyle}
              type="email"
              value={form.email}
            />
          </label>

          <label style={labelStyle}>
            Password
            <input
              autoComplete="current-password"
              name="password"
              onChange={handleChange}
              placeholder="Enter your password"
              required
              style={inputStyle}
              type="password"
              value={form.password}
            />
          </label>

          <button disabled={isSubmitting} style={buttonStyle} type="submit">
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <p style={{ marginBottom: 0, marginTop: "18px", color: "#486581" }}>
          Need an account? <Link to={APP_ROUTES.register}>Register here</Link>
        </p>
      </div>
    </section>
  );
}

export default LoginPage;
