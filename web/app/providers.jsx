"use client";

import { Suspense } from "react";
import { AuthProvider } from "@/auth/AuthContext.jsx";
import ClickSpark from "@/components/animation/ClickSpark.jsx";
import ErrorBoundary from "@/components/common/ErrorBoundary.jsx";
import GlyphMatrix from "@/components/common/GlyphMatrix.jsx";
import Loader from "@/components/common/Loader.jsx";
import { ToastProvider } from "@/components/ui/toast.jsx";
import { LiveUpdatesProvider } from "@/live/LiveUpdates.jsx";
import { VenueAccessProvider } from "@/venue/VenueAccessContext.jsx";

/**
 * Everything the old src/main.jsx wrapped the router in, minus the router
 * itself — the App Router owns that now. Kept as one client component so the
 * root layout below can stay a server component (it renders <html>, which the
 * providers have no business owning).
 */
export default function Providers({ children }) {
  return (
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

      {/* Outside AuthProvider on purpose — the venue access code has nothing
          to do with a signed-in account; anyone, signed in or not, can hold
          one. */}
      <VenueAccessProvider>
        <AuthProvider>
          {/* Inside AuthProvider: the stream only opens once someone is signed
              in, and it authenticates with their session cookie. */}
          <LiveUpdatesProvider>
            <ToastProvider>
              <ClickSpark
                sparkColor="#f87b1b"
                sparkSize={9}
                sparkRadius={16}
                sparkCount={7}
                duration={420}
              >
                <Suspense fallback={<Loader />}>{children}</Suspense>
              </ClickSpark>
            </ToastProvider>
          </LiveUpdatesProvider>
        </AuthProvider>
      </VenueAccessProvider>
    </ErrorBoundary>
  );
}
