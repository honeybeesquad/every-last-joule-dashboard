import { readdirSync } from "node:fs";
import { join } from "node:path";

const fontFiles = readdirSync(join("src", "fonts"))
  .filter((file) => file.endsWith(".ttf"))
  .map((file) => `/fonts/${file}`);

export default {
  title: "Every Last Joule",
  root: "src",
  interpreters: {
    ".ts": ["tsx"]
  },
  dynamicPaths: fontFiles,
  pages: [
    { name: "Dashboard", path: "/" },
    { name: "Methodology", path: "/methodology" },
    { name: "About", path: "/about" }
  ],
  // The framework's default viewport meta uses `maximum-scale=1` which
  // disables pinch-zoom — bad for accessibility and mobile readability.
  // We emit our own viewport tag later in the head to override it.
  head: '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="./style.css">',
  theme: "dark",
  footer: "",
  toc: false,
  sidebar: false
};
