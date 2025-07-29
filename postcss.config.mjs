/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {
      // Forzar el uso de CSS nativo en lugar de lightningcss
      lightningcss: false
    },
    autoprefixer: {},
  },
};

export default config;
