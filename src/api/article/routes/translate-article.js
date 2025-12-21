'use strict';

/**
 * Custom route to trigger article translation
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/articles/:id/translate',
      handler: 'translate-article.translateArticle',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

