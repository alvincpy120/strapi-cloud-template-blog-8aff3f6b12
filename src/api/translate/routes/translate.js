'use strict';

/**
 * translate router
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/translate/text',
      handler: 'translate.translateText',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/translate/entry',
      handler: 'translate.translateEntry',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

