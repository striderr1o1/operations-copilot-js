import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Adds `in` to an element once it scrolls into view, driving the `.reveal`
 * transition in theme.css. Returns a ref to attach to the element.
 */
export function useReveal({ threshold = 0.15, once = true } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in");
          if (once) io.unobserve(el);
        } else if (!once) {
          el.classList.remove("in");
        }
      },
      { threshold }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, once]);

  return ref;
}

/** True once the window has been scrolled past `offset` pixels. */
export function useScrolled(offset = 12) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);

  return scrolled;
}

/** Matches a media query, kept in sync with resizes. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Highlights the nav link whose section is currently on screen. */
export function useActiveSection(ids, offset = 140) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const onScroll = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= offset) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ids, offset]);

  return active;
}

/**
 * Elapsed-seconds counter for long-running requests. `start()` resets and runs,
 * `stop()` freezes it.
 */
export function useElapsed() {
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    const began = Date.now();
    setElapsed(0);
    timer.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - began) / 1000));
    }, 1000);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { elapsed, start, stop };
}

export function formatElapsed(secs) {
  const m = Math.floor(secs / 60);
  return `${m ? `${m}m ` : ""}${secs % 60}s`;
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
