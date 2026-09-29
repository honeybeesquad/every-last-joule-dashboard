import { describe, expect, it } from "vitest";

import { trialCurlArgs } from "../scripts/ci/compare-trial-deploy.js";

const TRIAL = "https://every-last-joule-dashboard-abc123-team.vercel.app";

describe("trialCurlArgs", () => {
  const args = trialCurlArgs("/_file/data/entsoe.4eaa9dcd.json", TRIAL);
  const separator = args.indexOf("--");

  it("never passes the token as a flag: vercel curl would hand it to curl", () => {
    // The first real run (36501200671, 29 Sep) failed because curl rejected
    // the token flag; the CLI reads VERCEL_TOKEN from the environment instead.
    expect(args.some((a) => a.startsWith("--token") || a === "-t")).toBe(false);
  });

  it("gives vercel curl the path and the deployment, before the separator", () => {
    expect(args.slice(0, separator)).toEqual(["curl", "/_file/data/entsoe.4eaa9dcd.json", "--deployment", TRIAL, "--yes"]);
  });

  it("gives curl only its own flags, after the separator", () => {
    expect(args.slice(separator + 1)).toEqual(["--silent", "--show-error", "--fail"]);
  });
});
