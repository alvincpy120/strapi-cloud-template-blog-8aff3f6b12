import { useEffect, useRef } from 'react';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';

// Character limits per locale per field
// Chinese locales have stricter limits
const CHINESE_LIMITS = { full_title: 45, short_title: 22, description: 55 };
const ENGLISH_LIMITS = { full_title: 90, short_title: 45, description: 100 };

const CHAR_LIMITS = {
  // Chinese variants
  'zh': CHINESE_LIMITS,
  'zh-Hans': CHINESE_LIMITS,
  'zh-Hant': CHINESE_LIMITS,
  'zh-CN': CHINESE_LIMITS,
  'zh-TW': CHINESE_LIMITS,
  'zh-HK': CHINESE_LIMITS,
  'zh-Hant-TW': CHINESE_LIMITS,
  'zh-Hans-CN': CHINESE_LIMITS,
  // English
  'en': ENGLISH_LIMITS,
};

const FIELD_SELECTORS = {
  full_title: 'input[name="full_title"]',
  short_title: 'input[name="short_title"]',
  description: 'textarea[name="description"]',
};

// Get locale from URL - check multiple possible parameter formats
function getLocaleFromURL() {
  const searchParams = new URLSearchParams(window.location.search);
  // Try different parameter formats used by Strapi
  const locale = searchParams.get('plugins[i18n][locale]') 
    || searchParams.get('locale') 
    || 'en';
  
  console.log('[CharCounter] Detected locale:', locale, 'URL:', window.location.search);
  return locale;
}

// Get the correct limits based on locale
function getLimitsForLocale(locale) {
  // Check if locale exists in CHAR_LIMITS
  if (CHAR_LIMITS[locale]) {
    return CHAR_LIMITS[locale];
  }
  // If locale starts with 'zh', use Chinese limits
  if (locale && locale.startsWith('zh')) {
    console.log('[CharCounter] Using Chinese limits for locale:', locale);
    return CHINESE_LIMITS;
  }
  // Default to English
  console.log('[CharCounter] Using English limits for locale:', locale);
  return ENGLISH_LIMITS;
}

// Find the field wrapper element (the container that holds label + input + hint)
function findFieldWrapper(inputElement) {
  // Try to find the Field wrapper by traversing up
  let parent = inputElement.parentElement;
  let depth = 0;
  while (parent && depth < 10) {
    // Look for the field container - usually has a label sibling
    if (parent.querySelector('label') && parent.contains(inputElement)) {
      return parent;
    }
    parent = parent.parentElement;
    depth++;
  }
  // Fallback to immediate parent
  return inputElement.parentElement;
}

// Create counter element with larger, more visible font
function createCounterElement(fieldName) {
  const counter = document.createElement('div');
  counter.id = `char-counter-${fieldName}`;
  counter.style.cssText = `
    margin-top: 6px;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #666687;
    font-weight: 500;
  `;
  return counter;
}

// Hide/remove old description texts
function hideOldDescriptions() {
  // Find and hide any existing field hints/descriptions containing the old text
  const hints = document.querySelectorAll('p, span, div');
  hints.forEach(el => {
    if (el.textContent && el.textContent.includes('English: max') && el.textContent.includes('中文: max')) {
      el.style.display = 'none';
    }
  });
}

// Check if any field is over limit or empty
function checkAllLimits() {
  const locale = getLocaleFromURL();
  const limits = getLimitsForLocale(locale);
  const violations = [];
  const emptyFields = [];

  for (const [fieldName, selector] of Object.entries(FIELD_SELECTORS)) {
    const input = document.querySelector(selector);
    if (input) {
      const value = (input.value || '').trim();
      const limit = limits[fieldName];
      
      // Check if empty
      if (value.length === 0) {
        emptyFields.push(fieldName);
      }
      // Check if over limit
      else if (value.length > limit) {
        violations.push({
          field: fieldName,
          current: value.length,
          limit: limit,
          over: value.length - limit
        });
      }
    }
  }

  return { violations, emptyFields };
}

// Show error banner at top of form
function showErrorBanner(violations, emptyFields) {
  // Remove existing banner
  const existingBanner = document.getElementById('char-limit-error-banner');
  if (existingBanner) existingBanner.remove();
  
  const locale = getLocaleFromURL();
  const localeLabel = locale.startsWith('zh') ? 'Chinese' : 'English';
  
  const banner = document.createElement('div');
  banner.id = 'char-limit-error-banner';
  banner.style.cssText = `
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: #fcecea;
    border: 1px solid #d02b20;
    border-radius: 4px;
    padding: 12px 20px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    max-width: 500px;
  `;
  
  let content = '';
  
  // Empty fields error
  if (emptyFields && emptyFields.length > 0) {
    const emptyMessages = emptyFields.map(f => 
      `<div style="margin: 4px 0;">• ${f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>`
    ).join('');
    content += `
      <div style="color: #d02b20; font-weight: 600; margin-bottom: 8px;">
        ⚠️ Required fields cannot be empty
      </div>
      <div style="color: #333; font-size: 14px; margin-bottom: 12px;">
        ${emptyMessages}
      </div>
    `;
  }
  
  // Character limit violations
  if (violations && violations.length > 0) {
    const limitMessages = violations.map(v => 
      `<div style="margin: 4px 0;">• ${v.field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}: <strong>${v.current}/${v.limit}</strong> (${v.over} over)</div>`
    ).join('');
    content += `
      <div style="color: #d02b20; font-weight: 600; margin-bottom: 8px;">
        ⚠️ Character limit exceeded (${localeLabel})
      </div>
      <div style="color: #333; font-size: 14px;">
        ${limitMessages}
      </div>
    `;
  }
  
  banner.innerHTML = content;
  document.body.appendChild(banner);
  
  // Flash the counters that are over limit
  if (violations) {
    violations.forEach(v => {
      const counter = document.getElementById(`char-counter-${v.field}`);
      if (counter) {
        counter.style.background = '#fcecea';
        counter.style.padding = '4px 8px';
        counter.style.borderRadius = '4px';
        setTimeout(() => {
          counter.style.background = 'transparent';
          counter.style.padding = '0';
        }, 2000);
      }
    });
  }
  
  // Highlight empty fields
  if (emptyFields) {
    emptyFields.forEach(fieldName => {
      const input = document.querySelector(FIELD_SELECTORS[fieldName]);
      if (input) {
        input.style.borderColor = '#d02b20';
        input.style.boxShadow = '0 0 0 2px rgba(208, 43, 32, 0.2)';
        setTimeout(() => {
          input.style.borderColor = '';
          input.style.boxShadow = '';
        }, 2000);
      }
    });
  }
  
  // Auto-remove banner after 5 seconds
  setTimeout(() => {
    banner.remove();
  }, 5000);
}

// Intercept save button clicks
function setupSaveInterceptor() {
  // Find save buttons by looking for buttons with "Save" or "Publish" text
  const allButtons = document.querySelectorAll('button');
  
  allButtons.forEach(btn => {
    const btnText = btn.textContent?.toLowerCase() || '';
    const isSaveButton = btnText.includes('save') || btnText.includes('publish') || btn.type === 'submit';
    
    if (!isSaveButton) return;
    if (btn.dataset.charLimitIntercepted) return;
    
    btn.dataset.charLimitIntercepted = 'true';
    
    btn.addEventListener('click', (e) => {
      const { violations, emptyFields } = checkAllLimits();
      
      if (violations.length > 0 || emptyFields.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Show error banner
        showErrorBanner(violations, emptyFields);
        return false;
      }
    }, true); // Use capture phase to intercept before React handles it
  });
}

// Update counter display
function updateCounter(fieldName, inputElement) {
  const counterId = `char-counter-${fieldName}`;
  let counter = document.getElementById(counterId);
  
  if (!counter) {
    // Create counter if it doesn't exist
    counter = createCounterElement(fieldName);
    
    // Find the field wrapper and append counter after the input
    const fieldWrapper = findFieldWrapper(inputElement);
    if (fieldWrapper) {
      // Insert after the input element's direct container
      const inputContainer = inputElement.parentElement;
      if (inputContainer && inputContainer.parentElement) {
        inputContainer.parentElement.insertBefore(counter, inputContainer.nextSibling);
      } else {
        fieldWrapper.appendChild(counter);
      }
    }
  }

  const locale = getLocaleFromURL();
  const limits = getLimitsForLocale(locale);
  const maxLength = limits[fieldName];
  const currentLength = (inputElement.value || '').length;
  const remaining = maxLength - currentLength;

  // Determine color and style based on remaining
  let color = '#666687'; // Strapi neutral
  let fontWeight = '400';
  
  if (remaining < 0) {
    color = '#d02b20'; // red - over limit
    fontWeight = '600';
  } else if (remaining <= Math.ceil(maxLength * 0.1)) {
    color = '#be5d01'; // orange - warning
    fontWeight = '500';
  }

  counter.style.color = color;
  counter.style.fontWeight = fontWeight;
  
  if (remaining < 0) {
    counter.textContent = `${remaining} characters (${Math.abs(remaining)} over limit)`;
  } else {
    counter.textContent = `${remaining} characters remaining`;
  }
  
  // Update save interceptor whenever counter updates
  setupSaveInterceptor();
}

// Main component
export function ArticleCharCounter() {
  const intervalRef = useRef(null);
  const observerRef = useRef(null);
  
  let context = null;
  try {
    context = useContentManagerContext();
  } catch (e) {
    return null;
  }

  const contentType = context?.contentType?.uid;

  useEffect(() => {
    // Only run for Article content type
    if (contentType !== 'api::article.article') {
      return;
    }

    // Function to set up listeners for a field
    function setupFieldListener(fieldName, selector) {
      const input = document.querySelector(selector);
      if (input && !input.dataset.charCounterAttached) {
        input.dataset.charCounterAttached = 'true';
        
        // Initial update
        updateCounter(fieldName, input);
        
        // Listen for input events
        input.addEventListener('input', () => updateCounter(fieldName, input));
        input.addEventListener('change', () => updateCounter(fieldName, input));
      }
    }

    // Set up listeners for all fields
    function setupAllListeners() {
      Object.entries(FIELD_SELECTORS).forEach(([fieldName, selector]) => {
        setupFieldListener(fieldName, selector);
      });
    }

    // Initial setup
    setupAllListeners();
    hideOldDescriptions();
    setupSaveInterceptor();

    // Use MutationObserver to detect when fields are added to DOM
    observerRef.current = new MutationObserver(() => {
      setupAllListeners();
      hideOldDescriptions();
      setupSaveInterceptor();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also poll periodically to catch any missed updates
    intervalRef.current = setInterval(() => {
      Object.entries(FIELD_SELECTORS).forEach(([fieldName, selector]) => {
        const input = document.querySelector(selector);
        if (input) {
          updateCounter(fieldName, input);
        }
      });
      hideOldDescriptions();
    }, 500);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Remove counters
      Object.keys(FIELD_SELECTORS).forEach(fieldName => {
        const counter = document.getElementById(`char-counter-${fieldName}`);
        if (counter) counter.remove();
      });
    };
  }, [contentType]);

  // This component doesn't render anything visible - it just injects counters
  return null;
}

export default ArticleCharCounter;
