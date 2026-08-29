import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import './ChromaGrid.css';

// Renders as a react-router <Link> for in-app paths and opens external URLs
// in a new tab — mirrors the isRouterLink pattern used in StaggeredMenu.
const isRouterLink = url => url && url[0] === '/' && !url.startsWith('//');

export const ChromaGrid = ({
  items,
  className = '',
  radius = 300,
  columns = 4,
  rows = 2,
  damping = 0.45,
  fadeOut = 0.6,
  ease = 'power3.out'
}) => {
  const rootRef = useRef(null);
  const fadeRef = useRef(null);
  const setX = useRef(null);
  const setY = useRef(null);
  const pos = useRef({ x: 0, y: 0 });

  const data = items?.length ? items : [];

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setX.current = gsap.quickSetter(el, '--x', 'px');
    setY.current = gsap.quickSetter(el, '--y', 'px');
    const { width, height } = el.getBoundingClientRect();
    pos.current = { x: width / 2, y: height / 2 };
    setX.current(pos.current.x);
    setY.current(pos.current.y);
  }, [data.length]);

  const moveTo = (x, y) => {
    gsap.to(pos.current, {
      x,
      y,
      duration: damping,
      ease,
      onUpdate: () => {
        setX.current?.(pos.current.x);
        setY.current?.(pos.current.y);
      },
      overwrite: true
    });
  };

  const handleMove = e => {
    const r = rootRef.current.getBoundingClientRect();
    moveTo(e.clientX - r.left, e.clientY - r.top);
    gsap.to(fadeRef.current, { opacity: 0, duration: 0.25, overwrite: true });
  };

  const handleLeave = () => {
    gsap.to(fadeRef.current, {
      opacity: 1,
      duration: fadeOut,
      overwrite: true
    });
  };

  const handleCardClick = url => {
    if (url && !isRouterLink(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCardMove = e => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

  const renderCardContent = (c, i) => (
    <>
      <div className="chroma-img-wrapper">
        {c.image ? (
          <img src={c.image} alt={c.title} loading="lazy" />
        ) : (
          <div className="chroma-placeholder" aria-hidden="true" />
        )}
      </div>
      <footer className="chroma-info">
        <h3 className="name">{c.title}</h3>
        {c.handle && <span className="handle">{c.handle}</span>}
        {c.subtitle && <p className="role">{c.subtitle}</p>}
        {c.location && <span className="location">{c.location}</span>}
      </footer>
    </>
  );

  return (
    <div
      ref={rootRef}
      className={`chroma-grid ${className}`}
      style={{
        '--r': `${radius}px`,
        '--cols': columns,
        '--rows': rows
      }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {data.map((c, i) => {
        const style = {
          '--card-border': c.borderColor || 'transparent',
          '--card-gradient': c.gradient
        };
        return isRouterLink(c.url) ? (
          <Link
            key={i}
            to={c.url}
            className="chroma-card"
            style={style}
            onMouseMove={handleCardMove}
          >
            {renderCardContent(c, i)}
          </Link>
        ) : (
          <article
            key={i}
            className="chroma-card"
            onClick={() => handleCardClick(c.url)}
            onMouseMove={handleCardMove}
            style={{
              ...style,
              cursor: c.url ? 'pointer' : 'default'
            }}
          >
            {renderCardContent(c, i)}
          </article>
        );
      })}
      <div className="chroma-overlay" />
      <div ref={fadeRef} className="chroma-fade" />
    </div>
  );
};

export default ChromaGrid;