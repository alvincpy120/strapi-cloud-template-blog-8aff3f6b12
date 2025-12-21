'use strict';

/**
 * translate controller
 */

module.exports = ({ strapi }) => ({
  /**
   * Translate text endpoint
   */
  async translateText(ctx) {
    try {
      const { text, sourceLang, targetLang } = ctx.request.body;

      if (!text || !sourceLang || !targetLang) {
        return ctx.badRequest('Missing required fields: text, sourceLang, targetLang');
      }

      const translateService = strapi.service('api::translate.translate');
      const translatedText = await translateService.translateText(text, sourceLang, targetLang);

      ctx.body = {
        success: true,
        data: {
          original: text,
          translated: translatedText,
          sourceLang,
          targetLang,
        },
      };
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  /**
   * Translate content entry endpoint
   */
  async translateEntry(ctx) {
    try {
      const { contentType, entryId, sourceLocale, targetLocale, fields } = ctx.request.body;

      if (!contentType || !entryId || !sourceLocale || !targetLocale) {
        return ctx.badRequest('Missing required fields: contentType, entryId, sourceLocale, targetLocale');
      }

      // Get the entry from Strapi
      // contentType should be in format 'api::content-type-name.content-type-name'
      const entry = await strapi.entityService.findOne(contentType, entryId, {
        locale: sourceLocale,
        populate: '*',
      });

      if (!entry) {
        return ctx.notFound('Entry not found');
      }

      const translateService = strapi.service('api::translate.translate');
      const fieldsToTranslate = fields || Object.keys(entry).filter(key => 
        typeof entry[key] === 'string' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt'
      );

      const translatedData = await translateService.translateEntry(
        entry,
        sourceLocale,
        targetLocale,
        fieldsToTranslate
      );

      ctx.body = {
        success: true,
        data: translatedData,
      };
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },
});

