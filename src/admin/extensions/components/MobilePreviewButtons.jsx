import React from 'react';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';

const LOVABLE_APP_URL = 'https://gentle-wave-landing.lovable.app';
const PREVIEW_SECRET = '0a53321e82da1baeb8e6a5f2c0b45df3ff297ac7150e8b89b35a67bd70feead5f642e9697a81290b3078cf21670ac8a0feb73c5300eaecec82e0008c1066ad8833197260c41175bf89c95b60c2cf11df0e94bf1397d57abd633c712ec317d2e30784d28729bf04b6cae53eb4136768786f61f820c53880eeeff4e920161833fd'; // Same value saved in Lovable

// Generate HMAC signature (must match server-side implementation)
async function createSignature(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Generate a secure preview token
async function generatePreviewToken(slug, contentType) {
  const timestamp = Date.now();
  const signature = await createSignature(`${slug}:${timestamp}`, PREVIEW_SECRET);
  
  const tokenData = {
    slug,
    contentType,
    timestamp,
    signature
  };
  
  return btoa(JSON.stringify(tokenData));
}

const MobilePreviewButtons = () => {
  const context = useContentManagerContext();
  const { form, contentType, id, document } = context;
  const formSlug = form?.values?.slug;
  const documentId = document?.documentId || id;
  
  // Get locale from multiple sources - check URL params as well
  const urlParams = new URLSearchParams(window.location.search);
  const urlLocale = urlParams.get('plugins[i18n][locale]');
  const locale = urlLocale || form?.values?.locale || document?.locale || context?.locale || 'en';
  
  // Get content type info from context
  const contentTypeUid = contentType?.uid;
  
  // Debug logging - expanded to help troubleshoot locale issues
  console.log('[MobilePreviewButtons] Context:', { 
    contentTypeUid, 
    formSlug, 
    documentId, 
    locale,
    urlLocale,
    formLocale: form?.values?.locale,
    documentLocale: document?.locale,
    contextLocale: context?.locale,
    id,
    fullContext: context
  });
  
  // Determine the preview URL based on content type
  let previewUrl;
  
  if (contentTypeUid === 'api::about.about') {
    // For About page, use /about
    previewUrl = `${LOVABLE_APP_URL}/about?preview=true&locale=${locale}`;
  } else if (contentTypeUid === 'api::report.report') {
    // For Reports, use /report/{documentId} with locale
    if (documentId) {
      previewUrl = `${LOVABLE_APP_URL}/report/${documentId}?preview=true&locale=${locale}`;
    } else if (id) {
      previewUrl = `${LOVABLE_APP_URL}/report/${id}?preview=true&locale=${locale}`;
    } else {
      previewUrl = null;
    }
  } else if (contentTypeUid === 'api::article.article') {
    // For Articles, use /article/{documentId} with locale
    if (documentId) {
      previewUrl = `${LOVABLE_APP_URL}/article/${documentId}?preview=true&locale=${locale}`;
    } else if (id) {
      previewUrl = `${LOVABLE_APP_URL}/article/${id}?preview=true&locale=${locale}`;
    } else {
      previewUrl = null;
    }
  } else {
    // For other content types, no preview
    previewUrl = null;
  }
  
  // Always show the buttons, but disable them if no valid URL
  const isDisabled = !previewUrl;

  const handleDesktopPreview = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const handleMobilePreview = () => {
    if (previewUrl) {
      window.open(`${previewUrl}&device=mobile`, '_blank');
    }
  };

  const buttonStyle = {
    padding: '5px 10px',
    fontSize: '12px',
    borderRadius: '4px',
    border: 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    color: 'white',
    fontWeight: '500',
    opacity: isDisabled ? 0.5 : 1,
  };

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      <button
        onClick={handleDesktopPreview}
        disabled={isDisabled}
        style={{ ...buttonStyle, backgroundColor: '#4945FF' }}
        title={isDisabled ? 'Save the article first to enable preview' : 'Open desktop preview'}
      >
        Desktop Preview
      </button>
      <button
        onClick={handleMobilePreview}
        disabled={isDisabled}
        style={{ ...buttonStyle, backgroundColor: '#7B79FF' }}
        title={isDisabled ? 'Save the article first to enable preview' : 'Open mobile preview'}
      >
        Mobile Preview
      </button>
    </div>
  );
};

export default MobilePreviewButtons;
