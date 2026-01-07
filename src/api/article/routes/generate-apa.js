'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/articles/:documentId/generate-apa',
      handler: 'generate-apa.generateAPA',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

