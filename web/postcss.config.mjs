/** Tailwind + autoprefixer, same as the Vite app used.
 *
 * `.mjs` deliberately: web/package.json has no "type": "module", so Next reads
 * a plain postcss.config.js as CommonJS and an `export default` there fails
 * with "must export a `plugins` key".
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
