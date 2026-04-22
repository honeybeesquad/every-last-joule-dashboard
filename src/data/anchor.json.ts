import type { GlobalAnchor } from "../../lib/types.js";
import { pathToFileURL } from "url";

// From research/energy_arithmetic.md (bottom-up 125 TWh mid-case, IEA-rate 160 TWh).
// Publication window: Ember Global Electricity Review 2025 + IEA Renewables 2025.
const ANCHOR: GlobalAnchor = {
  sourceName: "Ember Global Electricity Review 2025 + IEA Renewables 2025",
  globalCurtailmentTWh: 125,
  sourceReportDate: "2025-Q2",
  sourceUrl: "https://ember-energy.org/latest-insights/global-electricity-review-2025/",
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  process.stdout.write(JSON.stringify(ANCHOR));
}
