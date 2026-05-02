import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { BusinessProvider } from "./context/BusinessProvider";
import "./index.css";
import { ErrorBoundary } from "./shared/components/ui";
import { enableConsoleBuffer } from "./utils/consoleBuffer";

import { registerSW } from "virtual:pwa-register";

// Registrar Service Worker (VitePWA) con auto-update
registerSW({ immediate: true });

enableConsoleBuffer();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ErrorBoundary>
      <AuthProvider>
        <BusinessProvider>
          <App />
        </BusinessProvider>
      </AuthProvider>
    </ErrorBoundary>
  </BrowserRouter>
);
