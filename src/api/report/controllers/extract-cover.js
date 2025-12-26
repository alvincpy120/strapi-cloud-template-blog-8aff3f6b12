'use strict';

const path = require('path');
const fs = require('fs-extra');

/**
 * Controller to manually trigger cover extraction for a report
 */
module.exports = {
  async extractCover(ctx) {
    const { documentId } = ctx.params;
    
    strapi.log.info(`[Extract Cover] Manual trigger for document: ${documentId}`);
    
    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }
    
    try {
      // Find the report with populated fields
      const report = await strapi.documents('api::report.report').findFirst({
        filters: { documentId: { $eq: documentId } },
        populate: ['report_file', 'cover'],
      });
      
      if (!report) {
        return ctx.notFound('Report not found');
      }
      
      strapi.log.info(`[Extract Cover] Found report: ${report.id}, report_file: ${report.report_file?.id}, cover: ${report.cover?.id}`);
      
      if (!report.report_file) {
        return ctx.badRequest('Report has no PDF file attached');
      }
      
      // If cover already exists, we'll replace it (user explicitly requested extraction)
      if (report.cover) {
        strapi.log.info(`[Extract Cover] Report already has cover (ID: ${report.cover.id}), will replace it`);
      }
      
      // Extract cover
      const coverFileId = await extractCoverFromPdf(report.id, report.report_file);
      
      if (!coverFileId) {
        return ctx.internalServerError('Failed to extract cover from PDF');
      }
      
      // Update the report with the cover
      const updated = await strapi.documents('api::report.report').update({
        documentId: documentId,
        data: { cover: coverFileId },
      });
      
      strapi.log.info(`[Extract Cover] Cover set successfully for report ${report.id}`);
      
      return ctx.send({
        success: true,
        message: 'Cover extracted successfully',
        coverId: coverFileId,
      });
    } catch (error) {
      strapi.log.error(`[Extract Cover] Error: ${error.message}`);
      strapi.log.error(error.stack);
      return ctx.internalServerError(error.message);
    }
  },
};

/**
 * Extract cover image from PDF using mupdf
 */
async function extractCoverFromPdf(reportId, reportFile) {
  strapi.log.info(`[Extract Cover] Processing PDF: ${reportFile.name}`);
  
  // Get the file path
  const uploadDir = strapi.dirs.static.public;
  const pdfPath = path.join(uploadDir, reportFile.url);
  
  // Check if file exists
  if (!await fs.pathExists(pdfPath)) {
    strapi.log.error(`[Extract Cover] PDF file not found at path: ${pdfPath}`);
    return null;
  }
  
  strapi.log.info(`[Extract Cover] PDF path: ${pdfPath}`);
  
  // Import mupdf (ESM module - must use dynamic import)
  const mupdf = await import('mupdf');
  
  strapi.log.info(`[Extract Cover] Converting PDF first page to image using mupdf...`);
  
  // Create temp directory
  const tempDir = path.join(uploadDir, 'uploads', 'temp');
  await fs.ensureDir(tempDir);
  
  // Generate output filename
  const baseName = path.basename(reportFile.name, '.pdf');
  const outputFileName = `${baseName}_cover_${Date.now()}.png`;
  const outputPath = path.join(tempDir, outputFileName);
  
  // Read PDF file
  const pdfBuffer = await fs.readFile(pdfPath);
  
  // Open document with mupdf
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  
  strapi.log.info(`[Extract Cover] PDF document opened, pages: ${doc.countPages()}`);
  
  // Get first page
  const page = doc.loadPage(0);
  
  // Get page bounds
  const bounds = page.getBounds();
  strapi.log.info(`[Extract Cover] Page bounds: ${bounds[2] - bounds[0]}x${bounds[3] - bounds[1]}`);
  
  // Render at 2x scale for better quality
  const scale = 2.0;
  const matrix = mupdf.Matrix.scale(scale, scale);
  
  // Convert page to pixmap (image)
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
  
  // Get PNG data
  const pngBuffer = pixmap.asPNG();
  
  // Save to temp file
  await fs.writeFile(outputPath, pngBuffer);
  
  strapi.log.info(`[Extract Cover] Cover image saved: ${outputPath}`);
  
  // Get file stats
  const imageStats = await fs.stat(outputPath);
  strapi.log.info(`[Extract Cover] Cover image size: ${imageStats.size} bytes`);
  
  // Upload to Strapi media library using the same format as bootstrap.js
  strapi.log.info(`[Extract Cover] Uploading cover to media library...`);
  
  const fileData = {
    filepath: outputPath,
    originalFileName: `${baseName}_cover.png`,
    size: imageStats.size,
    mimetype: 'image/png',
  };
  
  const uploadedFiles = await strapi.plugin('upload').service('upload').upload({
    files: fileData,
    data: {
      fileInfo: {
        alternativeText: `Cover page of ${baseName}`,
        caption: `Cover page of ${reportFile.name}`,
        name: `${baseName}_cover.png`,
      },
    },
  });
  
  // Clean up temp file
  await fs.remove(outputPath);
  strapi.log.info(`[Extract Cover] Temp file cleaned up`);
  
  if (!uploadedFiles || uploadedFiles.length === 0) {
    strapi.log.error(`[Extract Cover] Failed to upload cover image`);
    return null;
  }
  
  const uploadedCover = uploadedFiles[0];
  strapi.log.info(`[Extract Cover] Cover uploaded successfully: ID=${uploadedCover.id}`);
  
  return uploadedCover.id;
}

