'use strict';

/**
 * Article lifecycle hooks for:
 * 1. Automatic slug generation (slug = article ID)
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
   * After create: Set slug to article ID
   */
  async afterCreate(event) {
    const { result } = event;
    
    strapi.log.info('========================================');
    strapi.log.info('[Lifecycle] afterCreate TRIGGERED');
    strapi.log.info(`[Lifecycle] Article ID: ${result?.id}, documentId: ${result?.documentId}`);
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
      // Update slug to article ID
      const articleId = String(result.id);
      if (result.slug !== articleId) {
        strapi.log.info(`[Lifecycle] Updating slug from "${result.slug}" to "${articleId}"`);
        await strapi.db.query('api::article.article').update({
          where: { id: result.id },
          data: { slug: articleId },
        });
        strapi.log.info(`[Lifecycle] Slug updated successfully to ${articleId}`);
      }
    } catch (error) {
      strapi.log.error(`[Lifecycle] afterCreate error: ${error.message}`);
      strapi.log.error(error.stack);
    } finally {
      endOperation(operationKey);
    }
  },

  /**
   * After update: Ensure slug is correct
   */
  async afterUpdate(event) {
    const { result } = event;
    
    strapi.log.info('========================================');
    strapi.log.info('[Lifecycle] afterUpdate TRIGGERED');
    strapi.log.info(`[Lifecycle] Article ID: ${result?.id}, documentId: ${result?.documentId}`);
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
      // Ensure slug is article ID
      const articleId = String(result.id);
      if (result.slug !== articleId) {
        strapi.log.info(`[Lifecycle] Updating slug from "${result.slug}" to "${articleId}"`);
        await strapi.db.query('api::article.article').update({
          where: { id: result.id },
          data: { slug: articleId },
        });
        strapi.log.info(`[Lifecycle] Slug updated successfully to ${articleId}`);
      }
    } catch (error) {
      strapi.log.error(`[Lifecycle] afterUpdate error: ${error.message}`);
      strapi.log.error(error.stack);
    } finally {
      endOperation(operationKey);
    }
  },
};
