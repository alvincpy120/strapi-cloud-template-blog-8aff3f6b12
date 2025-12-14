import React from 'react';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';

const LOVABLE_APP_URL = 'https://cozy-thermometer-spot.lovable.app';
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
async function generatePreviewToken(slug) {
  const timestamp = Date.now();
  const signature = await createSignature(`${slug}:${timestamp}`, PREVIEW_SECRET);
  
  const tokenData = {
    slug,
    timestamp,
    signature
  };
  
  return btoa(JSON.stringify(tokenData));
}

const MobilePreviewButtons = () => {
  const { form } = useContentManagerContext();
  const slug = form?.values?.slug;

  if (!slug) return null;

  const handleDesktopPreview = async () => {
    const token = await generatePreviewToken(slug);
    window.open(`${LOVABLE_APP_URL}/preview?token=${token}`, '_blank');
  };

  const handleMobilePreview = async () => {
    const token = await generatePreviewToken(slug);
    window.open(`${LOVABLE_APP_URL}/preview?token=${token}&device=mobile`, '_blank');
  };

  const buttonStyle = {
    padding: '5px 10px',
    fontSize: '12px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    color: 'white',
    fontWeight: '500',
  };

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      <button
        onClick={handleDesktopPreview}
        style={{ ...buttonStyle, backgroundColor: '#4945FF' }}
      >
        Desktop Preview
      </button>
      <button
        onClick={handleMobilePreview}
        style={{ ...buttonStyle, backgroundColor: '#7B79FF' }}
      >
        Mobile Preview
      </button>
    </div>
  );
};

export default MobilePreviewButtons;
