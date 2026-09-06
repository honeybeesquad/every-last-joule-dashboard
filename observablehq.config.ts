import { readdirSync } from "node:fs";
import { join } from "node:path";

import { REGIONS } from "./src/lib/regions.js";

const fontFiles = readdirSync(join("src", "fonts"))
  .filter((file) => file.endsWith(".ttf") || file.endsWith(".woff2"))
  .map((file) => `/fonts/${file}`);

// One `/region/<id>` route per canonical region, rendered by the parameterised
// page loader at src/region/[id].md.js. `pages:` below controls navigation,
// not routing — a path only gets built if it comes out of config.paths(), and
// for a parameterised loader that means listing it here.
const regionPaths = REGIONS.map((region) => `/region/${region.id}`);

// Social-share card. The description is the one-line story the card tells
// when the link is pasted into iMessage / Slack / Twitter / LinkedIn etc.
// og:image MUST be an absolute URL per the OG spec for link unfurlers to
// fetch it — relative paths are silently dropped by most platforms.
const SITE_URL = "https://everylastjoule.com";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const OG_TITLE = "Every Last Joule";
const OG_DESCRIPTION =
  "The wasted-energy database: curtailed renewables and flared gas across 384 regions worldwide, live from grid operators. How much of Bitcoin's hashrate could run on the joules we already pay for but throw away?";

const socialMeta = [
  `<meta name="description" content="${OG_DESCRIPTION}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:url" content="${SITE_URL}/">`,
  `<meta property="og:title" content="${OG_TITLE}">`,
  `<meta property="og:description" content="${OG_DESCRIPTION}">`,
  `<meta property="og:image" content="${OG_IMAGE}">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta property="og:image:alt" content="Globe showing wasted-energy pillars — curtailed renewables and flared gas — across 384 regions; headline reads 384% of Bitcoin hashrate supportable on the joules we already throw away.">`,
  `<meta name="twitter:card" content="summary_large_image">`,
  `<meta name="twitter:title" content="${OG_TITLE}">`,
  `<meta name="twitter:description" content="${OG_DESCRIPTION}">`,
  `<meta name="twitter:image" content="${OG_IMAGE}">`,
].join("");

export default {
  title: "Every Last Joule",
  root: "src",
  interpreters: {
    ".ts": ["tsx"]
  },
  // Framework only emits a file when its path comes out of config.paths(),
  // and for anything that is not a page or a page loader that means listing
  // it here. og-image.png is referenced only via <meta> tags; robots.txt and
  // sitemap.xml are referenced by nothing at all, which is why they were
  // silently absent from every build until now even though src/robots.txt
  // advertises the sitemap.
  dynamicPaths: [
    ...fontFiles,
    "/og-image.png",
    "/robots.txt",
    "/sitemap.xml",
    ...regionPaths,
  ],
  pages: [
    { name: "Dashboard", path: "/" },
    { name: "Methodology", path: "/methodology" },
    { name: "Paper", path: "/paper" },
    { name: "About", path: "/about" }
  ],
  // The framework's default viewport meta uses `maximum-scale=1` which
  // disables pinch-zoom — bad for accessibility and mobile readability.
  // We emit our own viewport tag later in the head to override it.
  //
  // The inline boot script must appear before style.css (which contains the
  // [data-theme] rules) to prevent a flash of unstyled/wrong-theme content.
  // Observable Framework hoists front-matter scripts in src/index.md to
  // after stylesheets, so the head config is the only place we can
  // guarantee script-before-CSS ordering.
  head: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${socialMeta}<script>(function(){try{var t=localStorage.getItem("elj-theme");if(t!=="sunfire"&&t!=="deepcurrent")t="sunfire";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","sunfire");}}());</script><link rel="stylesheet" href="./style.css"><script>(function(){var s=document.createElement('script');s.defer=true;s.src='/_vercel/insights/script.js';document.head.appendChild(s);})();</script>`,
  theme: "dark",
  footer: "",
  toc: false,
  sidebar: false
};
