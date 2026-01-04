module.exports = ({ env }) => ({
  'strapi-v5-plugin-populate-deep': {
    enabled: true,
    config: {
      defaultDepth: 5,
    }
  },
  // Remove the 'preview-button' section entirely
});
