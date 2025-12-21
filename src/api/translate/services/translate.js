'use strict';

const deepl = require('deepl-node');

/**
 * translate service.
 */

module.exports = ({ strapi }) => ({
  /**
   * Translate text using DeepL API
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language code (e.g., 'EN', 'zh-TW')
   * @param {string} targetLang - Target language code (e.g., 'EN', 'zh-TW')
   * @returns {Promise<string>} Translated text
   */
  async translateText(text, sourceLang, targetLang) {
    const apiKey = process.env.DEEPL_API_KEY;

    if (!apiKey) {
      throw new Error('DEEPL_API_KEY environment variable is not set');
    }

    // Skip empty strings
    if (!text || text.trim() === '') {
      return text;
    }

    // Map Strapi locale codes to DeepL language codes
    // DeepL API language codes (CORRECT):
    // - 'EN-US' or 'EN-GB' for English (just 'EN' is deprecated for target)
    // - 'ZH-HANS' for Simplified Chinese
    // - 'ZH-HANT' for Traditional Chinese
    const localeMap = {
      'en': 'EN-US',  // Use EN-US for English (EN is deprecated as target)
      'EN': 'EN-US',
      'en-US': 'EN-US',
      'en-GB': 'EN-GB',
      'zh-TW': 'ZH-HANT',  // Traditional Chinese
      'zh-Hant-HK': 'ZH-HANT',  // Traditional Chinese (Hong Kong)
      'zh-HK': 'ZH-HANT',  // Traditional Chinese
      'zh': 'ZH-HANT',  // Default to Traditional Chinese
      'zh-Hans': 'ZH-HANS',  // Simplified Chinese
    };

    // For source language, DeepL accepts 'EN' and 'ZH' (auto-detects variant)
    const sourceLocaleMap = {
      'en': 'EN',
      'EN': 'EN',
      'en-US': 'EN',
      'en-GB': 'EN',
      'zh-TW': 'ZH',  // For source, just use ZH
      'zh-Hant-HK': 'ZH',
      'zh-HK': 'ZH',
      'zh': 'ZH',
      'zh-Hans': 'ZH',
    };

    const sourceLangCode = sourceLocaleMap[sourceLang] || (sourceLang.toLowerCase().startsWith('zh') ? 'ZH' : 'EN');
    let targetLangCode = localeMap[targetLang] || (targetLang.toLowerCase().startsWith('zh') ? 'ZH-HANT' : 'EN-US');

    // Force Traditional Chinese (ZH-HANT) for Traditional Chinese locales
    if (targetLang === 'zh-Hant-HK' || targetLang === 'zh-TW' || targetLang === 'zh-HK' || 
        (targetLang.toLowerCase().startsWith('zh') && !targetLang.toLowerCase().includes('hans'))) {
      targetLangCode = 'ZH-HANT';  // DeepL code for Traditional Chinese
    }

    // Force EN-US for English target locales
    if (targetLang === 'en' || targetLang === 'EN' || targetLang === 'en-US') {
      targetLangCode = 'EN-US';  // DeepL requires EN-US or EN-GB, not just EN
    }

    try {
      // Initialize translator - for free API, use 'https://api-free.deepl.com'
      const apiUrl = process.env.DEEPL_API_URL;
      const translator = apiUrl 
        ? new deepl.Translator(apiKey, { serverUrl: apiUrl })
        : new deepl.Translator(apiKey);
      
      // Use null for source language to let DeepL auto-detect, or specific language code
      const sourceLangForApi = sourceLangCode === 'auto' ? null : sourceLangCode;

      strapi.log.info(`[Translate] Translating from ${sourceLangForApi || 'auto'} to ${targetLangCode} (${targetLangCode === 'ZH-HANT' ? 'Traditional Chinese' : targetLangCode === 'ZH-HANS' ? 'Simplified Chinese' : targetLangCode})`);

      const result = await translator.translateText(
        text,
        sourceLangForApi,
        targetLangCode
      );

      return result.text;
    } catch (error) {
      strapi.log.error('DeepL translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  },

  /**
   * Translate dynamic zone blocks (e.g., rich-text, quote components)
   * @param {array} blocks - Dynamic zone blocks array
   * @param {string} sourceLocale - Source locale code
   * @param {string} targetLocale - Target locale code
   * @returns {Promise<array>} Translated blocks
   */
  async translateBlocks(blocks, sourceLocale, targetLocale) {
    if (!blocks || !Array.isArray(blocks)) {
      return blocks;
    }

    const translatedBlocks = [];

    for (const block of blocks) {
      const translatedBlock = { ...block };
      
      // Remove id to create new block in target locale
      delete translatedBlock.id;

      // Handle different component types
      if (block.__component === 'shared.rich-text' && block.body) {
        translatedBlock.body = await this.translateText(block.body, sourceLocale, targetLocale);
      } else if (block.__component === 'shared.quote') {
        if (block.title) {
          translatedBlock.title = await this.translateText(block.title, sourceLocale, targetLocale);
        }
        if (block.body) {
          translatedBlock.body = await this.translateText(block.body, sourceLocale, targetLocale);
        }
      }
      // shared.media and shared.slider don't need text translation

      translatedBlocks.push(translatedBlock);
    }

    return translatedBlocks;
  },

  /**
   * Translate an article and return data for creating/updating target locale
   * @param {object} article - Source article object
   * @param {string} sourceLocale - Source locale code
   * @param {string} targetLocale - Target locale code
   * @returns {Promise<object>} Translated article data
   */
  async translateArticle(article, sourceLocale, targetLocale) {
    const translatedData = {};

    // Translate text fields
    if (article.title) {
      translatedData.title = await this.translateText(article.title, sourceLocale, targetLocale);
    }

    if (article.description) {
      translatedData.description = await this.translateText(article.description, sourceLocale, targetLocale);
    }

    if (article.cover_text) {
      translatedData.cover_text = await this.translateText(article.cover_text, sourceLocale, targetLocale);
    }

    // Translate dynamic zone blocks
    if (article.blocks && article.blocks.length > 0) {
      translatedData.blocks = await this.translateBlocks(article.blocks, sourceLocale, targetLocale);
    }

    // Copy non-translatable fields
    // Use documentId as slug for all localized versions (same slug across locales)
    if (article.documentId) {
      translatedData.slug = article.documentId;
    } else if (article.slug) {
      // Fallback to existing slug if no documentId
      translatedData.slug = article.slug;
    }

    // Copy relations (author, category, cover image)
    if (article.author?.id) {
      translatedData.author = article.author.id;
    }
    if (article.category?.id) {
      translatedData.category = article.category.id;
    }
    if (article.cover?.id) {
      translatedData.cover = article.cover.id;
    }

    return translatedData;
  },

  /**
   * Translate content entry fields
   * @param {object} entry - Content entry object
   * @param {string} sourceLocale - Source locale code
   * @param {string} targetLocale - Target locale code
   * @param {array} fieldsToTranslate - Array of field names to translate
   * @returns {Promise<object>} Translated entry data
   */
  async translateEntry(entry, sourceLocale, targetLocale, fieldsToTranslate = []) {
    const translatedData = { ...entry };

    for (const fieldName of fieldsToTranslate) {
      if (entry[fieldName]) {
        const fieldValue = entry[fieldName];
        
        // Handle different field types
        if (typeof fieldValue === 'string') {
          translatedData[fieldName] = await this.translateText(
            fieldValue,
            sourceLocale,
            targetLocale
          );
        } else if (Array.isArray(fieldValue)) {
          // Handle array fields (e.g., rich text components)
          translatedData[fieldName] = await Promise.all(
            fieldValue.map(async (item) => {
              if (typeof item === 'string') {
                return await this.translateText(item, sourceLocale, targetLocale);
              } else if (typeof item === 'object') {
                // Recursively translate object fields
                const translatedItem = { ...item };
                delete translatedItem.id; // Remove id for new entries
                for (const key in item) {
                  if (typeof item[key] === 'string') {
                    translatedItem[key] = await this.translateText(
                      item[key],
                      sourceLocale,
                      targetLocale
                    );
                  }
                }
                return translatedItem;
              }
              return item;
            })
          );
        }
      }
    }

    return translatedData;
  },
});

