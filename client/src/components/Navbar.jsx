import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context.js";
import { APP_ROUTES } from "../utils/constants.js";

const wrapperStyle = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  backdropFilter: "blur(10px)",
  background: "rgba(244, 251, 248, 0.82)",
  borderBottom: "1px solid rgba(16, 42, 67, 0.08)",
};

const containerStyle = {
  maxWidth: "1120px",
  margin: "0 auto",
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
};

const brandStyle = {
  color: "#134e4a",
  fontSize: "1.2rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textDecoration: "none",
};

const navStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const getLinkStyle = ({ isActive }) => ({
  color: isActive ? "#0f766e" : "#486581",
  textDecoration: "none",
  fontWeight: 600,
  padding: "8px 12px",
  borderRadius: "999px",
  background: isActive ? "rgba(15, 118, 110, 0.12)" : "transparent",
});

const userStyle = {
  color: "#102a43",
  fontWeight: 600,
};

const buttonStyle = {
  border: "none",
  borderRadius: "999px",
  background: "#134e4a",
  color: "#ffffff",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

function Navbar() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate(APP_ROUTES.home);
  };

  return (
    <header style={wrapperStyle}>
      <div style={containerStyle}>
        <NavLink style={brandStyle} to={APP_ROUTES.home}>
          PARKPAL
        </NavLink>

        <nav style={navStyle}>
          <NavLink style={getLinkStyle} to={APP_ROUTES.home}>
            Dashboard
          </NavLink>

          {isAuthenticated ? (
            <>
              <NavLink style={getLinkStyle} to={APP_ROUTES.search}>
                Search
              </NavLink>
              <NavLink style={getLinkStyle} to={APP_ROUTES.bookings}>
                My Bookings
              </NavLink>
              {["admin", "super_admin"].includes(user?.role) ? (
                <NavLink style={getLinkStyle} to={APP_ROUTES.admin}>
                  Admin
                </NavLink>
              ) : null}
              <span style={userStyle}>{user?.name ? `Hi, ${user.name}` : "Signed in"}</span>
              <button onClick={handleLogout} style={buttonStyle} type="button">
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink style={getLinkStyle} to={APP_ROUTES.login}>
                Login
              </NavLink>
              <NavLink style={getLinkStyle} to={APP_ROUTES.register}>
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
