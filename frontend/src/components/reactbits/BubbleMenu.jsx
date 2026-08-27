import { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';

import './BubbleMenu.css';

// NOTE: this component originally shipped with `.pill-list` / `.pill-link` /
// `.pill-label` class names, which collide with PillNav's. They are renamed to
// `.bubble-list` / `.bubble-link` / `.bubble-label` here and in BubbleMenu.css.

const DEFAULT_ITEMS = [
  { label: 'home', href: '#', ariaLabel: 'Home', rotation: -8, hoverStyles: { bgColor: '#3b82f6', textColor: '#ffffff' } },
  { label: 'about', href: '#', ariaLabel: 'About', rotation: 8, hoverStyles: { bgColor: '#10b981', textColor: '#ffffff' } },
  { label: 'projects', href: '#', ariaLabel: 'Documentation', rotation: 8, hoverStyles: { bgColor: '#f59e0b', textColor: '#ffffff' } },
  { label: 'blog', href: '#', ariaLabel: 'Blog', rotation: 8, hoverStyles: { bgColor: '#ef4444', textColor: '#ffffff' } },
  { label: 'contact', href: '#', ariaLabel: 'Contact', rotation: -8, hoverStyles: { bgColor: '#8b5cf6', textColor: '#ffffff' } }
];

export default function BubbleMenu({
  logo,
  onMenuClick,
  className,
  style,
  menuAriaLabel = 'Toggle menu',
  menuBg = '#fff',
  menuContentColor = '#111',
  useFixedPosition = false,
  items,
  animationEase = 'back.out(1.5)',
  animationDuration = 0.5,
  staggerDelay = 0.12,
  open
}) {
  // `open` makes the menu controlled (used to auto-open on scroll-in);
  // left undefined it falls back to its own internal state.
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isMenuOpen = isControlled ? open : internalOpen;
  const [showOverlay, setShowOverlay] = useState(false);

  const overlayRef = useRef(null);
  const bubblesRef = useRef([]);
  const labelRefs = useRef([]);

  const menuItems = items?.length ? items : DEFAULT_ITEMS;
  const containerClassName = ['bubble-menu', useFixedPosition ? 'fixed' : 'absolute', className]
    .filter(Boolean)
    .join(' ');

  const handleToggle = () => {
    const nextState = !isMenuOpen;
    if (nextState) setShowOverlay(true);
    if (!isControlled) setInternalOpen(nextState);
    onMenuClick?.(nextState);
  };

  // The overlay has to be mounted before the open animation can run — when the
  // parent flips `open` there is no click to do that.
  useEffect(() => {
    if (isMenuOpen) setShowOverlay(true);
  }, [isMenuOpen]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const bubbles = bubblesRef.current.filter(Boolean);
    const labels = labelRefs.current.filter(Boolean);

    if (!overlay || !bubbles.length) return;

    if (isMenuOpen) {
      gsap.set(overlay, { display: 'flex' });
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.set(bubbles, { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(labels, { y: 24, autoAlpha: 0 });

      bubbles.forEach((bubble, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05);
        const tl = gsap.timeline({ delay });

        tl.to(bubble, { scale: 1, duration: animationDuration, ease: animationEase });
        if (labels[i]) {
          tl.to(
            labels[i],
            { y: 0, autoAlpha: 1, duration: animationDuration, ease: 'power3.out' },
            `-=${animationDuration * 0.9}`
          );
        }
      });
    } else if (showOverlay) {
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.to(labels, { y: 24, autoAlpha: 0, duration: 0.2, ease: 'power3.in' });
      gsap.to(bubbles, {
        scale: 0,
        duration: 0.2,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(overlay, { display: 'none' });
          setShowOverlay(false);
        }
      });
    }
  }, [isMenuOpen, showOverlay, animationEase, animationDuration, staggerDelay]);

  useEffect(() => {
    const handleResize = () => {
      if (isMenuOpen) {
        const bubbles = bubblesRef.current.filter(Boolean);
        const isDesktop = window.innerWidth >= 900;

        bubbles.forEach((bubble, i) => {
          const item = menuItems[i];
          if (bubble && item) {
            const rotation = isDesktop ? (item.rotation ?? 0) : 0;
            gsap.set(bubble, { rotation });
          }
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen, menuItems]);

  return (
    <>
      <nav className={containerClassName} style={style} aria-label="Main navigation">
        <div className="bubble logo-bubble" aria-label="Logo" style={{ background: menuBg }}>
          <span className="logo-content">
            {typeof logo === 'string' ? <img src={logo} alt="Logo" className="bubble-logo" /> : logo}
          </span>
        </div>

        <button
          type="button"
          className={`bubble toggle-bubble menu-btn ${isMenuOpen ? 'open' : ''}`}
          onClick={handleToggle}
          aria-label={menuAriaLabel}
          aria-pressed={isMenuOpen}
          style={{ background: menuBg }}
        >
          <span className="menu-line" style={{ background: menuContentColor }} />
          <span className="menu-line short" style={{ background: menuContentColor }} />
        </button>
      </nav>
      {showOverlay && (
        <div
          ref={overlayRef}
          className={`bubble-menu-items ${useFixedPosition ? 'fixed' : 'absolute'}`}
          aria-hidden={!isMenuOpen}
        >
          <ul className="bubble-list" role="menu" aria-label="Menu links">
            {menuItems.map((item, idx) => (
              <li key={idx} role="none" className="bubble-col">
                <a
                  role="menuitem"
                  href={item.href}
                  aria-label={item.ariaLabel || item.label}
                  className="bubble-link"
                  onClick={() => {
                    if (!isControlled) setInternalOpen(false);
                    onMenuClick?.(false);
                  }}
                  style={{
                    '--item-rot': `${item.rotation ?? 0}deg`,
                    '--bubble-bg': menuBg,
                    '--bubble-color': menuContentColor,
                    '--hover-bg': item.hoverStyles?.bgColor || '#f3f4f6',
                    '--hover-color': item.hoverStyles?.textColor || menuContentColor
                  }}
                  ref={el => {
                    if (el) bubblesRef.current[idx] = el;
                  }}
                >
                  <span
                    className="bubble-label"
                    ref={el => {
                      if (el) labelRefs.current[idx] = el;
                    }}
                  >
                    {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
