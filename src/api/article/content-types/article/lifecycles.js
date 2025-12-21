'use strict';

/**
 * Article lifecycle hooks for:
 * 1. Automatic slug generation (slug = documentId)
 * 2. Automatic translation (English ↔ Traditional Chinese)
 */

// Track articles being processed to prevent infinite loops
const processingArticles = new Set();
const slugUpdatingArticles = new Set();

module.exports = {
  /**
   * Before update: Set slug to documentId
   */
  async beforeUpdate(event) {
    const { params } = event;
    const documentId = params?.where?.documentId;
    
    if (documentId && params?.data) {
      // Always set slug to documentId
      params.data.slug = documentId;
      console.log(`[Auto-Slug] beforeUpdate: Setting slug to ${documentId}`);
    }
  },

  /**
   * After create: Set slug to documentId and trigger translation
   */
  async afterCreate(event) {
    const { result, params } = event;
    console.log('[Lifecycle] afterCreate triggered');
    
    // Set slug to documentId
    await setSlugToDocumentId(result);
    
    // Trigger translation
    await handleArticleTranslation(result, params);
  },

  /**
   * After update: Trigger translation
   */
  async afterUpdate(event) {
    const { result, params } = event;
    console.log('[Lifecycle] afterUpdate triggered');
    await handleArticleTranslation(result, params);
  },
};

/**
 * Set the article slug to its documentId
 */
async function setSlugToDocumentId(article) {
  if (!article?.documentId || !article?.id) {
    console.log('[Auto-Slug] No documentId or id, skipping slug update');
    return;
  }

  const documentId = article.documentId;
  
  // Prevent infinite loops
  if (slugUpdatingArticles.has(article.id)) {
    console.log(`[Auto-Slug] Already updating slug for ${article.id}, skipping`);
    return;
  }

  // Check if slug already matches documentId
  if (article.slug === documentId) {
    console.log(`[Auto-Slug] Slug already set to ${documentId}, skipping`);
    return;
  }

  try {
    slugUpdatingArticles.add(article.id);
    console.log(`[Auto-Slug] Setting slug to ${documentId} for article ${article.id}`);

    await strapi.entityService.update('api::article.article', article.id, {
      data: { slug: documentId },
    });

    console.log(`[Auto-Slug] Successfully set slug to ${documentId}`);
  } catch (error) {
    console.log(`[Auto-Slug] Failed to set slug: ${error.message}`);
  } finally {
    setTimeout(() => {
      slugUpdatingArticles.delete(article.id);
    }, 2000);
  }
}

async function handleArticleTranslation(article, params) {
  let targetLocale = null;
  let processingKey = null;
  
  try {
    // Get locale from params or result
    const sourceLocale = params?.locale || article?.locale;
    
    console.log(`[Auto-Translate] Event triggered. Article ID: ${article?.id}, Locale: ${sourceLocale}`);
    console.log(`[Auto-Translate] Article documentId: ${article?.documentId}`);

    // Skip if no article
    if (!article) {
      console.log('[Auto-Translate] No article in event, skipping');
      return;
    }

    // Skip if no locale
    if (!sourceLocale) {
      console.log('[Auto-Translate] No locale found, skipping');
      return;
    }

    const documentId = article.documentId;

    // Determine target locale - support multiple Chinese locale formats
    if (sourceLocale === 'en') {
      targetLocale = 'zh-Hant-HK';  // Your Traditional Chinese locale
    } else if (sourceLocale === 'zh-Hant-HK' || sourceLocale === 'zh-TW' || sourceLocale === 'zh' || sourceLocale.startsWith('zh')) {
      targetLocale = 'en';
    } else {
      // Unsupported locale, skip translation
      console.log(`[Auto-Translate] Skipping unsupported locale: ${sourceLocale}`);
      return;
    }

    // Create a unique key for this translation operation
    processingKey = `${documentId}-${sourceLocale}-${targetLocale}`;

    // Prevent infinite loops (translation triggering another translation)
    if (processingArticles.has(processingKey)) {
      console.log(`[Auto-Translate] Already processing ${processingKey}, skipping`);
      return;
    }

    // Check if DEEPL_API_KEY is set
    if (!process.env.DEEPL_API_KEY) {
      console.log('[Auto-Translate] DEEPL_API_KEY not set, skipping translation');
      return;
    }

    processingArticles.add(processingKey);
    console.log(`[Auto-Translate] Starting translation. Article: "${article.title || article.id}", From: ${sourceLocale}, To: ${targetLocale}`);

    // Get the translate service
    const translateService = strapi.service('api::translate.translate');

    if (!translateService) {
      console.log('[Auto-Translate] Translate service not found');
      return;
    }

    // Get full article with relations
    const fullArticle = await strapi.entityService.findOne('api::article.article', article.id, {
      populate: ['author', 'category', 'cover', 'blocks'],
      locale: sourceLocale,
    });

    if (!fullArticle) {
      console.log(`[Auto-Translate] Could not find article ${article.id}`);
      return;
    }

    console.log(`[Auto-Translate] Article found. Title: "${fullArticle.title}"`);

    // Translate the article
    const translatedData = await translateService.translateArticle(fullArticle, sourceLocale, targetLocale);

    console.log(`[Auto-Translate] Translation completed. Translated title: "${translatedData.title}"`);

    // Check if target locale version already exists using documentId
    let existingLocalization = null;
    if (documentId) {
      existingLocalization = await strapi.db.query('api::article.article').findOne({
        where: {
          documentId: documentId,
          locale: targetLocale,
        },
      });
    }

    if (existingLocalization) {
      // Update existing localization
      console.log(`[Auto-Translate] Updating existing ${targetLocale} version (ID: ${existingLocalization.id})`);
      
      await strapi.entityService.update('api::article.article', existingLocalization.id, {
        data: translatedData,
        locale: targetLocale,
      });
      
      console.log(`[Auto-Translate] Successfully updated ${targetLocale} version`);
    } else {
      // Create new localization using document API
      console.log(`[Auto-Translate] Creating new ${targetLocale} version`);

      try {
        if (documentId) {
          // Use document API to create localization
          await strapi.documents('api::article.article').update({
            documentId: documentId,
            locale: targetLocale,
            data: {
              ...translatedData,
              publishedAt: null, // Create as draft
            },
          });
        } else {
          // Fallback: create as new entry
          await strapi.entityService.create('api::article.article', {
            data: {
              ...translatedData,
              locale: targetLocale,
              publishedAt: null,
            },
          });
        }
        
        console.log(`[Auto-Translate] Successfully created ${targetLocale} version`);
      } catch (docError) {
        console.log(`[Auto-Translate] Document API failed, trying entityService: ${docError.message}`);
        
        // Fallback to entityService
        await strapi.entityService.create('api::article.article', {
          data: {
            ...translatedData,
            locale: targetLocale,
            publishedAt: null,
          },
        });
        
        console.log(`[Auto-Translate] Successfully created ${targetLocale} version using entityService`);
      }
    }

    console.log(`[Auto-Translate] Translation process completed successfully for ${targetLocale}`);

  } catch (error) {
    console.log(`[Auto-Translate] Translation failed: ${error.message}`);
    console.log(`[Auto-Translate] Stack trace:`, error.stack);
  } finally {
    // Remove from processing set after a delay to handle any edge cases
    if (processingKey) {
      setTimeout(() => {
        processingArticles.delete(processingKey);
      }, 5000);
    }
  }
}

