/**
 * Reactive playback clock for the dashboard.
 * Everything that depends on the "current" UTC hour (globe, headline,
 * hotspot list, timeline) subscribes to this clock. Drives everything
 * via a single RAF loop; callers re-render when `subscribe()` fires.
 */
export function createClock(initialHourUtc) {
  const state = {
    hour: ((initialHourUtc % 24) + 24) % 24,
    speed: 2,
    playing: true,
    lastTs: null
  };
  const listeners = new Set();
  let raf = null;
  const prefersReducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  function emit() {
    for (const fn of listeners) fn(state.hour);
  }

  function tick(now) {
    if (!state.playing) {
      raf = null;
      return;
    }
    const dt = state.lastTs == null ? 0 : (now - state.lastTs) / 1000;
    state.lastTs = now;
    state.hour += 0.4 * state.speed * dt;
    while (state.hour >= 24) state.hour -= 24;
    emit();
    raf = requestAnimationFrame(tick);
  }

  function start(force = false) {
    if (raf != null || !state.playing || (prefersReducedMotion && !force)) return;
    state.lastTs = null;
    raf = requestAnimationFrame(tick);
  }

  const api = {
    get hour() {
      return state.hour;
    },
    get playing() {
      return state.playing;
    },
    get speed() {
      return state.speed;
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state.hour);
      return () => listeners.delete(fn);
    },
    play() {
      state.playing = true;
      start(true);
    },
    pause() {
      state.playing = false;
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
    },
    setSpeed(multiplier) {
      state.speed = multiplier;
    },
    scrub(hour) {
      state.hour = ((hour % 24) + 24) % 24;
      emit();
    }
  };

  if (prefersReducedMotion) {
    state.playing = false;
  } else {
    start();
  }

  // Pause the animation loop when the tab is backgrounded so we're not
  // churning through 60 emits per second into an invisible DOM. On resume
  // we snap lastTs so the first frame's dt doesn't include the pause gap
  // (otherwise the hour would jump forward proportional to how long the
  // user was away).
  if (typeof document !== "undefined") {
    const onVisibility = () => {
      if (document.hidden) {
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
      } else if (state.playing) {
        state.lastTs = null;
        start(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
  }

  return api;
}
