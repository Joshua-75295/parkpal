const loaderStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  color: "#486581",
  fontWeight: 600,
};

const dotStyle = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  background: "#0f766e",
  boxShadow: "18px 0 0 rgba(15, 118, 110, 0.45), 36px 0 0 rgba(15, 118, 110, 0.2)",
};

function Loader({ label = "Loading..." }) {
  return (
    <div aria-live="polite" role="status" style={loaderStyle}>
      <span style={dotStyle} />
      <span>{label}</span>
    </div>
  );
}

export default Loader;
