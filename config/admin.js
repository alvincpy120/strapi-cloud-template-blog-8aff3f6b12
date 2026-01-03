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
  // Preview configuration for articles
  preview: {
    enabled: true,
    config: {
      allowedOrigins: env('CLIENT_URL', 'https://gentle-wave-landing.lovable.app'),
      async handler(uid, { documentId, locale, status }) {
        // Only show preview for article content types
        if (uid === 'api::article.article') {
          const baseUrl = env('CLIENT_URL', 'https://gentle-wave-landing.lovable.app');
          // Return the preview URL for articles
          return `${baseUrl}/article/${documentId}`;
        }
        // Return null for other content types (hides preview button)
        return null;
      },
    },
  },
});
