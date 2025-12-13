module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  preview: {
    enabled: true,
    config: {
      allowedOrigins: [env('CLIENT_URL', 'https://cozy-thermometer-spot.lovable.app')],
      async handler(uid, { documentId, locale, status }) {
        // Fetch the document to get the slug
        const document = await strapi.documents(uid).findOne({ documentId });
        
        if (!document?.slug) {
          // Fallback to documentId if no slug
          const clientUrl = env('CLIENT_URL', 'https://cozy-thermometer-spot.lovable.app');
          return `${clientUrl}/preview?slug=${documentId}`;
        }
        
        const clientUrl = env('CLIENT_URL', 'https://cozy-thermometer-spot.lovable.app');
        
        // Return the preview URL - Strapi opens this in iframe/new tab
        return `${clientUrl}/preview?slug=${document.slug}`;
      },
    },
  },
});
