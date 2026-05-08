import { describe, it, expect } from "vitest";
import { parseEcbRate, convertToUsd } from "../src/lib/fx";

describe("parseEcbRate", () => {
  it("extracts the most recent rate from a valid ECB SDMX JSON response", () => {
    const mockResponse = {
      dataSets: [{
        series: {
          "0:0:0:0:0": {
            observations: {
              "0": [1.0823],
              "1": [1.0891],
            }
          }
        }
      }]
    };
    // Should return the last (highest-index) observation value
    expect(parseEcbRate(mockResponse)).toBeCloseTo(1.0891, 4);
  });

  it("throws when dataSets is missing", () => {
    expect(() => parseEcbRate({})).toThrow();
  });

  it("throws when response is null", () => {
    expect(() => parseEcbRate(null)).toThrow();
  });

  it("throws when observations are empty", () => {
    const mockResponse = {
      dataSets: [{
        series: {
          "0:0:0:0:0": { observations: {} }
        }
      }]
    };
    expect(() => parseEcbRate(mockResponse)).toThrow();
  });
});

describe("convertToUsd", () => {
  it("converts EUR to USD using the provided rate", () => {
    expect(convertToUsd(100, "EUR", 1.08)).toBeCloseTo(108, 4);
  });

  it("converts AUD to USD using the provided rate", () => {
    expect(convertToUsd(100, "AUD", 0.65)).toBeCloseTo(65, 4);
  });

  it("returns the value unchanged for USD", () => {
    expect(convertToUsd(100, "USD", 1.0)).toBe(100);
  });

  it("throws for unknown currencies", () => {
    expect(() => convertToUsd(100, "GBP" as "EUR", 1.25)).toThrow();
  });
});
