import { Link } from "react-router-dom";
import { useAuth } from "../context/auth-context.js";
import { APP_ROUTES } from "../utils/constants.js";

const heroStyle = {
  display: "grid",
  gap: "18px",
  padding: "56px 0 28px",
};

const eyebrowStyle = {
  color: "#0f766e",
  fontWeight: 800,
  letterSpacing: "0.08em",
  fontSize: "0.82rem",
};

const titleStyle = {
  margin: 0,
  fontSize: "clamp(2.2rem, 4vw, 4.2rem)",
  lineHeight: 1.05,
  color: "#102a43",
  maxWidth: "760px",
};

const subtitleStyle = {
  margin: 0,
  maxWidth: "680px",
  color: "#486581",
  fontSize: "1.05rem",
  lineHeight: 1.7,
};

const ctaRowStyle = {
  display: "flex",
  gap: "14px",
  flexWrap: "wrap",
  marginTop: "10px",
};

const primaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "14px",
  padding: "14px 18px",
  background: "#134e4a",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 700,
};

const secondaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "14px",
  padding: "14px 18px",
  background: "#ffffff",
  color: "#102a43",
  textDecoration: "none",
  fontWeight: 700,
  border: "1px solid rgba(16, 42, 67, 0.12)",
};

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
  marginTop: "28px",
};

const cardStyle = {
  background: "rgba(255, 255, 255, 0.82)",
  borderRadius: "22px",
  padding: "22px",
  border: "1px solid rgba(16, 42, 67, 0.08)",
  boxShadow: "0 18px 40px rgba(16, 42, 67, 0.06)",
};

const cards = [
  {
    title: "Search nearby parking",
    text: "Browse listed parking spots, compare prices, and pick a time window that works.",
  },
  {
    title: "Book in one flow",
    text: "Choose your slot, set start and end time, and confirm without juggling requests by hand.",
  },
  {
    title: "Manage your bookings",
    text: "Review active reservations and cancel them when plans change.",
  },
];

function DashboardPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <section style={heroStyle}>
      <span style={eyebrowStyle}>SMART CITY PARKING</span>
      <h1 style={titleStyle}>
        Book parking without the circling, guessing, or last-minute chaos.
      </h1>
      <p style={subtitleStyle}>
        ParkPal is wired for the actual backend you have right now, so you can
        sign in, find slots, create bookings, and manage them from one place.
        {user?.name ? ` Welcome back, ${user.name}.` : ""}
      </p>

      <div style={ctaRowStyle}>
        <Link
          style={primaryButtonStyle}
          to={isAuthenticated ? APP_ROUTES.search : APP_ROUTES.login}
        >
          {isAuthenticated ? "Find a Spot" : "Login to Start"}
        </Link>
        <Link
          style={secondaryButtonStyle}
          to={isAuthenticated ? APP_ROUTES.bookings : APP_ROUTES.register}
        >
          {isAuthenticated ? "View My Bookings" : "Create an Account"}
        </Link>
        {["admin", "super_admin"].includes(user?.role) ? (
          <Link style={secondaryButtonStyle} to={APP_ROUTES.admin}>
            Open Admin Panel
          </Link>
        ) : null}
      </div>

      <div style={cardGridStyle}>
        {cards.map((card) => (
          <article key={card.title} style={cardStyle}>
            <h2 style={{ marginTop: 0, color: "#102a43" }}>{card.title}</h2>
            <p style={{ marginBottom: 0, color: "#486581", lineHeight: 1.6 }}>
              {card.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default DashboardPage;
