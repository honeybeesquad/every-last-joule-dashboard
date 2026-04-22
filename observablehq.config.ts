export default {
  title: "Every Last Joule",
  root: "src",
  interpreters: {
    ".ts": ["tsx"]
  },
  pages: [
    { name: "Dashboard", path: "/" },
    { name: "Methodology", path: "/methodology" },
    { name: "About", path: "/about" }
  ],
  head: '<link rel="stylesheet" href="./style.css">',
  theme: "dark",
  footer: "",
  toc: false
};
