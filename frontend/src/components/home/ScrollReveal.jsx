import React, { useEffect, useRef } from 'react';

/**
 * ScrollReveal — IntersectionObserver wrapper that reveals children
 * with a fade-in / slide-up animation as they scroll into the viewport.
 */
export function ScrollReveal({
  children,
  className = '',
  threshold = 0.15,
  rootMargin = '0px 0px -40px 0px',
  delay = 0,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => el.classList.add('revealed'), delay);
          } else {
            el.classList.add('revealed');
          }
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, delay]);

  return (
    <div ref={ref} className={`scroll-reveal ${className}`}>
      {children}
    </div>
  );
}
