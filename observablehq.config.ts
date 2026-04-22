export default {
  title: "Every Last Joule",
  root: "src",
  interpreters: {
    ".ts": ["tsx"]
  },
  pages: [
    { name: "Dashboard", path: "/" }
    // Methodology and About pages added once src/methodology.md and src/about.md exist (Tasks 47-48).
  ],
  head: '<link rel="stylesheet" href="./style.css">',
  theme: "dark",
  footer: "",
  toc: false
};
