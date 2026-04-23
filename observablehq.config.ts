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
  head: '<link rel="stylesheet" href="./style.css">',
  theme: "dark",
  footer: "",
  toc: false,
  sidebar: false
};
