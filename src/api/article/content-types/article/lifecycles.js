'use strict';

/**
 * Article lifecycle hooks for:
 * 1. Automatic slug generation (slug = article ID)
 * 2. Character limit validation per locale
 */

// Character limits per locale
const CHINESE_LIMITS = { full_title: 45, short_title: 22, description: 55 };
const ENGLISH_LIMITS = { full_title: 90, short_title: 45, description: 100 };

// Get limits based on locale - any 'zh' variant uses Chinese limits
function getLimitsForLocale(locale) {
  if (locale && locale.startsWith('zh')) {
    return CHINESE_LIMITS;
  }
  return ENGLISH_LIMITS;
}

// Field display names for error messages
const FIELD_NAMES = {
  full_title: 'Full Title',
  short_title: 'Short Title',
  description: 'Description',
};

/**
 * Get locale from event - tries multiple sources
 */
function getLocale(event) {
  const { params } = event;
  // In Strapi v5, locale is typically in params
  return params?.locale || params?.data?.locale || 'en';
}

/**
 * Get the actual data from event - Strapi v5 puts it in params.data
 */
function getData(event) {
  // Strapi v5 content-manager puts data in params.data
  return event.params?.data || event.data || {};
}

/**
 * Validate character limits - throws error if over limit
 */
function validateCharacterLimits(data, locale) {
  if (!data || Object.keys(data).length === 0) {
    strapi.log.info(`[Validation] No data to validate`);
    return;
  }
  
  const limits = getLimitsForLocale(locale);
  const violations = [];

  strapi.log.info(`[Validation] Checking limits for locale: ${locale}`);
  strapi.log.info(`[Validation] Data fields: ${Object.keys(data).join(', ')}`);

  // Check each field only if it has a value
  for (const [field, limit] of Object.entries(limits)) {
    const value = data[field];
    if (typeof value === 'string') {
      strapi.log.info(`[Validation] ${field}: ${value.length}/${limit} chars`);
      if (value.length > limit) {
        const over = value.length - limit;
        violations.push(`${FIELD_NAMES[field]}: ${value.length}/${limit} characters (${over} over limit)`);
      }
    }
  }

  if (violations.length > 0) {
    const localeLabel = locale.startsWith('zh') ? 'Chinese' : 'English';
    strapi.log.error(`[Validation] Character limit exceeded for ${localeLabel} locale`);
    
    // Build field-specific errors for better admin panel handling
    const { YupValidationError } = require('@strapi/utils').errors;
    const fieldErrors = {};
    
    for (const [field, limit] of Object.entries(limits)) {
      const value = data[field];
      if (typeof value === 'string' && value.length > limit) {
        const over = value.length - limit;
        fieldErrors[field] = [`Exceeds ${limit} character limit by ${over} (current: ${value.length})`];
      }
    }
    
    // YupValidationError provides field-level errors that admin panel handles better
    const error = new YupValidationError({
      path: Object.keys(fieldErrors)[0],
      message: `Character limit exceeded for ${localeLabel} locale`,
      errors: fieldErrors
    });
    throw error;
  }
  
  strapi.log.info(`[Validation] All fields within limits`);
}

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
   * Before create: Validate character limits
   */
  async beforeCreate(event) {
    strapi.log.info('[Lifecycle] beforeCreate - Starting validation');
    const locale = getLocale(event);
    const data = getData(event);
    strapi.log.info(`[Lifecycle] beforeCreate - Locale: ${locale}`);
    strapi.log.info(`[Lifecycle] beforeCreate - event.data keys: ${Object.keys(event.data || {}).join(', ')}`);
    strapi.log.info(`[Lifecycle] beforeCreate - event.params.data keys: ${Object.keys(event.params?.data || {}).join(', ')}`);
    validateCharacterLimits(data, locale);
  },

  /**
   * Before update: Validate character limits
   */
  async beforeUpdate(event) {
    strapi.log.info('[Lifecycle] beforeUpdate - Starting validation');
    const locale = getLocale(event);
    const data = getData(event);
    strapi.log.info(`[Lifecycle] beforeUpdate - Locale: ${locale}`);
    strapi.log.info(`[Lifecycle] beforeUpdate - event.data keys: ${Object.keys(event.data || {}).join(', ')}`);
    strapi.log.info(`[Lifecycle] beforeUpdate - event.params.data keys: ${Object.keys(event.params?.data || {}).join(', ')}`);
    validateCharacterLimits(data, locale);
  },

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
