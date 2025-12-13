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
      allowedOrigins: env('CLIENT_URL'),
      async handler(uid, { documentId, locale, status }) {
        const document = await strapi.documents(uid).findOne({ documentId });
        const slug = document?.slug;
        
        const previewSecret = env('PREVIEW_SECRET', 'strapi-preview-secret');
        const clientUrl = env('CLIENT_URL');
        
        // Return the URL - Strapi will open it in a new tab
        return `${clientUrl}/preview?secret=${previewSecret}&slug=${slug}`;
      },
    },
  },
});
