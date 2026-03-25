import { useEffect } from "react";

const typeStyles = {
  success: {
    background: "#ecfdf3",
    borderColor: "#86efac",
    color: "#166534",
  },
  error: {
    background: "#fef2f2",
    borderColor: "#fca5a5",
    color: "#b91c1c",
  },
  info: {
    background: "#eff6ff",
    borderColor: "#93c5fd",
    color: "#1d4ed8",
  },
};

const wrapperStyle = {
  position: "fixed",
  top: "88px",
  right: "20px",
  zIndex: 1000,
  width: "min(360px, calc(100vw - 32px))",
};

const cardBaseStyle = {
  border: "1px solid",
  borderRadius: "18px",
  padding: "14px 16px",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.14)",
  backdropFilter: "blur(10px)",
};

const topRowStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
};

const closeButtonStyle = {
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: "1rem",
  lineHeight: 1,
  padding: 0,
};

function Toast({ onDismiss, toast }) {
  useEffect(() => {
    if (!toast?.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onDismiss();
    }, toast.duration ?? 3600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onDismiss, toast]);

  if (!toast?.message) {
    return null;
  }

  const tone = typeStyles[toast.type] ?? typeStyles.info;

  return (
    <div aria-live="polite" style={wrapperStyle}>
      <div style={{ ...cardBaseStyle, ...tone }}>
        <div style={topRowStyle}>
          <div>
            {toast.title ? (
              <strong style={{ display: "block", marginBottom: "4px" }}>
                {toast.title}
              </strong>
            ) : null}
            <span>{toast.message}</span>
          </div>

          <button onClick={onDismiss} style={closeButtonStyle} type="button">
            x
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toast;
