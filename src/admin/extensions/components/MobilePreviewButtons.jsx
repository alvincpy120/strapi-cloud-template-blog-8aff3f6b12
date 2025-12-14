import React from 'react';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';
import { Box, Button, Flex, Typography } from '@strapi/design-system';

const MobilePreviewButtons = () => {
  let context;
  try {
    context = useContentManagerContext();
  } catch (e) {
    return null;
  }

  const { model, collectionType } = context || {};
  const formValues = context?.form?.values || context?.document;

  if (model !== 'api::article.article') {
    return null;
  }

  const articleSlug = formValues?.slug || formValues?.documentId;
  const isDraft = formValues?.publishedAt === null;

  if (!articleSlug) {
    return null;
  }

  const previewUrl = `https://cozy-thermometer-spot.lovable.app/article/${articleSlug}?preview=true&mobile=true`;

  const handlePreview = () => {
    window.open(previewUrl, '_blank', 'width=375,height=812');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(previewUrl);
    alert('Preview URL copied!');
  };

  return (
    <Box padding={4} background="neutral100" borderRadius="4px">
      <Flex direction="column" gap={3}>
        <Button onClick={handlePreview} variant="secondary" fullWidth>
          Preview on Mobile
        </Button>
        <Button onClick={handleCopyUrl} variant="tertiary" fullWidth>
          Copy Preview URL
        </Button>
      </Flex>
    </Box>
  );
};

export default MobilePreviewButtons;
