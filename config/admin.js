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
      openTarget: '_blank', // This opens preview in a new browser tab
      async handler(uid, { documentId, locale, status }) {
        // Fetch the document to get the slug
        const document = await strapi.documents(uid).findOne({ documentId });
        
        const clientUrl = env('CLIENT_URL', 'https://cozy-thermometer-spot.lovable.app');
        const slug = document?.slug || documentId;
        
        // Return the preview URL - opens in new tab due to openTarget: '_blank'
        return `${clientUrl}/preview?slug=${slug}`;
      },
    },
  },
});
