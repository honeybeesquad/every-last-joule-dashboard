/**
 * .github/workflows/data-refresh.yml wiring for the Healthchecks.io alarm.
 * tests/ping-healthchecks.test.ts covers the script; these tests pin the
 * workflow lines it depends on, which nothing else reads. A renamed step id,
 * a dropped continue-on-error, `outcome` swapped for `conclusion`, or a step
 * limit that no longer covers its step would turn a stale build into a
 * success ping, a red refresh, or a hang the ping cannot name, without
 * failing any other test. The repo has no YAML parser, so this reads the
 * steps as text blocks.
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

function number(text: string, re: RegExp, what: string): number {
  const m = text.match(re);
  if (!m) throw new Error(`data-refresh.yml: no ${what}`);
  return Number(m[1]);
}

const stepLimit = (text: string) => number(text, /\n {8}timeout-minutes: (\d+)/, "step timeout-minutes");

describe("data-refresh.yml and the Healthchecks.io alarm", () => {
  it("pings /start after checkout and before the deploy hook", () => {
    const start = step("ping-healthchecks.sh start");
    expect(step("actions/checkout").index).toBeLessThan(start.index);
    expect(start.index).toBeLessThan(step("id: hook").index);
    expect(start.text).toContain("HC_PING_URL: ${{ secrets.HC_PING_URL }}");
  });

  it("gives every step a time limit, and the job a limit well above their sum", () => {
    const limits = steps.map(stepLimit);
    const job = number(WORKFLOW, /\n {4}timeout-minutes: (\d+)/, "job timeout-minutes");
    // Room for job set-up and the post steps, which count against the job's
    // limit but have none of their own.
    expect(job).toBeGreaterThanOrEqual(limits.reduce((a, b) => a + b, 0) + 15);
  });

  it("never lets a Healthchecks ping stop or fail the refresh", () => {
    for (const needle of ["ping-healthchecks.sh start", "ping-healthchecks.sh outcome"]) {
      expect(step(needle).text).toContain("continue-on-error: true");
    }
  });

  it("lets the push-window wait finish its three waits, and fall through to the hook if it cannot", () => {
    const pushWindow = step("age past the push window");
    const windowMin = number(WORKFLOW, /\n {2}PUSH_WINDOW_MIN: (\d+)/, "PUSH_WINDOW_MIN");
    expect(stepLimit(pushWindow.text)).toBeGreaterThanOrEqual(3 * (windowMin + 1) + 3);
    expect(pushWindow.text).toContain("continue-on-error: true");
  });

  it("lets the wait step finish its polling", () => {
    const wait = step("id: wait");
    const polling = number(wait.text, /--timeout-min (\d+)/, "--timeout-min");
    expect(stepLimit(wait.text)).toBeGreaterThanOrEqual(polling + 3);
  });

  it("checks the new build after the wait, without failing the job", () => {
    const quality = step("id: quality");
    expect(step("id: wait").index).toBeLessThan(quality.index);
    expect(quality.text).toContain("continue-on-error: true");
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
