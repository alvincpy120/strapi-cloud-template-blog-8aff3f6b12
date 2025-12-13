export default ({ env }) => ({
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
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
  // Preview configuration - returning null hides the preview button
  preview: {
    enabled: true,
    config: {
      allowedOrigins: env('CLIENT_URL', 'https://cozy-thermometer-spot.lovable.app'),
      async handler(uid, { documentId, locale, status }) {
        // Returning null tells Strapi not to show the preview button
        return null;
      },
    },
  },
});
