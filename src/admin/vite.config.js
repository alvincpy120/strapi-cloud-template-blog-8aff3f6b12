const { mergeConfig } = require('vite');

module.exports = (config) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    resolve: {
      alias: {
        '@': '/src',
        // Map zod/v3 and zod/v4 to the main zod package to fix import resolution
        'zod/v3': 'zod',
        'zod/v4': 'zod',
      },
    },
  });
};

