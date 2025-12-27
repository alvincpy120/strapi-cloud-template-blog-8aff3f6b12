'use strict';

const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const http = require('http');

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
 * Download file from URL to buffer
 */
async function downloadFileToBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFileToBuffer(response.headers.location).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Check if URL is remote (http/https)
 */
function isRemoteUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

/**
 * Extract cover image from PDF using mupdf
 */
async function extractCoverFromPdf(reportId, reportFile) {
  strapi.log.info(`[Extract Cover] Processing PDF: ${reportFile.name}`);
  strapi.log.info(`[Extract Cover] File URL: ${reportFile.url}`);
  
  let pdfBuffer;
  
  // Check if file is remote (cloud storage) or local
  if (isRemoteUrl(reportFile.url)) {
    strapi.log.info(`[Extract Cover] File is on cloud storage, downloading...`);
    try {
      pdfBuffer = await downloadFileToBuffer(reportFile.url);
      strapi.log.info(`[Extract Cover] Downloaded ${pdfBuffer.length} bytes`);
    } catch (downloadError) {
      strapi.log.error(`[Extract Cover] Failed to download PDF: ${downloadError.message}`);
      return null;
    }
  } else {
    // Local file
    const uploadDir = strapi.dirs.static.public;
    const pdfPath = path.join(uploadDir, reportFile.url);
    
    if (!await fs.pathExists(pdfPath)) {
      strapi.log.error(`[Extract Cover] PDF file not found at path: ${pdfPath}`);
      return null;
    }
    
    strapi.log.info(`[Extract Cover] PDF path: ${pdfPath}`);
    pdfBuffer = await fs.readFile(pdfPath);
  }
  
  // Import mupdf (ESM module - must use dynamic import)
  const mupdf = await import('mupdf');
  
  strapi.log.info(`[Extract Cover] Converting PDF first page to image using mupdf...`);
  
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
  
  strapi.log.info(`[Extract Cover] Generated PNG buffer: ${pngBuffer.length} bytes`);
  
  // Create temp directory - use system temp on cloud, or uploads/temp locally
  const tempDir = process.env.TMPDIR || process.env.TMP || '/tmp';
  const baseName = path.basename(reportFile.name, '.pdf');
  const outputFileName = `${baseName}_cover_${Date.now()}.png`;
  const outputPath = path.join(tempDir, outputFileName);
  
  // Save to temp file
  await fs.writeFile(outputPath, pngBuffer);
  
  strapi.log.info(`[Extract Cover] Cover image saved: ${outputPath}`);
  
  // Get file stats
  const imageStats = await fs.stat(outputPath);
  strapi.log.info(`[Extract Cover] Cover image size: ${imageStats.size} bytes`);
  
  // Upload to Strapi media library
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
