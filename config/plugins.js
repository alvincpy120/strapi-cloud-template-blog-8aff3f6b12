module.exports = ({ env }) => ({
  'strapi-v5-plugin-populate-deep': {
    config: {
      defaultDepth: 5,
    }
  },
  'preview-button': {
    config: {
      contentTypes: [
        {
          uid: 'api::article.article',
          draft: {
            url: `${env('CLIENT_URL', 'https://cozy-thermometer-spot.lovable.app')}/preview?slug={slug}`,
          },
          published: {
            url: `${env('CLIENT_URL', 'https://cozy-thermometer-spot.lovable.app')}/article/{slug}`,
          },
        },
      ],
    },
  },
});
