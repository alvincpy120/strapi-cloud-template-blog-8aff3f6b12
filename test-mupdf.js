/**
 * Test script to verify mupdf PDF to image conversion works
 * Run with: node test-mupdf.js
 */

const fs = require('fs-extra');
const path = require('path');

async function main() {
  console.log('Testing mupdf...');
  
  const uploadDir = path.join(__dirname, 'public', 'uploads');
  
  // Find a PDF file
  const files = await fs.readdir(uploadDir);
  const pdfFile = files.find(f => f.endsWith('.pdf'));
  
  if (!pdfFile) {
    console.error('No PDF file found in', uploadDir);
    return;
  }
  
  const pdfPath = path.join(uploadDir, pdfFile);
  console.log('Found PDF:', pdfPath);
  
  // Import mupdf (ESM module - must use dynamic import)
  console.log('Importing mupdf...');
  const mupdf = await import('mupdf');
  
  console.log('mupdf imported:', Object.keys(mupdf));
  console.log('mupdf.Document:', typeof mupdf.Document);
  
  // Read PDF file
  console.log('Reading PDF file...');
  const pdfBuffer = await fs.readFile(pdfPath);
  console.log('PDF buffer size:', pdfBuffer.length);
  
  // Open document with mupdf
  console.log('Opening PDF document...');
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  
  console.log('PDF document opened, pages:', doc.countPages());
  
  // Get first page
  const page = doc.loadPage(0);
  
  // Get page bounds
  const bounds = page.getBounds();
  console.log('Page bounds:', bounds);
  
  // Render at 2x scale for better quality
  const scale = 2.0;
  const matrix = mupdf.Matrix.scale(scale, scale);
  
  // Convert page to pixmap (image)
  console.log('Converting to pixmap...');
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
  
  // Get PNG data
  console.log('Converting to PNG...');
  const pngBuffer = pixmap.asPNG();
  
  // Save to temp file
  const outputPath = path.join(uploadDir, 'temp', 'test_cover.png');
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, pngBuffer);
  
  console.log('Cover image saved:', outputPath);
  console.log('Cover image size:', pngBuffer.length, 'bytes');
  
  console.log('SUCCESS! mupdf is working correctly.');
}

main().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});

