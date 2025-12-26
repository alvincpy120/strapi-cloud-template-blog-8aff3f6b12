'use strict';

const path = require('path');
const fs = require('fs-extra');

/**
 * Report lifecycle hooks for:
 * 1. Automatic cover extraction from PDF report file using mupdf
 */

// Track operations to prevent infinite loops
const activeOperations = new Map();

function isOperationActive(key) {
  const timestamp = activeOperations.get(key);
  if (!timestamp) return false;
  if (Date.now() - timestamp > 120000) { // 2 minute timeout for PDF processing
    activeOperations.delete(key);
    return false;
  }
  return true;
}

function startOperation(key) {
  activeOperations.set(key, Date.now());
}

function endOperation(key) {
  activeOperations.delete(key);
}

/**
 * Extract cover image from PDF using mupdf
 */
async function extractAndSetCover(reportId, reportFileId) {
  const operationKey = `extract-cover-${reportId}`;
  
  if (isOperationActive(operationKey)) {
    strapi.log.info(`[Report] Cover extraction already in progress for report ${reportId}`);
    return;
  }
  
  startOperation(operationKey);
  
  try {
    strapi.log.info(`[Report] Starting cover extraction for report ${reportId}`);
    
    // Get the uploaded file info from media library
    const file = await strapi.db.query('plugin::upload.file').findOne({
      where: { id: reportFileId },
    });
    
    if (!file) {
      strapi.log.warn(`[Report] Report file not found: ${reportFileId}`);
      return;
    }
    
    // Check if it's a PDF
    if (file.mime !== 'application/pdf') {
      strapi.log.info(`[Report] File is not a PDF (${file.mime}), skipping cover extraction`);
      return;
    }
    
    strapi.log.info(`[Report] Processing PDF: ${file.name}`);
    
    // Get the file path
    const uploadDir = strapi.dirs.static.public;
    const pdfPath = path.join(uploadDir, file.url);
    
    // Check if file exists
    if (!await fs.pathExists(pdfPath)) {
      strapi.log.error(`[Report] PDF file not found at path: ${pdfPath}`);
      return;
    }
    
    strapi.log.info(`[Report] PDF path: ${pdfPath}`);
    
    // Use mupdf to extract cover (dynamic import for ESM module)
    const mupdf = await import('mupdf');
    
    strapi.log.info(`[Report] Loading PDF with mupdf...`);
    
    // Read the PDF file
    const pdfBuffer = await fs.readFile(pdfPath);
    
    // Open the document
    const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
    strapi.log.info(`[Report] PDF loaded, pages: ${doc.countPages()}`);
    
    // Get the first page
    const page = doc.loadPage(0);
    
    // Get page bounds
    const bounds = page.getBounds();
    const width = bounds[2] - bounds[0];
    const height = bounds[3] - bounds[1];
    
    strapi.log.info(`[Report] Page size: ${width}x${height}`);
    
    // Create a pixmap at 2x scale for good quality
    const scale = 2.0;
    const matrix = mupdf.Matrix.scale(scale, scale);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
    
    strapi.log.info(`[Report] Rendered to pixmap: ${pixmap.getWidth()}x${pixmap.getHeight()}`);
    
    // Convert to PNG
    const pngBuffer = pixmap.asPNG();
    
    // Create temp directory
    const tempDir = path.join(uploadDir, 'uploads', 'temp');
    await fs.ensureDir(tempDir);
    
    // Generate output filename
    const baseName = path.basename(file.name, '.pdf');
    const outputFileName = `${baseName}_cover_${Date.now()}.png`;
    const outputPath = path.join(tempDir, outputFileName);
    
    // Write to file
    await fs.writeFile(outputPath, pngBuffer);
    strapi.log.info(`[Report] Cover image saved: ${outputPath}`);
    
    // Get file stats
    const imageStats = await fs.stat(outputPath);
    
    // Upload to Strapi media library
    strapi.log.info(`[Report] Uploading cover to media library...`);
    
    // Create a proper file object for Strapi upload service
    const fsNative = require('fs');
    const filePath = outputPath;
    const fileName = `${baseName}_cover.png`;
    
    const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
      data: {
        fileInfo: {
          name: fileName,
          caption: `Cover page of ${file.name}`,
          alternativeText: `Cover page of ${baseName}`,
        },
      },
      files: {
        filepath: filePath,
        path: filePath,
        name: fileName,
        originalFilename: fileName,
        type: 'image/png',
        mimetype: 'image/png',
        size: imageStats.size,
        getStream: () => fsNative.createReadStream(filePath),
      },
    });
    
    if (!uploadedFiles || uploadedFiles.length === 0) {
      strapi.log.error(`[Report] Failed to upload cover image`);
      return;
    }
    
    const uploadedCover = uploadedFiles[0];
    strapi.log.info(`[Report] Cover uploaded successfully: ID=${uploadedCover.id}`);
    
    // Update the report with the cover image
    await strapi.db.query('api::report.report').update({
      where: { id: reportId },
      data: { cover: uploadedCover.id },
    });
    
    strapi.log.info(`[Report] Cover set for report ${reportId}`);
    
    // Clean up temp file
    await fs.remove(outputPath);
    strapi.log.info(`[Report] Temp file cleaned up`);
    
  } catch (error) {
    strapi.log.error(`[Report] Cover extraction error: ${error.message}`);
    strapi.log.error(error.stack);
  } finally {
    endOperation(operationKey);
  }
}

module.exports = {
  /**
   * After create: Extract cover from PDF if report_file is uploaded
   */
  async afterCreate(event) {
    const { result } = event;
    
    strapi.log.info('========================================');
    strapi.log.info('[Report Lifecycle] afterCreate TRIGGERED');
    strapi.log.info(`[Report Lifecycle] Report ID: ${result?.id}`);
    strapi.log.info('========================================');
    
    if (!result?.id) {
      return;
    }
    
    // Get the report with populated report_file
    const report = await strapi.db.query('api::report.report').findOne({
      where: { id: result.id },
      populate: ['report_file', 'cover'],
    });
    
    // Only extract cover if:
    // 1. report_file exists
    // 2. cover is not already set (or is null)
    if (report?.report_file?.id && !report?.cover?.id) {
      // Run cover extraction asynchronously to not block the response
      setImmediate(() => {
        extractAndSetCover(result.id, report.report_file.id);
      });
    }
  },

  /**
   * After update: Extract cover if report_file changed and no cover set
   */
  async afterUpdate(event) {
    const { result } = event;
    
    strapi.log.info('========================================');
    strapi.log.info('[Report Lifecycle] afterUpdate TRIGGERED');
    strapi.log.info(`[Report Lifecycle] Report ID: ${result?.id}`);
    strapi.log.info('========================================');
    
    if (!result?.id) {
      return;
    }
    
    // Get the report with populated report_file and cover
    const report = await strapi.db.query('api::report.report').findOne({
      where: { id: result.id },
      populate: ['report_file', 'cover'],
    });
    
    // Only extract cover if:
    // 1. report_file exists
    // 2. cover is not already set
    if (report?.report_file?.id && !report?.cover?.id) {
      // Run cover extraction asynchronously
      setImmediate(() => {
        extractAndSetCover(result.id, report.report_file.id);
      });
    }
  },
};
