// libvips is loaded by the native sharp binary, outside JavaScript import tracing.
const badgeNativeFiles = ["node_modules/@img/sharp-libvips-linux-x64/**/*"];

export default {
  outputFileTracingIncludes: {
    "/api/composer/badge-library": badgeNativeFiles,
    "/api/composer/badge-library/image": badgeNativeFiles,
  },
};
