/** Placeholder entry so CI can build and deploy while the real UI shell is under construction.
 *  Replace with the actual app bootstrap when the shell lands.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function Placeholder() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0f14",
        color: "#e6edf3",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div>
        <h1 style={{ fontSize: "1.6rem", marginBottom: "0.5rem" }}>חדר המצב הלאומי</h1>
        <p style={{ opacity: 0.7 }}>israel-sim — הממשק בבנייה. הפריסה האוטומטית פעילה.</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
);