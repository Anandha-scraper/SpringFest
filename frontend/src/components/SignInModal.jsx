import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../auth/AuthContext.jsx";
import { homeForRole } from "../content/roles.js";

/**
 * Sign-in card shown when "Register Now" is clicked. Google is the only
 * provider the backend verifies tokens for, so the supplied card's GitHub
 * button, email field and separator are dropped.
 */
export default function SignInModal({ open, onClose, onSignedIn }) {
  const { loginWithGoogle, refreshRole, isFirebaseConfigured, firebaseConfigError } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Don't let the page scroll behind the card.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const signIn = async () => {
    setError("");
    setBusy(true);
    try {
      await loginWithGoogle();
      // The role lives on the server, so this is a round-trip. Keep the busy
      // state up across it rather than flashing the page in between.
      const role = await refreshRole();
      onClose();
      onSignedIn?.(role);
      navigate(homeForRole(role));
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") setError("Sign-in was cancelled.");
      else if (err.code === "auth/popup-blocked")
        setError("Your browser blocked the popup. Allow popups and try again.");
      else setError(err.message || "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <StyledWrapper
      className="signin-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div className="form" onClick={(e) => e.stopPropagation()}>
        <button className="closeButton" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>

        <p>
          Welcome,<span>sign in to continue</span>
        </p>

        {!isFirebaseConfigured && <p className="formError">{firebaseConfigError}</p>}
        {error && <p className="formError">{error}</p>}

        <button
          className="oauthButton"
          type="button"
          onClick={signIn}
          disabled={busy || !isFirebaseConfigured}
        >
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          {busy ? "Signing in…" : "Continue with Google"}
        </button>

        <span className="formNote">
          We only read your name, email and profile photo.
        </span>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  /* DEOXY Was Here */
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(17, 34, 78, 0.45);
  backdrop-filter: blur(3px);
  animation: signin-fade 180ms ease;

  .form {
    --background: #d3d3d3;
    --input-focus: #2d8cf0;
    --font-color: #323232;
    --font-color-sub: #666;
    --bg-color: #fff;
    --main-color: #323232;
    position: relative;
    padding: 24px;
    background: var(--background);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 16px;
    border-radius: 5px;
    border: 2px solid var(--main-color);
    box-shadow: 4px 4px var(--main-color);
    animation: signin-pop 200ms cubic-bezier(0.2, 0.9, 0.3, 1.3);
  }

  .form > p {
    font-family: var(--font-display);
    color: var(--font-color);
    font-weight: 700;
    font-size: 20px;
    margin-bottom: 6px;
    display: flex;
    flex-direction: column;
  }

  .form > p > span {
    font-family: var(--font-body);
    color: var(--font-color-sub);
    font-weight: 600;
    font-size: 17px;
  }

  .closeButton {
    position: absolute;
    top: 6px;
    right: 10px;
    background: none;
    border: none;
    font-size: 26px;
    line-height: 1;
    color: var(--font-color-sub);
    cursor: pointer;
    padding: 0;
  }
  .closeButton:hover { color: var(--font-color); }

  .oauthButton {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    width: 250px;
    height: 40px;
    border-radius: 5px;
    border: 2px solid var(--main-color);
    background-color: var(--bg-color);
    box-shadow: 4px 4px var(--main-color);
    font-size: 16px;
    font-weight: 600;
    font-family: var(--font-body);
    color: var(--font-color);
    cursor: pointer;
    transition: all 250ms;
    position: relative;
    overflow: hidden;
    z-index: 1;
  }

  .oauthButton::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 0;
    background-color: #212121;
    z-index: -1;
    box-shadow: 4px 8px 19px -3px rgba(0, 0, 0, 0.27);
    transition: all 250ms;
  }

  .oauthButton:hover { color: #e8e8e8; }
  .oauthButton:hover::before { width: 100%; }

  .oauthButton:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .oauthButton:disabled::before { width: 0; }

  .formError {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    color: #b3261e;
    max-width: 250px;
    margin: 0;
  }

  .formNote {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--font-color-sub);
    max-width: 250px;
  }

  .icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  @keyframes signin-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes signin-pop {
    from { transform: translateY(8px) scale(0.98); opacity: 0; }
    to { transform: none; opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    .form { animation: none; }
  }
`;
