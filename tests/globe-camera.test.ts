import { describe, it, expect } from "vitest";
import {
  angleBetween, camera, dot, ortho, solarDeclination, subsolar, subsolarLongitude, vec, wrapLon, FOLLOW_SUN,
} from "../src/lib/globe-camera";
import { isSolarNight, localSolarHour } from "../src/lib/solar-mask";

describe("camera", () => {
  it("is an orthonormal frame for any view centre", () => {
    for (const [lat, lon] of [[24, 30], [-36, -120], [70, 179], [0, 0]]) {
      const c = camera(lat, lon);
      for (const v of [c.f, c.e, c.n]) expect(Math.hypot(...v)).toBeCloseTo(1, 12);
      expect(dot(c.f, c.e)).toBeCloseTo(0, 12);
      expect(dot(c.f, c.n)).toBeCloseTo(0, 12);
      expect(dot(c.e, c.n)).toBeCloseTo(0, 12);
    }
  });

  it("projects the view centre to the middle of the disc, facing the viewer", () => {
    const [x, y, z] = ortho(camera(24, 50), vec(24, 50));
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(1, 12);
  });

  it("puts north up (negative screen y) and east to the right", () => {
    const cam = camera(0, 0);
    expect(ortho(cam, vec(10, 0))[1]).toBeLessThan(0);
    expect(ortho(cam, vec(0, 10))[0]).toBeGreaterThan(0);
  });

  it("hides the far side (negative depth)", () => {
    expect(ortho(camera(0, 0), vec(0, 180))[2]).toBeLessThan(0);
  });
});

describe("the sun", () => {
  it("uses solar-mask.ts's longitude rule, so the drawn terminator and the data mask agree", () => {
    for (const hour of [0, 3.5, 6, 12, 18.25, 23.9]) {
      const lon = subsolarLongitude(hour);
      // Local solar noon at the subsolar longitude...
      expect(localSolarHour(hour, lon)).toBeCloseTo(12, 9);
      // ...and it is daytime there, night on the opposite meridian.
      expect(isSolarNight(hour, lon)).toBe(false);
      expect(isSolarNight(hour, wrapLon(lon + 180))).toBe(true);
    }
    expect(subsolarLongitude(12)).toBeCloseTo(0, 12);
    expect(subsolarLongitude(6)).toBeCloseTo(90, 12);
    expect(subsolarLongitude(18)).toBeCloseTo(-90, 12);
  });

  it("gives the seasons' declination to within half a degree", () => {
    expect(solarDeclination(new Date(Date.UTC(2026, 5, 21, 12)))).toBeCloseTo(23.44, 0);
    expect(solarDeclination(new Date(Date.UTC(2026, 11, 21, 12)))).toBeCloseTo(-23.44, 0);
    expect(Math.abs(solarDeclination(new Date(Date.UTC(2026, 8, 23, 6))))).toBeLessThan(0.5);
  });

  it("takes the date's declination and the clock's hour, which may be scrubbed", () => {
    const s = subsolar(new Date(Date.UTC(2026, 5, 21, 3)), 12);
    expect(s.lon).toBeCloseTo(0, 9);
    expect(s.lat).toBeGreaterThan(23);
    expect(Math.hypot(...s.v)).toBeCloseTo(1, 12);
  });
});

describe("follow the sun", () => {
  it("keeps the light camera 22 deg east of the sun at 24N, the dark one 20 deg east at 36S", () => {
    expect(FOLLOW_SUN.light).toEqual({ lat0: 24, lonOffset: 22 });
    expect(FOLLOW_SUN.dark).toEqual({ lat0: -36, lonOffset: 20 });
  });

  it("wraps longitudes into [-180, 180)", () => {
    expect(wrapLon(190)).toBeCloseTo(-170, 9);
    expect(wrapLon(-181)).toBeCloseTo(179, 9);
    expect(wrapLon(180)).toBeCloseTo(-180, 9);
  });

  it("measures angles on the sphere", () => {
    expect(angleBetween(0, 0, 0, 90)).toBeCloseTo(90, 9);
    expect(angleBetween(90, 0, -90, 0)).toBeCloseTo(180, 9);
  });
});
