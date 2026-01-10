'use strict';

/**
 * Middleware to filter reports relation dropdown to only show reports with report_file
 */

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    await next();
    
    // Only process successful responses for reports relation
    if (ctx.status === 200 && ctx.url.includes('/relations/api::article.article/reports')) {
      const response = ctx.body;
      
      if (response && response.results) {
        // Filter out reports without report_file
        const filteredResults = [];
        
        for (const report of response.results) {
          // Fetch the full report to check if it has report_file
          const fullReport = await strapi.db.query('api::report.report').findOne({
            where: { id: report.id },
            populate: ['report_file'],
          });
          
          if (fullReport && fullReport.report_file) {
            filteredResults.push(report);
          }
        }
        
        ctx.body = {
          ...response,
          results: filteredResults,
          pagination: {
            ...response.pagination,
            total: filteredResults.length,
          },
        };
      }
    }
  };
};
