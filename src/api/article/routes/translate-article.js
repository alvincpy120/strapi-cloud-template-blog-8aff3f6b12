'use strict';

/**
 * Custom route to trigger article translation
 * Note: This route bypasses authentication for n8n integration
 * For production, consider using API tokens instead
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/articles/:id/translate',
      handler: 'translate-article.translateArticle',
      config: {
        auth: false,  // Allow public access (no authentication required)
        policies: [],
        middlewares: [],
      },
    },
  ],
};

