'use strict';

/**
 * Article lifecycle hooks for:
 * 1. Automatic slug generation (slug = article ID)
 * 2. Automatic translation (English ↔ Traditional Chinese)
 */

// Simple in-memory tracking to prevent infinite loops (resets on cold start, which is fine)
const activeOperations = new Map();

function isOperationActive(key) {
  const timestamp = activeOperations.get(key);
  if (!timestamp) return false;
  // Expire after 60 seconds
  if (Date.now() - timestamp > 60000) {
    activeOperations.delete(key);
    return false;
  }
  return true;
}

function startOperation(key) {
  activeOperations.set(key, Date.now());
}

function endOperation(key) {
  activeOperations.delete(key);
}

module.exports = {
  /**
   * After create: Set slug to article ID and trigger translation
   */
  async afterCreate(event) {
    const { result } = event;
    
    strapi.log.info('========================================');
    strapi.log.info('[Lifecycle] afterCreate TRIGGERED');
    strapi.log.info(`[Lifecycle] Article ID: ${result?.id}, documentId: ${result?.documentId}, locale: ${result?.locale}`);
    strapi.log.info('========================================');
    
    if (!result?.id) {
      strapi.log.warn('[Lifecycle] No result.id in afterCreate, skipping');
      return;
    }

    const operationKey = `create-${result.id}`;
    if (isOperationActive(operationKey)) {
      strapi.log.info(`[Lifecycle] Operation ${operationKey} already active, skipping`);
      return;
    }
    
    startOperation(operationKey);
    
    try {
      // Step 1: Update slug to article ID
      const articleId = String(result.id);
      if (result.slug !== articleId) {
        strapi.log.info(`[Lifecycle] Updating slug from "${result.slug}" to "${articleId}"`);
        await strapi.db.query('api::article.article').update({
          where: { id: result.id },
          data: { slug: articleId },
        });
        strapi.log.info(`[Lifecycle] Slug updated successfully to ${articleId}`);
      }

      // Step 2: Trigger translation
      await triggerTranslation(result);
      
    } catch (error) {
      strapi.log.error(`[Lifecycle] afterCreate error: ${error.message}`);
      strapi.log.error(error.stack);
    } finally {
      endOperation(operationKey);
    }
  },

  /**
   * After update: Ensure slug is correct and trigger translation
   */
  async afterUpdate(event) {
    const { result } = event;
    
    strapi.log.info('========================================');
    strapi.log.info('[Lifecycle] afterUpdate TRIGGERED');
    strapi.log.info(`[Lifecycle] Article ID: ${result?.id}, documentId: ${result?.documentId}, locale: ${result?.locale}`);
    strapi.log.info('========================================');
    
    if (!result?.id) {
      strapi.log.warn('[Lifecycle] No result.id in afterUpdate, skipping');
      return;
    }

    const operationKey = `update-${result.id}`;
    if (isOperationActive(operationKey)) {
      strapi.log.info(`[Lifecycle] Operation ${operationKey} already active, skipping`);
      return;
    }
    
    startOperation(operationKey);
    
    try {
      // Step 1: Ensure slug is article ID
      const articleId = String(result.id);
      if (result.slug !== articleId) {
        strapi.log.info(`[Lifecycle] Updating slug from "${result.slug}" to "${articleId}"`);
        await strapi.db.query('api::article.article').update({
          where: { id: result.id },
          data: { slug: articleId },
        });
        strapi.log.info(`[Lifecycle] Slug updated successfully to ${articleId}`);
      }

      // Step 2: Trigger translation
      await triggerTranslation(result);
      
    } catch (error) {
      strapi.log.error(`[Lifecycle] afterUpdate error: ${error.message}`);
      strapi.log.error(error.stack);
    } finally {
      endOperation(operationKey);
    }
  },
};

/**
 * Trigger translation for an article
 */
async function triggerTranslation(article) {
  strapi.log.info('[Translation] ====== Starting translation process ======');
  
  try {
    // Get fresh article data from database
    const dbArticle = await strapi.db.query('api::article.article').findOne({
      where: { id: article.id },
    });
    
    if (!dbArticle) {
      strapi.log.warn('[Translation] Article not found in database');
      return;
    }
    
    const sourceLocale = dbArticle.locale;
    const documentId = dbArticle.documentId;
    
    strapi.log.info(`[Translation] Source locale: ${sourceLocale}, documentId: ${documentId}`);
    
    if (!sourceLocale || !documentId) {
      strapi.log.warn('[Translation] Missing locale or documentId, skipping');
      return;
    }
    
    // Determine target locale
    let targetLocale = null;
    if (sourceLocale === 'en') {
      targetLocale = 'zh-Hant-HK';
      strapi.log.info(`[Translation] Direction: English → Traditional Chinese`);
    } else if (sourceLocale === 'zh-Hant-HK' || sourceLocale === 'zh-TW' || sourceLocale === 'zh-HK' || sourceLocale === 'zh' || (sourceLocale && sourceLocale.startsWith('zh'))) {
      targetLocale = 'en';
      strapi.log.info(`[Translation] Direction: Traditional Chinese (${sourceLocale}) → English`);
    } else {
      strapi.log.info(`[Translation] Unsupported locale: "${sourceLocale}", skipping`);
      return;
    }
    
    strapi.log.info(`[Translation] Source: ${sourceLocale}, Target: ${targetLocale}`);
    
    // Check for infinite loop - use article ID + direction to be more specific
    const translationKey = `translate-${article.id}-to-${targetLocale}`;
    strapi.log.info(`[Translation] Checking translation key: ${translationKey}`);
    
    if (isOperationActive(translationKey)) {
      strapi.log.info(`[Translation] Already translating ${translationKey}, skipping to prevent loop`);
      return;
    }
    
    // Also check reverse direction to prevent ping-pong
    const reverseKey = `translate-from-${sourceLocale}-doc-${documentId}`;
    if (isOperationActive(reverseKey)) {
      strapi.log.info(`[Translation] Reverse translation ${reverseKey} in progress, skipping`);
      return;
    }
    
    // Mark both directions as active
    startOperation(reverseKey);
    
    // Check DEEPL_API_KEY
    const deeplKey = process.env.DEEPL_API_KEY;
    strapi.log.info(`[Translation] DEEPL_API_KEY: ${deeplKey ? 'SET (length ' + deeplKey.length + ')' : 'NOT SET'}`);
    
    if (!deeplKey) {
      strapi.log.error('[Translation] DEEPL_API_KEY not configured! Add it to Strapi Cloud environment variables.');
      return;
    }
    
    startOperation(translationKey);
    
    try {
      // Get translate service
      const translateService = strapi.service('api::translate.translate');
      if (!translateService) {
        strapi.log.error('[Translation] Translate service not found!');
        return;
      }
      
      // Get full article with relations - MUST specify locale for i18n content
      strapi.log.info(`[Translation] Loading full article (ID: ${article.id}, locale: ${sourceLocale})`);
      
      let fullArticle;
      try {
        fullArticle = await strapi.entityService.findOne('api::article.article', article.id, {
          populate: ['author', 'category', 'cover', 'blocks'],
          locale: sourceLocale,
        });
      } catch (fetchError) {
        strapi.log.error(`[Translation] Error fetching article: ${fetchError.message}`);
        // Try without locale
        fullArticle = await strapi.entityService.findOne('api::article.article', article.id, {
          populate: ['author', 'category', 'cover', 'blocks'],
        });
      }
      
      if (!fullArticle) {
        strapi.log.error('[Translation] Could not load full article - article is null');
        return;
      }
      
      strapi.log.info(`[Translation] Full article loaded: title="${fullArticle.title}", locale=${fullArticle.locale}`);
      
      // Translate
      strapi.log.info(`[Translation] Calling translateArticle service...`);
      let translatedData;
      try {
        translatedData = await translateService.translateArticle(fullArticle, sourceLocale, targetLocale);
        strapi.log.info(`[Translation] Translation successful! Translated title: "${translatedData.title}"`);
      } catch (translateError) {
        strapi.log.error(`[Translation] DeepL translation failed: ${translateError.message}`);
        strapi.log.error(translateError.stack);
        return;
      }
      
      if (!translatedData || !translatedData.title) {
        strapi.log.error('[Translation] Translation returned empty data');
        return;
      }
      
      // Check if target locale already exists
      strapi.log.info(`[Translation] Checking if ${targetLocale} version exists for documentId: ${documentId}`);
      const existingTarget = await strapi.db.query('api::article.article').findOne({
        where: { documentId: documentId, locale: targetLocale },
      });
      
      strapi.log.info(`[Translation] Existing ${targetLocale} article: ${existingTarget ? 'YES (ID: ' + existingTarget.id + ')' : 'NO'}`);
      
      if (existingTarget) {
        // Update existing
        strapi.log.info(`[Translation] Updating existing ${targetLocale} article (ID: ${existingTarget.id})`);
        await strapi.db.query('api::article.article').update({
          where: { id: existingTarget.id },
          data: {
            title: translatedData.title,
            description: translatedData.description,
            cover_text: translatedData.cover_text,
            slug: String(existingTarget.id),
          },
        });
        strapi.log.info(`[Translation] Updated ${targetLocale} article successfully`);
      } else {
        // Create new localization
        strapi.log.info(`[Translation] Creating new ${targetLocale} article for documentId: ${documentId}`);
        strapi.log.info(`[Translation] Data to create: title="${translatedData.title}"`);
        
        let newArticle;
        try {
          newArticle = await strapi.documents('api::article.article').update({
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
          strapi.log.info(`[Translation] strapi.documents().update() succeeded`);
        } catch (createError) {
          strapi.log.error(`[Translation] Failed to create ${targetLocale} article: ${createError.message}`);
          strapi.log.error(createError.stack);
          return;
        }
        
        strapi.log.info(`[Translation] Created new article, result: ${JSON.stringify(newArticle?.id || newArticle?.documentId || 'unknown')}`);
        
        // Update slug for new article
        if (newArticle?.id) {
          await strapi.db.query('api::article.article').update({
            where: { id: newArticle.id },
            data: { slug: String(newArticle.id) },
          });
          strapi.log.info(`[Translation] Set slug to ${newArticle.id} for new ${targetLocale} article`);
        } else {
          // Query to find the created article
          const createdArticle = await strapi.db.query('api::article.article').findOne({
            where: { documentId: documentId, locale: targetLocale },
          });
          if (createdArticle?.id) {
            await strapi.db.query('api::article.article').update({
              where: { id: createdArticle.id },
              data: { slug: String(createdArticle.id) },
            });
            strapi.log.info(`[Translation] Set slug to ${createdArticle.id} for new ${targetLocale} article`);
          }
        }
      }
      
      strapi.log.info('[Translation] ====== Translation completed successfully ======');
      
    } finally {
      endOperation(translationKey);
      endOperation(reverseKey);
    }
    
  } catch (error) {
    strapi.log.error(`[Translation] Error: ${error.message}`);
    strapi.log.error(error.stack);
  }
}
