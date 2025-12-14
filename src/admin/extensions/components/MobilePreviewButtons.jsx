import React, { useState } from 'react';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';

const LOVABLE_APP_URL = 'https://cozy-thermometer-spot.lovable.app';

const MobilePreviewButtons = () => {
  const context = useContentManagerContext();
  const [copyText, setCopyText] = useState('Copy Mobile Preview URL');
  const [previewText, setPreviewText] = useState('Preview on Mobile');
  const [copyBg, setCopyBg] = useState('#dcdce4');
  const [previewBg, setPreviewBg] = useState('#4945ff');
  
  if (!context) {
    return null;
  }

  const { model, form } = context;
  
  if (model !== 'api::article.article') {
    return null;
  }

  const articleSlug = form?.values?.slug;

  if (!articleSlug) {
    return null;
  }

  const previewUrl = `${LOVABLE_APP_URL}/preview?slug=${articleSlug}&device=mobile`;

  const handlePreview = () => {
    setPreviewText('✓ Opening...');
    setPreviewBg('#32cd32');
    window.open(previewUrl, '_blank');
    setTimeout(() => {
      setPreviewText('Preview on Mobile');
      setPreviewBg('#4945ff');
    }, 1500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopyText('✓ Copied!');
      setCopyBg('#32cd32');
      setTimeout(() => {
        setCopyText('Copy Mobile Preview URL');
        setCopyBg('#dcdce4');
      }, 2000);
    } catch (err) {
      alert('URL copied: ' + previewUrl);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '12px', marginBottom: '12px' }}>
      <button
        type="button"
        onClick={handlePreview}
        style={{
          padding: '5px 10px',
          backgroundColor: previewBg,
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '500',
          fontSize: '12px'
        }}
      >
        {previewText}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          padding: '5px 10px',
          backgroundColor: copyBg,
          color: copyBg === '#32cd32' ? 'white' : '#32324d',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '500',
          fontSize: '12px'
        }}
      >
        {copyText}
      </button>
    </div>
  );
};

export default MobilePreviewButtons;
