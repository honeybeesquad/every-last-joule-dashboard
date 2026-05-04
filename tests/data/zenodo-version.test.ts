import { describe, it, expect } from "vitest";
import {
  normalizeVersion,
  parseZenodoRecord,
  parseCitationCff,
} from "../../src/data/zenodo-version.json";

describe("zenodo-version loader", () => {
  describe("normalizeVersion", () => {
    it("strips leading 'v'", () => {
      expect(normalizeVersion("v1.1.1")).toBe("1.1.1");
      expect(normalizeVersion("V2.0")).toBe("2.0");
    });
    it("leaves bare versions untouched", () => {
      expect(normalizeVersion("1.2.0")).toBe("1.2.0");
    });
    it("trims whitespace", () => {
      expect(normalizeVersion("  v1.1.1 ")).toBe("1.1.1");
    });
  });

  describe("parseZenodoRecord", () => {
    it("extracts version, doi, and self_html link", () => {
      const rec = {
        id: 19991315,
        doi: "10.5281/zenodo.19991315",
        metadata: { version: "v1.1.1" },
        links: { self_html: "https://zenodo.org/records/19991315" },
      };
      expect(parseZenodoRecord(rec)).toEqual({
        version: "1.1.1",
        doi: "10.5281/zenodo.19991315",
        recordUrl: "https://zenodo.org/records/19991315",
        source: "zenodo",
      });
    });

    it("falls back to constructed URL when self_html is missing", () => {
      const rec = {
        id: 19991315,
        doi: "10.5281/zenodo.19991315",
        metadata: { version: "1.1.1" },
      };
      expect(parseZenodoRecord(rec).recordUrl).toBe(
        "https://zenodo.org/records/19991315",
      );
    });

    it("throws when metadata.version is missing", () => {
      const rec = {
        id: 19991315,
        doi: "10.5281/zenodo.19991315",
        metadata: {},
      };
      expect(() => parseZenodoRecord(rec)).toThrow(/no metadata.version/);
    });

    it("throws when id is not a number (defends against unexpected response shape)", () => {
      const rec = {
        id: undefined as unknown as number,
        doi: "10.5281/zenodo.19991315",
        metadata: { version: "1.1.1" },
      };
      expect(() => parseZenodoRecord(rec)).toThrow(/numeric id/);
    });

    it("rejects a version string with HTML-injection characters", () => {
      const rec = {
        id: 19991315,
        doi: "10.5281/zenodo.19991315",
        metadata: { version: '1.1.1"><script>alert(1)</script>' },
      };
      expect(() => parseZenodoRecord(rec)).toThrow(/unexpected version format/);
    });

    it("rejects a recordUrl on a non-allow-listed host", () => {
      const rec = {
        id: 19991315,
        doi: "10.5281/zenodo.19991315",
        metadata: { version: "1.1.1" },
        links: { self_html: "https://evil.example/records/19991315" },
      };
      expect(() => parseZenodoRecord(rec)).toThrow(/allow-listed/);
    });

    it("rejects a javascript: recordUrl", () => {
      const rec = {
        id: 19991315,
        doi: "10.5281/zenodo.19991315",
        metadata: { version: "1.1.1" },
        links: { self_html: "javascript:alert(1)" as string },
      };
      expect(() => parseZenodoRecord(rec)).toThrow(/https/);
    });
  });

  describe("parseCitationCff", () => {
    it("extracts version and the archival DOI", () => {
      const cff = [
        "cff-version: 1.2.0",
        "title: Example",
        "version: 1.2.0",
        "identifiers:",
        '  - type: doi',
        '    value: "10.5281/zenodo.19991315"',
        '    description: "Zenodo archival DOI (versioned, v1.1.1)"',
        '  - type: doi',
        '    value: "10.5281/zenodo.19835411"',
        '    description: "Zenodo concept DOI (resolves to latest version)"',
      ].join("\n");

      expect(parseCitationCff(cff)).toEqual({
        version: "1.2.0",
        doi: "10.5281/zenodo.19991315",
        recordUrl: "https://doi.org/10.5281/zenodo.19991315",
        source: "citation-cff",
      });
    });

    it("falls back to the concept DOI when no archival DOI is present", () => {
      const cff = "version: 0.9.0\n";
      const result = parseCitationCff(cff);
      expect(result.version).toBe("0.9.0");
      expect(result.doi).toBe("10.5281/zenodo.19835411");
      expect(result.source).toBe("citation-cff");
    });

    it("throws when there is no version field", () => {
      expect(() => parseCitationCff("title: foo\n")).toThrow(/version/);
    });

    it("handles CRLF line endings", () => {
      const cff = "version: 1.2.0\r\nidentifiers:\r\n";
      expect(parseCitationCff(cff).version).toBe("1.2.0");
    });
  });
});
