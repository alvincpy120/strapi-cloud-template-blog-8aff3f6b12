'use strict';

/**
 * Controller for generating APA references from URLs using CrossRef API and Zotero Translation Server
 */

const ZOTERO_SERVER = process.env.ZOTERO_TRANSLATION_SERVER || 'http://localhost:1969';

/**
 * Extract DOI from URL - handles various publisher URL formats
 */
function extractDOI(url) {
  // Direct DOI patterns
  const doiPatterns = [
    /doi\.org\/(.+?)(?:\?|$)/i,
    /doi\.org\/(.+)/i,
    /\/doi\/(?:abs\/|full\/)?(.+?)(?:\?|$)/i,
    /\/(10\.\d{4,}\/[^\s\/?#]+)/i,
  ];
  
  for (const pattern of doiPatterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1].replace(/\/$/, ''); // Remove trailing slash
    }
  }
  
  // Publisher-specific patterns where DOI prefix needs to be added
  const publisherPatterns = [
    // Nature: https://www.nature.com/articles/s41586-024-08375-z -> 10.1038/s41586-024-08375-z
    { pattern: /nature\.com\/articles\/(s\d+[^\/\?\s]+)/i, prefix: '10.1038/' },
    // Science: https://www.science.org/doi/10.1126/science.ado1006 (already handled above)
    // PNAS: https://www.pnas.org/doi/10.1073/pnas.xxx
    { pattern: /pnas\.org\/content\/(\d+\/\d+\/[^\/\?\s]+)/i, prefix: '10.1073/pnas.' },
    // Cell: https://www.cell.com/cell/fulltext/S0092-8674(xx)xxxxx-x
    { pattern: /cell\.com\/[^\/]+\/fulltext\/(S[\d\-X\(\)]+)/i, prefix: '10.1016/j.cell.' },
    // Springer: https://link.springer.com/article/10.1007/xxx
    { pattern: /springer\.com\/article\/(10\.\d+\/[^\/\?\s]+)/i, prefix: '' },
    // Wiley: https://onlinelibrary.wiley.com/doi/xxx
    { pattern: /wiley\.com\/doi\/(?:abs\/|full\/)?(10\.\d+\/[^\/\?\s]+)/i, prefix: '' },
    // Taylor & Francis: https://www.tandfonline.com/doi/xxx
    { pattern: /tandfonline\.com\/doi\/(?:abs\/|full\/)?(10\.\d+\/[^\/\?\s]+)/i, prefix: '' },
    // SAGE: https://journals.sagepub.com/doi/xxx
    { pattern: /sagepub\.com\/doi\/(?:abs\/|full\/)?(10\.\d+\/[^\/\?\s]+)/i, prefix: '' },
    // Oxford Academic: https://academic.oup.com/xxx/article/xxx
    { pattern: /academic\.oup\.com\/[^\/]+\/article\/(\d+\/\d+\/\d+)/i, prefix: '10.1093/' },
    // Elsevier/ScienceDirect: https://www.sciencedirect.com/science/article/pii/xxx
    { pattern: /sciencedirect\.com\/science\/article\/(?:abs\/)?pii\/(S\d+)/i, prefix: '10.1016/' },
  ];
  
  for (const { pattern, prefix } of publisherPatterns) {
    const match = url.match(pattern);
    if (match) {
      const doi = prefix + match[1];
      console.log(`Extracted DOI from publisher URL: ${doi}`);
      return doi;
    }
  }
  
  return null;
}

/**
 * Fetch DOI from webpage meta tags as fallback
 */
async function fetchDOIFromPage(url) {
  try {
    console.log(`Fetching page to extract DOI: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Strapi-APA-Generator/1.0)',
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch page: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Look for DOI in meta tags
    const doiPatterns = [
      /meta[^>]+name=["'](?:citation_doi|dc\.identifier|DC\.identifier|doi)["'][^>]+content=["']([^"']+)["']/i,
      /meta[^>]+content=["']([^"']+)["'][^>]+name=["'](?:citation_doi|dc\.identifier|DC\.identifier|doi)["']/i,
      /meta[^>]+property=["'](?:og:doi|citation_doi)["'][^>]+content=["']([^"']+)["']/i,
      /data-doi=["']([^"']+)["']/i,
      /"doi"\s*:\s*"(10\.[^"]+)"/i,
      /doi\.org\/(10\.\d+\/[^"'\s<>]+)/i,
    ];
    
    for (const pattern of doiPatterns) {
      const match = html.match(pattern);
      if (match) {
        let doi = match[1];
        // Clean up DOI
        doi = doi.replace(/^https?:\/\/doi\.org\//i, '');
        doi = doi.replace(/^doi:/i, '');
        console.log(`Found DOI in page: ${doi}`);
        return doi;
      }
    }
    
    console.log(`No DOI found in page meta tags`);
    return null;
  } catch (error) {
    console.error(`Error fetching page for DOI: ${error.message}`);
    return null;
  }
}

/**
 * Fetch metadata from CrossRef API using DOI
 */
async function fetchCrossRefMetadata(doi) {
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: {
        'User-Agent': 'Strapi-APA-Generator/1.0 (mailto:admin@example.com)',
      },
    });

    if (!response.ok) {
      console.log(`CrossRef returned ${response.status} for DOI: ${doi}`);
      return null;
    }

    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error(`Error fetching CrossRef metadata for ${doi}:`, error.message);
    return null;
  }
}

/**
 * Format CrossRef metadata as APA 7th edition citation with HTML formatting
 */
function formatCrossRefAsAPA(item, originalUrl) {
  const parts = [];
  
  // Authors: Last, F. I., Last, F. I., & Last, F. I.
  if (item.author && item.author.length > 0) {
    const authorList = item.author.map(a => {
      if (a.family && a.given) {
        // Get initials from given name
        const initials = a.given.split(/[\s-]+/)
          .map(n => n.charAt(0).toUpperCase() + '.')
          .join(' ');
        return `${a.family}, ${initials}`;
      }
      return a.family || a.given || a.name || '';
    }).filter(Boolean);
    
    if (authorList.length === 1) {
      parts.push(authorList[0]);
    } else if (authorList.length === 2) {
      parts.push(`${authorList[0]} &amp; ${authorList[1]}`);
    } else if (authorList.length > 2 && authorList.length <= 20) {
      parts.push(`${authorList.slice(0, -1).join(', ')}, &amp; ${authorList[authorList.length - 1]}`);
    } else if (authorList.length > 20) {
      // APA 7: For 21+ authors, list first 19, then ..., then last author
      parts.push(`${authorList.slice(0, 19).join(', ')}, ... ${authorList[authorList.length - 1]}`);
    }
  }
  
  // Year: (2025).
  let year = 'n.d.';
  if (item.published && item.published['date-parts'] && item.published['date-parts'][0]) {
    year = item.published['date-parts'][0][0];
  } else if (item['published-print'] && item['published-print']['date-parts']) {
    year = item['published-print']['date-parts'][0][0];
  } else if (item['published-online'] && item['published-online']['date-parts']) {
    year = item['published-online']['date-parts'][0][0];
  }
  parts.push(`(${year}).`);
  
  // Title: Sentence case, period at end (NOT italic for journal articles)
  if (item.title && item.title[0]) {
    parts.push(`${escapeHtml(item.title[0])}.`);
  }
  
  // Journal: <em>Journal Name</em>, <em>Volume</em>(Issue), pages.
  // In APA, journal name and volume are italic
  if (item['container-title'] && item['container-title'][0]) {
    let journalPart = `<em>${escapeHtml(item['container-title'][0])}</em>`;
    
    if (item.volume) {
      journalPart += `, <em>${item.volume}</em>`;
    }
    
    if (item.issue) {
      journalPart += `(${item.issue})`;
    }
    
    if (item.page) {
      journalPart += `, ${item.page}`;
    }
    
    journalPart += '.';
    parts.push(journalPart);
  }
  
  // DOI URL (preferred format) - make it a clickable link
  if (item.DOI) {
    const doiUrl = `https://doi.org/${item.DOI}`;
    parts.push(`<a href="${doiUrl}" target="_blank">${doiUrl}</a>`);
  } else if (item.URL) {
    parts.push(`<a href="${item.URL}" target="_blank">${item.URL}</a>`);
  } else if (originalUrl) {
    parts.push(`<a href="${originalUrl}" target="_blank">${originalUrl}</a>`);
  }
  
  return `<p>${parts.join(' ')}</p>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Fetch metadata from Zotero Translation Server and format as APA
 */
async function fetchZoteroMetadata(url) {
  try {
    const response = await fetch(`${ZOTERO_SERVER}/web`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: url,
    });

    if (!response.ok) {
      console.log(`Zotero server returned ${response.status} for ${url}`);
      return null;
    }

    const items = await response.json();
    
    if (!items || items.length === 0) {
      console.log(`No metadata found for ${url}`);
      return null;
    }

    const item = items[0];
    return formatZoteroAsAPA(item, url);
  } catch (error) {
    console.error(`Error fetching Zotero metadata for ${url}:`, error.message);
    return null;
  }
}

/**
 * Main function to get APA citation - tries multiple methods
 */
async function getAPACitation(url) {
  console.log(`\n=== Processing URL: ${url} ===`);
  
  // Step 1: Try to extract DOI from URL directly
  let doi = extractDOI(url);
  
  // Step 2: If no DOI found in URL, try fetching the page to find it
  if (!doi) {
    console.log(`No DOI in URL, fetching page to find DOI...`);
    doi = await fetchDOIFromPage(url);
  }
  
  // Step 3: If we have a DOI, use CrossRef
  if (doi) {
    console.log(`Using DOI: ${doi}, trying CrossRef...`);
    const crossRefData = await fetchCrossRefMetadata(doi);
    if (crossRefData) {
      console.log(`CrossRef returned data successfully`);
      return formatCrossRefAsAPA(crossRefData, url);
    } else {
      console.log(`CrossRef failed for DOI: ${doi}`);
    }
  }
  
  // Step 4: Fallback to Zotero Translation Server
  console.log(`Trying Zotero Translation Server for ${url}...`);
  const zoteroResult = await fetchZoteroMetadata(url);
  if (zoteroResult) {
    return zoteroResult;
  }
  
  console.log(`All methods failed for ${url}`);
  return null;
}

/**
 * Format Zotero item as APA 7th edition citation with HTML formatting
 */
function formatZoteroAsAPA(item, originalUrl) {
  const parts = [];
  
  // Authors: Last, F. I., Last, F. I., & Last, F. I.
  if (item.creators && item.creators.length > 0) {
    const authorList = item.creators
      .filter(c => c.creatorType === 'author')
      .map(c => {
        if (c.name) return escapeHtml(c.name);
        if (c.lastName && c.firstName) {
          // Get initials from first name
          const initials = c.firstName.split(/[\s-]+/)
            .map(n => n.charAt(0).toUpperCase() + '.')
            .join(' ');
          return `${escapeHtml(c.lastName)}, ${initials}`;
        }
        return escapeHtml(c.lastName || c.firstName || '');
      })
      .filter(Boolean);
    
    if (authorList.length === 1) {
      parts.push(authorList[0]);
    } else if (authorList.length === 2) {
      parts.push(`${authorList[0]} &amp; ${authorList[1]}`);
    } else if (authorList.length > 2 && authorList.length <= 20) {
      parts.push(`${authorList.slice(0, -1).join(', ')}, &amp; ${authorList[authorList.length - 1]}`);
    } else if (authorList.length > 20) {
      parts.push(`${authorList.slice(0, 19).join(', ')}, ... ${authorList[authorList.length - 1]}`);
    }
  }
  
  // Year: (2025).
  if (item.date) {
    const year = item.date.match(/\d{4}/)?.[0] || item.date;
    parts.push(`(${year}).`);
  } else {
    parts.push('(n.d.).');
  }
  
  // Title: period at end (NOT italic for journal articles)
  if (item.title) {
    parts.push(`${escapeHtml(item.title)}.`);
  }
  
  // Journal: <em>Journal Name</em>, <em>Volume</em>(Issue), pages.
  if (item.publicationTitle) {
    let journalPart = `<em>${escapeHtml(item.publicationTitle)}</em>`;
    
    if (item.volume) {
      journalPart += `, <em>${item.volume}</em>`;
    }
    if (item.issue) {
      journalPart += `(${item.issue})`;
    }
    if (item.pages) {
      journalPart += `, ${item.pages}`;
    }
    journalPart += '.';
    parts.push(journalPart);
  } else if (item.websiteTitle || item.siteName) {
    parts.push(`<em>${escapeHtml(item.websiteTitle || item.siteName)}</em>.`);
  }
  
  // DOI URL (preferred) or regular URL - make it a clickable link
  if (item.DOI) {
    const doiUrl = `https://doi.org/${item.DOI}`;
    parts.push(`<a href="${doiUrl}" target="_blank">${doiUrl}</a>`);
  } else if (item.url) {
    parts.push(`<a href="${item.url}" target="_blank">${item.url}</a>`);
  } else if (originalUrl) {
    parts.push(`<a href="${originalUrl}" target="_blank">${originalUrl}</a>`);
  }
  
  return `<p>${parts.join(' ')}</p>`;
}

module.exports = {
  async generateAPA(ctx) {
    const { documentId } = ctx.params;
    
    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }
    
    try {
      // Fetch the article with blocks populated
      // For dynamic zones, use '*' to populate all nested components
      const article = await strapi.documents('api::article.article').findOne({
        documentId,
        populate: {
          blocks: {
            populate: '*',
          },
        },
      });
      
      if (!article) {
        return ctx.notFound('Article not found');
      }
      
      // Find all reference blocks
      const blocks = article.blocks || [];
      let updatedCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        
        if (block.__component === 'shared.reference') {
          const urls = block.url || [];
          
          for (let j = 0; j < urls.length; j++) {
            const urlItem = urls[j];
            
            // Process if no APA yet, or if APA is just a placeholder "Retrieved from..."
            const needsProcessing = urlItem.link && 
              (!urlItem.apa || urlItem.apa.includes('Retrieved from'));
            
            if (needsProcessing) {
              console.log(`Processing URL: ${urlItem.link}`);
              
              const apaText = await getAPACitation(urlItem.link);
              
              if (apaText) {
                urls[j].apa = apaText;
                updatedCount++;
                console.log(`Generated APA: ${apaText}`);
              } else {
                errorCount++;
                // Set a placeholder if neither CrossRef nor Zotero could process
                urls[j].apa = `<p>Retrieved from <a href="${urlItem.link}" target="_blank">${urlItem.link}</a></p>`;
                console.log(`Could not generate APA for: ${urlItem.link}`);
              }
            }
          }
          
          blocks[i].url = urls;
        }
      }
      
      if (updatedCount > 0 || errorCount > 0) {
        // Update the article with new APA citations
        await strapi.documents('api::article.article').update({
          documentId,
          data: {
            blocks,
          },
        });
      }
      
      return ctx.send({
        success: true,
        message: `Generated ${updatedCount} APA citations. ${errorCount} URLs could not be processed.`,
        updatedCount,
        errorCount,
      });
      
    } catch (error) {
      console.error('Generate APA error:', error);
      return ctx.internalServerError(error.message);
    }
  },
};

