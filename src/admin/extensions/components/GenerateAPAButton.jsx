import React, { useState, useEffect } from 'react';
import { Button, Flex } from '@strapi/design-system';
import { Link } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useLocation } from 'react-router-dom';

const GENERATE_APA_KEY = 'strapi_generate_apa_pending';

const GenerateAPAButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toggleNotification } = useNotification();
  const { post } = useFetchClient();
  const location = useLocation();
  
  // Only show for article content type
  if (!location.pathname.includes('api::article.article')) {
    return null;
  }
  
  // Get documentId from URL
  const pathParts = location.pathname.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  const isNewEntry = !lastPart || lastPart === 'create';
  const documentId = isNewEntry ? null : lastPart;

  // Check on mount if we need to generate APA (after page reload from save)
  useEffect(() => {
    const checkPendingGeneration = async () => {
      const pending = sessionStorage.getItem(GENERATE_APA_KEY);
      
      if (pending && documentId) {
        sessionStorage.removeItem(GENERATE_APA_KEY);
        
        // Wait a moment for the page to fully load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsLoading(true);
        
        toggleNotification({
          type: 'info',
          message: 'Generating APA references from URLs...',
        });
        
        try {
          const response = await post(`/api/articles/${documentId}/generate-apa`);
          
          toggleNotification({
            type: 'success',
            message: response.data?.message || 'APA references generated! Refreshing...',
          });
          
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (error) {
          console.error('Generate APA error:', error);
          
          const errorMessage = error?.response?.data?.error?.message 
            || error?.message 
            || 'Failed to generate APA references';
          
          toggleNotification({
            type: 'warning',
            message: errorMessage,
          });
          setIsLoading(false);
        }
      }
    };
    
    checkPendingGeneration();
  }, [documentId]);

  const handleGenerateAPA = async () => {
    setIsLoading(true);
    
    if (isNewEntry) {
      // For new entries: save first, then generate
      sessionStorage.setItem(GENERATE_APA_KEY, 'true');
      
      toggleNotification({
        type: 'info',
        message: 'Saving article first...',
      });
      
      // Find and click the save button
      const saveButton = document.querySelector('button[type="submit"]');
      if (saveButton) {
        saveButton.click();
        // The page will redirect after save, and useEffect will pick up the generation
      } else {
        sessionStorage.removeItem(GENERATE_APA_KEY);
        toggleNotification({
          type: 'warning',
          message: 'Could not find save button. Please save manually first.',
        });
        setIsLoading(false);
      }
    } else {
      // For existing entries: save first, then generate
      toggleNotification({
        type: 'info',
        message: 'Saving and generating APA references...',
      });
      
      // Click save button
      const saveButton = document.querySelector('button[type="submit"]');
      if (saveButton) {
        saveButton.click();
      }
      
      // Wait for save to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const response = await post(`/api/articles/${documentId}/generate-apa`);
        
        toggleNotification({
          type: 'success',
          message: response.data?.message || 'APA references generated! Refreshing...',
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (error) {
        console.error('Generate APA error:', error);
        
        const errorMessage = error?.response?.data?.error?.message 
          || error?.message 
          || 'Failed to generate APA references. Make sure Zotero Translation Server is running.';
        
        toggleNotification({
          type: 'warning',
          message: errorMessage,
        });
        setIsLoading(false);
      }
    }
  };

  return (
    <Flex>
      <Button
        onClick={handleGenerateAPA}
        loading={isLoading}
        startIcon={<Link />}
        variant="secondary"
        size="S"
        title="Transform URLs in Reference components to APA format using Zotero"
      >
        {isLoading ? 'Generating APA...' : 'Generate APA'}
      </Button>
    </Flex>
  );
};

export default GenerateAPAButton;

