import { readdirSync } from "node:fs";
import { join } from "node:path";

const fontFiles = readdirSync(join("src", "fonts"))
  .filter((file) => file.endsWith(".ttf") || file.endsWith(".woff2"))
  .map((file) => `/fonts/${file}`);

// Social-share card. The description is the one-line story the card tells
// when the link is pasted into iMessage / Slack / Twitter / LinkedIn etc.
// og:image MUST be an absolute URL per the OG spec for link unfurlers to
// fetch it — relative paths are silently dropped by most platforms.
const SITE_URL = "https://everylastjoule.com";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const OG_TITLE = "Every Last Joule";
const OG_DESCRIPTION =
  "The wasted-energy database: curtailed renewables and flared gas across 128 regions worldwide, live from grid operators. How much of Bitcoin's hashrate could run on the joules we already pay for but throw away?";

const socialMeta = [
  `<meta name="description" content="${OG_DESCRIPTION}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:url" content="${SITE_URL}/">`,
  `<meta property="og:title" content="${OG_TITLE}">`,
  `<meta property="og:description" content="${OG_DESCRIPTION}">`,
  `<meta property="og:image" content="${OG_IMAGE}">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta property="og:image:alt" content="Globe showing wasted-energy pillars — curtailed renewables and flared gas — across 128 regions; headline reads 241% of Bitcoin hashrate supportable on the joules we already throw away.">`,
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
  // og-image.png is referenced only via <meta> tags (not by any page's
  // HTML), so Observable Framework doesn't auto-copy it unless we list
  // it explicitly here.
  dynamicPaths: [...fontFiles, "/og-image.png"],
  pages: [
    { name: "Dashboard", path: "/" },
    { name: "Methodology", path: "/methodology" },
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
  head: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${socialMeta}<script>(function(){try{var t=localStorage.getItem("elj-theme");if(t!=="sunfire"&&t!=="vellum"&&t!=="eclipse")t="sunfire";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","sunfire");}}());</script><link rel="stylesheet" href="./style.css">`,
  theme: "dark",
  footer: "",
  toc: false,
  sidebar: false
};
