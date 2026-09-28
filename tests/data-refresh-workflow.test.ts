/**
 * .github/workflows/data-refresh.yml wiring for the Healthchecks.io alarm.
 * tests/ping-healthchecks.test.ts covers the script; these tests pin the
 * workflow lines it depends on, which nothing else reads. A renamed step id,
 * a dropped continue-on-error, or `outcome` swapped for `conclusion` would
 * turn a stale build into a success ping or a red refresh without failing
 * any other test. The repo has no YAML parser, so this reads the steps as
 * text blocks.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(join(__dirname, "..", ".github", "workflows", "data-refresh.yml"), "utf8");

/** The job's steps in order, each as its block of text. */
const steps = WORKFLOW.split(/\n(?= {6}- )/).slice(1);

function step(needle: string): { index: number; text: string } {
  const index = steps.findIndex((s) => s.includes(needle));
  if (index < 0) throw new Error(`no step in data-refresh.yml contains ${needle}`);
  return { index, text: steps[index] };
}

describe("data-refresh.yml and the Healthchecks.io alarm", () => {
  it("pings /start after checkout and before the deploy hook", () => {
    const start = step("ping-healthchecks.sh start");
    expect(step("actions/checkout").index).toBeLessThan(start.index);
    expect(start.index).toBeLessThan(step("id: hook").index);
    expect(start.text).toContain("HC_PING_URL: ${{ secrets.HC_PING_URL }}");
  });

  it("checks the new build after the wait, without failing the job, within a time limit", () => {
    const quality = step("id: quality");
    expect(step("id: wait").index).toBeLessThan(quality.index);
    expect(quality.text).toContain("continue-on-error: true");
    expect(quality.text).toMatch(/timeout-minutes: \d+/);
    expect(quality.text).toContain('check-deploy-freshness.ts check --report "$RUNNER_TEMP/freshness.md"');
  });

  it("reports the outcome last, always, from the steps' outcomes", () => {
    const outcome = step("ping-healthchecks.sh outcome");
    expect(outcome.index).toBe(steps.length - 1);
    expect(outcome.text).toContain("if: always()");
    for (const line of [
      "HC_PING_URL: ${{ secrets.HC_PING_URL }}",
      "JOB_STATUS: ${{ job.status }}",
      "HOOK: ${{ steps.hook.outcome }}",
      "WAIT: ${{ steps.wait.outcome }}",
      "QUALITY: ${{ steps.quality.outcome }}",
      "STALE: ${{ steps.quality.outputs.stale }}",
      "TITLE: ${{ steps.quality.outputs.title }}",
      "REPORT: ${{ runner.temp }}/freshness.md",
    ]) {
      expect(outcome.text).toContain(line);
    }
  });
});
