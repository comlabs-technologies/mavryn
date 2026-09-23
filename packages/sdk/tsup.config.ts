import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  external: ["react", "react-dom"],
  // Components are shipped unstyled-but-classed; consumers import styles.css
  // or target the `cms-` class names with their own CSS.
  loader: { ".css": "copy" },
});
