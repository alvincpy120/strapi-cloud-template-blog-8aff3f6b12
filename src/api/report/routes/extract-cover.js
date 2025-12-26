'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/reports/:documentId/extract-cover',
      handler: 'extract-cover.extractCover',
      config: {
        policies: [],
        auth: false, // Set to true in production or use proper auth
      },
    },
  ],
};

