import MobilePreviewButtons from './extensions/components/MobilePreviewButtons.jsx';
import ExtractCoverButton from './extensions/components/ExtractCoverButton.jsx';
import GenerateAPAButton from './extensions/components/GenerateAPAButton.jsx';

const config = {
  locales: [
    // 'ar',
    // 'fr',
    // 'cs',
    // 'de',
    // 'dk',
    // 'es',
    // 'he',
    // 'id',
    // 'it',
    // 'ja',
    // 'ko',
    // 'ms',
    // 'nl',
    // 'no',
    // 'pl',
    // 'pt-BR',
    // 'pt',
    // 'ru',
    // 'sk',
    // 'sv',
    // 'th',
    // 'tr',
    // 'uk',
    // 'vi',
    // 'zh-Hans',
    // 'zh',
  ],
};

const bootstrap = (app) => {
  console.log('Strapi admin bootstrap:', app);
  
  try {
    // Strapi v5 syntax - get the content-manager plugin first
    const contentManager = app.getPlugin('content-manager');
    console.log('Content Manager plugin:', contentManager);
    
    if (contentManager && typeof contentManager.injectComponent === 'function') {
      // Inject Mobile Preview Buttons
      contentManager.injectComponent('editView', 'right-links', {
        name: 'MobilePreviewButtons',
        Component: MobilePreviewButtons,
      });
      console.log('MobilePreviewButtons injected successfully');
      
      // Inject Extract Cover Button for Reports
      contentManager.injectComponent('editView', 'right-links', {
        name: 'ExtractCoverButton',
        Component: ExtractCoverButton,
      });
      console.log('ExtractCoverButton injected successfully');
      
      // Inject Generate APA Button for Articles
      contentManager.injectComponent('editView', 'right-links', {
        name: 'GenerateAPAButton',
        Component: GenerateAPAButton,
      });
      console.log('GenerateAPAButton injected successfully');
    } else {
      console.error('content-manager plugin or injectComponent not available');
      console.log('Available methods on contentManager:', contentManager ? Object.keys(contentManager) : 'undefined');
    }
  } catch (error) {
    console.error('Failed to inject components:', error);
  }
};

export default {
  config,
  bootstrap,
};
