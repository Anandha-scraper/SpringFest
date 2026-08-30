import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthContext.jsx";
import ClickSpark from "@/components/animation/ClickSpark.jsx";
import ErrorBoundary from "@/components/common/ErrorBoundary.jsx";
import GlyphMatrix from "@/components/common/GlyphMatrix.jsx";
import Loader from "@/components/common/Loader.jsx";
import { ToastProvider } from "@/components/ui/toast.jsx";
import AppRoutes from "@/routes.jsx";

// Only the true globals live here. Every other stylesheet is imported by the
// component or page it belongs to, from styles/components/ or styles/pages/.
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
// Utilities only — preflight is off, so this can't touch the reset above.
import "@/styles/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Site-wide animated backdrop, behind every route. */}
      <div className="app-bg" aria-hidden="true">
        <GlyphMatrix
          glyphs={"01·•+*/\\<>="}
          cellSize={16}
          mutationRate={0.035}
          interval={110}
          fadeBottom={0.55}
          color="#11224e"
        />
      </div>

      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <ClickSpark
              sparkColor="#f87b1b"
              sparkSize={9}
              sparkRadius={16}
              sparkCount={7}
              duration={420}
            >
              {/* One boundary for every route chunk — a lazy page's own load
                  looks like the same loader ProtectedRoute already shows while
                  resolving auth, not a new loading UI. */}
              <Suspense fallback={<Loader />}>
                <AppRoutes />
              </Suspense>
            </ClickSpark>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
