'use strict';

/**
 * Article lifecycle hooks for:
 * 1. Automatic slug generation (slug = article ID)
 * 2. Automatic translation (English ↔ Traditional Chinese)
 */

// Track articles being processed to prevent infinite loops
const processingArticles = new Set();
const slugUpdatingArticles = new Set();

module.exports = {
  /**
   * Before update: Set slug to article ID
   */
  async beforeUpdate(event) {
    const { params } = event;
    
    // Get the article ID from the database using documentId AND locale
    if (params?.where?.documentId && params?.data) {
      try {
        // Build query with documentId and locale (if available)
        const whereClause = { documentId: params.where.documentId };
        
        // Include locale in query to get the correct article ID for this specific locale
        if (params.where.locale) {
          whereClause.locale = params.where.locale;
        }
        
        const existingArticle = await strapi.db.query('api::article.article').findOne({
          where: whereClause,
        });
        
        if (existingArticle?.id) {
          params.data.slug = String(existingArticle.id);
          console.log(`[Auto-Slug] beforeUpdate: Setting slug to ${existingArticle.id} for locale ${params.where.locale || 'default'}`);
        }
      } catch (error) {
        console.log(`[Auto-Slug] beforeUpdate error: ${error.message}`);
      }
    }
  },

  /**
   * After create: Set slug to article ID and trigger translation
   */
  async afterCreate(event) {
    const { result, params } = event;
    console.log('[Lifecycle] afterCreate triggered');
    
    // Set slug to article ID
    await setSlugToArticleId(result);
    
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
 * Set the article slug to its numeric ID
 */
async function setSlugToArticleId(article) {
  if (!article?.id) {
    console.log('[Auto-Slug] No article id, skipping slug update');
    return;
  }

  const articleId = String(article.id);
  
  // Prevent infinite loops
  if (slugUpdatingArticles.has(article.id)) {
    console.log(`[Auto-Slug] Already updating slug for ${article.id}, skipping`);
    return;
  }

  // Check if slug already matches article ID
  if (article.slug === articleId) {
    console.log(`[Auto-Slug] Slug already set to ${articleId}, skipping`);
    return;
  }

  try {
    slugUpdatingArticles.add(article.id);
    console.log(`[Auto-Slug] Setting slug to ${articleId} for article ${article.id}`);

    await strapi.entityService.update('api::article.article', article.id, {
      data: { slug: articleId },
    });

    console.log(`[Auto-Slug] Successfully set slug to ${articleId}`);
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
      // Update existing localization - set slug to this article's ID
      console.log(`[Auto-Translate] Updating existing ${targetLocale} version (ID: ${existingLocalization.id})`);
      
      await strapi.entityService.update('api::article.article', existingLocalization.id, {
        data: {
          ...translatedData,
          slug: String(existingLocalization.id), // Ensure slug = this article's ID
        },
        locale: targetLocale,
      });
      
      console.log(`[Auto-Translate] Successfully updated ${targetLocale} version with slug: ${existingLocalization.id}`);
    } else {
      // Create new localization using document API
      console.log(`[Auto-Translate] Creating new ${targetLocale} version`);

      try {
        let newArticle = null;
        
        if (documentId) {
          // Use document API to create localization
          newArticle = await strapi.documents('api::article.article').update({
            documentId: documentId,
            locale: targetLocale,
            data: {
              ...translatedData,
              publishedAt: null, // Create as draft
            },
          });
        } else {
          // Fallback: create as new entry
          newArticle = await strapi.entityService.create('api::article.article', {
            data: {
              ...translatedData,
              locale: targetLocale,
              publishedAt: null,
            },
          });
        }
        
        // After creation, update the slug to the new article's ID
        if (newArticle?.id) {
          await strapi.entityService.update('api::article.article', newArticle.id, {
            data: { slug: String(newArticle.id) },
          });
          console.log(`[Auto-Translate] Successfully created ${targetLocale} version (ID: ${newArticle.id}) with slug: ${newArticle.id}`);
        } else {
          // If we don't have the ID, query for it
          const createdArticle = await strapi.db.query('api::article.article').findOne({
            where: { documentId: documentId, locale: targetLocale },
          });
          if (createdArticle?.id) {
            await strapi.entityService.update('api::article.article', createdArticle.id, {
              data: { slug: String(createdArticle.id) },
            });
            console.log(`[Auto-Translate] Successfully created ${targetLocale} version (ID: ${createdArticle.id}) with slug: ${createdArticle.id}`);
          }
        }
      } catch (docError) {
        console.log(`[Auto-Translate] Document API failed, trying entityService: ${docError.message}`);
        
        // Fallback to entityService
        const newArticle = await strapi.entityService.create('api::article.article', {
          data: {
            ...translatedData,
            locale: targetLocale,
            publishedAt: null,
          },
        });
        
        // Update slug to the new article's ID
        if (newArticle?.id) {
          await strapi.entityService.update('api::article.article', newArticle.id, {
            data: { slug: String(newArticle.id) },
          });
          console.log(`[Auto-Translate] Successfully created ${targetLocale} version (ID: ${newArticle.id}) with slug: ${newArticle.id}`);
        }
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

