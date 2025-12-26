/**
 * Test script to trigger cover extraction for a report
 * Run with: node test-cover-extraction.js
 */

const path = require('path');
const fs = require('fs-extra');

async function main() {
  // Initialize Strapi
  console.log('Initializing Strapi...');
  
  // Set environment to development
  process.env.NODE_ENV = 'development';
  
  const strapi = require('@strapi/strapi');
  const app = await strapi().load();
  
  console.log('Strapi loaded');
  
  // Get all reports with report_file
  const reports = await app.db.query('api::report.report').findMany({
    populate: ['report_file', 'cover'],
  });
  
  console.log(`Found ${reports.length} reports`);
  
  for (const report of reports) {
    console.log(`Report ${report.id}: report_file=${report.report_file?.id}, cover=${report.cover?.id}`);
    
    if (report.report_file && !report.cover) {
      console.log(`Triggering cover extraction for report ${report.id}...`);
      
      // Simulate afterUpdate by updating the title
      try {
        await app.entityService.update('api::report.report', report.id, {
          data: { title: report.title + ' ' },
        });
        console.log(`Updated report ${report.id}`);
      } catch (err) {
        console.error(`Error updating report ${report.id}:`, err.message);
      }
    }
  }
  
  // Wait for async operations
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('Done');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

