'use strict';

/**
 * Custom controller to trigger article translation
 * This endpoint can be called by n8n after creating an article
 */

module.exports = {
  /**
   * Trigger translation for a specific article
   * POST /api/articles/:id/translate
   */
  async translateArticle(ctx) {
    const { id } = ctx.params;
    
    strapi.log.info(`[API] translateArticle called for article ID: ${id}`);
    
    if (!id) {
      return ctx.badRequest('Article ID is required');
    }
    
    try {
      // Get the article from database
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id: parseInt(id) },
      });
      
      if (!article) {
        return ctx.notFound('Article not found');
      }
      
      strapi.log.info(`[API] Found article: ID=${article.id}, locale=${article.locale}, documentId=${article.documentId}`);
      
      const sourceLocale = article.locale;
      const documentId = article.documentId;
      
      if (!sourceLocale) {
        return ctx.badRequest('Article has no locale set');
      }
      
      if (!documentId) {
        return ctx.badRequest('Article has no documentId');
      }
      
      // Determine target locale
      let targetLocale = null;
      if (sourceLocale === 'en') {
        targetLocale = 'zh-Hant-HK';
      } else if (sourceLocale.startsWith('zh')) {
        targetLocale = 'en';
      } else {
        return ctx.badRequest(`Unsupported locale: ${sourceLocale}`);
      }
      
      strapi.log.info(`[API] Translating from ${sourceLocale} to ${targetLocale}`);
      
      // Check DEEPL_API_KEY
      if (!process.env.DEEPL_API_KEY) {
        return ctx.badRequest('DEEPL_API_KEY not configured');
      }
      
      // Get translate service
      const translateService = strapi.service('api::translate.translate');
      if (!translateService) {
        return ctx.badRequest('Translate service not found');
      }
      
      // Get full article with relations using documents API (works better with i18n in Strapi v5)
      strapi.log.info(`[API] Fetching full article with documentId: ${documentId}, locale: ${sourceLocale}`);
      
      let fullArticle;
      try {
        // Try using documents API first (Strapi v5 preferred method)
        fullArticle = await strapi.documents('api::article.article').findOne({
          documentId: documentId,
          locale: sourceLocale,
          populate: ['author', 'category', 'cover', 'blocks'],
        });
      } catch (docError) {
        strapi.log.warn(`[API] Documents API failed: ${docError.message}, trying db.query`);
        // Fallback to db.query with manual populate
        fullArticle = await strapi.db.query('api::article.article').findOne({
          where: { id: article.id },
          populate: ['author', 'category', 'cover', 'blocks'],
        });
      }
      
      if (!fullArticle) {
        strapi.log.error(`[API] Could not fetch full article data`);
        return ctx.badRequest('Could not fetch article data for translation');
      }
      
      // Use data from the basic query if fullArticle doesn't have title
      if (!fullArticle.title) {
        fullArticle.title = article.title;
        fullArticle.description = article.description;
      }
      
      strapi.log.info(`[API] Translating article: "${fullArticle.title}"`);
      
      // Translate
      const translatedData = await translateService.translateArticle(fullArticle, sourceLocale, targetLocale);
      
      // Truncate description to 80 characters (Strapi schema limit)
      if (translatedData.description && translatedData.description.length > 80) {
        translatedData.description = translatedData.description.substring(0, 77) + '...';
        strapi.log.info(`[API] Description truncated to 80 chars`);
      }
      
      strapi.log.info(`[API] Translation completed: "${translatedData.title}"`);
      
      // Check if target locale already exists
      const existingTarget = await strapi.db.query('api::article.article').findOne({
        where: { documentId: documentId, locale: targetLocale },
      });
      
      let resultArticle;
      
      if (existingTarget) {
        // Update existing
        strapi.log.info(`[API] Updating existing ${targetLocale} article (ID: ${existingTarget.id})`);
        await strapi.db.query('api::article.article').update({
          where: { id: existingTarget.id },
          data: {
            title: translatedData.title,
            description: translatedData.description,
            cover_text: translatedData.cover_text,
            slug: String(existingTarget.id),
          },
        });
        resultArticle = { id: existingTarget.id, action: 'updated' };
      } else {
        // Create new localization
        strapi.log.info(`[API] Creating new ${targetLocale} article`);
        
        const newArticle = await strapi.documents('api::article.article').update({
          documentId: documentId,
          locale: targetLocale,
          data: {
            title: translatedData.title,
            description: translatedData.description || '',
            cover_text: translatedData.cover_text || '',
            author: translatedData.author,
            category: translatedData.category,
            cover: translatedData.cover,
            blocks: translatedData.blocks || [],
            publishedAt: null,
          },
        });
        
        // Update slug
        if (newArticle?.id) {
          await strapi.db.query('api::article.article').update({
            where: { id: newArticle.id },
            data: { slug: String(newArticle.id) },
          });
        }
        
        resultArticle = { id: newArticle?.id, action: 'created' };
      }
      
      // Also update the source article's slug
      await strapi.db.query('api::article.article').update({
        where: { id: article.id },
        data: { slug: String(article.id) },
      });
      
      strapi.log.info(`[API] Translation completed successfully`);
      
      return {
        success: true,
        source: {
          id: article.id,
          locale: sourceLocale,
        },
        target: {
          ...resultArticle,
          locale: targetLocale,
        },
        translatedTitle: translatedData.title,
      };
      
    } catch (error) {
      strapi.log.error(`[API] Translation error: ${error.message}`);
      strapi.log.error(error.stack);
      return ctx.badRequest(`Translation failed: ${error.message}`);
    }
  },
};

