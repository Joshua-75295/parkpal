import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import { useAuth } from "../context/auth-context.js";
import { getApiErrorMessage } from "../services/api.js";
import { registerUser } from "../services/authService.js";
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

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isBootstrapping, login } = useAuth();
  const [form, setForm] = useState({
    name: "",
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
      const authPayload = await registerUser(form);
      login(authPayload);
      navigate(APP_ROUTES.search, { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Registration failed."));
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
        <h1 style={{ marginTop: 0, color: "#102a43" }}>Register</h1>
        <p style={{ marginTop: 0, marginBottom: "22px", color: "#486581" }}>
          Create an account so bookings and cancellations stay tied to you.
        </p>

        {error ? <p style={messageStyle}>{error}</p> : null}

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            Full name
            <input
              autoComplete="name"
              name="name"
              onChange={handleChange}
              placeholder="Your name"
              required
              style={inputStyle}
              type="text"
              value={form.name}
            />
          </label>

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
              autoComplete="new-password"
              name="password"
              onChange={handleChange}
              placeholder="Choose a password"
              required
              style={inputStyle}
              type="password"
              value={form.password}
            />
          </label>

          <button disabled={isSubmitting} style={buttonStyle} type="submit">
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        <p style={{ marginBottom: 0, marginTop: "18px", color: "#486581" }}>
          Already signed up? <Link to={APP_ROUTES.login}>Login here</Link>
        </p>
      </div>
    </section>
  );
}

export default RegisterPage;
