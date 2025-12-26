import React, { useState, useEffect } from 'react';
import { Button, Flex } from '@strapi/design-system';
import { Download } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useLocation } from 'react-router-dom';

const EXTRACT_COVER_KEY = 'strapi_extract_cover_pending';

const ExtractCoverButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toggleNotification } = useNotification();
  const { post } = useFetchClient();
  const location = useLocation();
  
  // Only show for report content type
  if (!location.pathname.includes('api::report.report')) {
    return null;
  }
  
  // Get documentId from URL
  const pathParts = location.pathname.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  const isNewEntry = !lastPart || lastPart === 'create';
  const documentId = isNewEntry ? null : lastPart;

  // Check on mount if we need to extract cover (after page reload from save)
  useEffect(() => {
    const checkPendingExtraction = async () => {
      const pending = sessionStorage.getItem(EXTRACT_COVER_KEY);
      
      if (pending && documentId) {
        sessionStorage.removeItem(EXTRACT_COVER_KEY);
        
        // Wait a moment for the page to fully load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsLoading(true);
        
        toggleNotification({
          type: 'info',
          message: 'Extracting cover from PDF...',
        });
        
        try {
          await post(`/api/reports/${documentId}/extract-cover`);
          
          toggleNotification({
            type: 'success',
            message: 'Cover extracted successfully! Refreshing...',
          });
          
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (error) {
          console.error('Extract cover error:', error);
          
          const errorMessage = error?.response?.data?.error?.message 
            || error?.message 
            || 'Failed to extract cover';
          
          toggleNotification({
            type: 'warning',
            message: errorMessage,
          });
          setIsLoading(false);
        }
      }
    };
    
    checkPendingExtraction();
  }, [documentId]);

  const handleExtractCover = async () => {
    setIsLoading(true);
    
    if (isNewEntry) {
      // For new entries: save the intent, trigger save, let the reload handle extraction
      sessionStorage.setItem(EXTRACT_COVER_KEY, 'true');
      
      toggleNotification({
        type: 'info',
        message: 'Saving report...',
      });
      
      // Find and click the save button
      const saveButton = document.querySelector('button[type="submit"]');
      if (saveButton) {
        saveButton.click();
        // The page will redirect after save, and useEffect will pick up the extraction
      } else {
        sessionStorage.removeItem(EXTRACT_COVER_KEY);
        toggleNotification({
          type: 'warning',
          message: 'Could not find save button. Please save manually first.',
        });
        setIsLoading(false);
      }
    } else {
      // For existing entries: save first, then extract
      toggleNotification({
        type: 'info',
        message: 'Saving and extracting cover...',
      });
      
      // Click save button
      const saveButton = document.querySelector('button[type="submit"]');
      if (saveButton) {
        saveButton.click();
      }
      
      // Wait for save to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        await post(`/api/reports/${documentId}/extract-cover`);
        
        toggleNotification({
          type: 'success',
          message: 'Cover extracted successfully! Refreshing...',
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (error) {
        console.error('Extract cover error:', error);
        
        const errorMessage = error?.response?.data?.error?.message 
          || error?.message 
          || 'Failed to extract cover. Make sure a PDF is uploaded.';
        
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
        onClick={handleExtractCover}
        loading={isLoading}
        startIcon={<Download />}
        variant="secondary"
        size="S"
      >
        {isLoading ? 'Saving & Extracting...' : 'Extract Cover'}
      </Button>
    </Flex>
  );
};

export default ExtractCoverButton;
