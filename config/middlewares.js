module.exports = [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io'],
          'media-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io'],
          // This allows your Strapi admin to embed your Lovable app in an iframe
          'frame-src': ["'self'", 'https://gentle-wave-landing.lovable.app'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  // Custom middleware to filter reports relation (only show reports with report_file)
  {
    name: 'global::filter-reports-relation',
    config: {},
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
