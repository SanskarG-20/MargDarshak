import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import { ClerkAvailableProvider } from "./hooks/useClerkAvailable";
import { JourneyProvider } from "./context/JourneyContext";
import App from "./App.jsx";
import "leaflet/dist/leaflet.css";
import "./styles/global.css";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#000", color: "#CCFF00", padding: 40, fontFamily: "monospace", minHeight: "100vh" }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>⚠ RUNTIME ERROR</div>
          <div style={{ color: "#fff", fontSize: 14, whiteSpace: "pre-wrap" }}>{this.state.error?.message}</div>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12, marginTop: 16, whiteSpace: "pre-wrap" }}>{this.state.error?.stack}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const clerkReady =
  !!CLERK_PUBLISHABLE_KEY &&
  CLERK_PUBLISHABLE_KEY !== "pk_test_REPLACE_WITH_YOUR_KEY";

if (!clerkReady) {
  console.warn(
    "[MargDarshak] Missing or placeholder VITE_CLERK_PUBLISHABLE_KEY — auth features disabled. Add your real key to client/.env"
  );
}

function Providers({ children }) {
    const inner = (
        <JourneyProvider>
            <ClerkAvailableProvider available={clerkReady}>
                <BrowserRouter>{children}</BrowserRouter>
            </ClerkAvailableProvider>
        </JourneyProvider>
    );

  if (clerkReady) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        {inner}
      </ClerkProvider>
    );
  }

  return inner;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </ErrorBoundary>
  </React.StrictMode>
);
