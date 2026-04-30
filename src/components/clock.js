/**
 * Reactive playback clock for the dashboard.
 * Everything that depends on the "current" UTC hour (globe, headline,
 * hotspot list, timeline) subscribes to this clock. Drives everything
 * via a single RAF loop; callers re-render when `subscribe()` fires.
 */
export function createClock(initialHourUtc) {
  const state = {
    hour: ((initialHourUtc % 24) + 24) % 24,
    // 0.5× = 0.2 h/s = 2 min per 24h loop. Slow enough to read the pillars
    // rising over each timezone; users can bump to 2×/4×/8× if they want
    // to glance at the whole cycle at a go.
    speed: 0.5,
    playing: true,
    // When true, the tick loop ignores `speed` and locks `hour` to the
    // actual wall-clock UTC each frame (≈ 0.000278 h/s). Lets viewers
    // watch the dashboard advance at "true" rate after scrubbing around.
    // Any setSpeed/scrub interaction clears the flag automatically.
    realTime: false,
    lastTs: null
  };
  const listeners = new Set();
  let raf = null;
  const prefersReducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  function emit() {
    for (const fn of listeners) fn(state.hour);
  }

  function utcNowHour() {
    const d = new Date();
    return d.getUTCHours()
      + d.getUTCMinutes() / 60
      + d.getUTCSeconds() / 3600
      + d.getUTCMilliseconds() / 3_600_000;
  }

  function tick(now) {
    if (!state.playing) {
      raf = null;
      return;
    }
    if (state.realTime) {
      // Pull from the wall clock each frame. Avoids dt drift from
      // long pauses (background tabs, debugger stops).
      state.hour = utcNowHour();
    } else {
      const dt = state.lastTs == null ? 0 : (now - state.lastTs) / 1000;
      state.hour += 0.4 * state.speed * dt;
      while (state.hour >= 24) state.hour -= 24;
    }
    state.lastTs = now;
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
    get realTime() {
      return state.realTime;
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
      // Picking a speed always means "I want synthetic playback at
      // this rate", so we drop out of real-time tracking.
      state.realTime = false;
    },
    scrub(hour) {
      state.hour = ((hour % 24) + 24) % 24;
      // Manually positioning the clock is incompatible with the
      // wall-clock lock — the next tick would overwrite us.
      state.realTime = false;
      emit();
    },
    enableRealTime() {
      // Snap to actual UTC immediately so the UI doesn't have to wait
      // for the first RAF frame, then ensure playback is running so
      // the wall-clock branch in tick() keeps it in sync going forward.
      state.realTime = true;
      state.hour = utcNowHour();
      state.lastTs = null;
      if (!state.playing) {
        state.playing = true;
        start(true);
      }
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
