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
      
      // Get full article with relations
      const fullArticle = await strapi.entityService.findOne('api::article.article', article.id, {
        populate: ['author', 'category', 'cover', 'blocks'],
      });
      
      strapi.log.info(`[API] Translating article: "${fullArticle.title}"`);
      
      // Translate
      const translatedData = await translateService.translateArticle(fullArticle, sourceLocale, targetLocale);
      
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

