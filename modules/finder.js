/**
 * Step 1: Business Finder
 * Two data sources: SOS registrations + Google Maps via Apify
 */

const { ApifyClient } = require('apify-client');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db');

const NICHES = [
  'solar', 'roofing', 'hvac', 'pools', 'driveways',
  'extensions', 'landscaping', 'windows', 'flooring',
  'garage doors', 'fencing', 'tree surgery'
];

async function fetchSOSRegistrations(niche, area) {
  // Arkansas SOS has a search interface, not a direct API
  // We'll scrape their entity search for new registrations
  // For now, return empty - will implement scraping
  console.log(`[SOS] Searching for ${niche} in ${area}...`);
  
  // TODO: Implement Arkansas SOS scraper
  // The SOS site at sos-corp-search.ark.org allows searching
  // We'd need to scrape recent filings in relevant categories
  
  return [];
}

async function fetchGoogleMaps(niche, area, apifyToken) {
  console.log(`[Google Maps] Searching for ${niche} in ${area}...`);
  
  const client = new ApifyClient({ token: apifyToken });
  
  const runInput = {
    location: area,
    textQuery: `${niche} services`,
    maxResultCount: 100,
    language: 'en',
    includeWebResults: false
  };

  try {
    const run = await client.actor('compass/crawler-google-places').call(runInput);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    return items.map(item => ({
      name: item.title,
      address: item.address,
      phone: item.phone,
      website: item.url,
      rating: item.totalScore,
      review_count: item.reviewsCount || 0,
      source: 'google',
      source_id: item.placeId || item.cid,
      latitude: item.location?.latitude,
      longitude: item.location?.longitude
    }));
  } catch (err) {
    console.error(`[Google Maps] Error: ${err.message}`);
    return [];
  }
}

async function findBusinesses(niche, area, apifyToken) {
  console.log(`\n=== Finding ${niche} businesses in ${area} ===`);
  
  const [sosResults, googleResults] = await Promise.all([
    fetchSOSRegistrations(niche, area),
    fetchGoogleMaps(niche, area, apifyToken)
  ]);

  const allResults = [...sosResults, ...googleResults];
  
  const insert = db.prepare(`
    INSERT OR IGNORE INTO businesses (name, niche, area, address, phone, website, rating, review_count, source, source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let added = 0;
  for (const biz of allResults) {
    const result = insert.run(
      biz.name, niche, area, biz.address, biz.phone,
      biz.website, biz.rating, biz.review_count, biz.source, biz.source_id
    );
    if (result.changes > 0) added++;
  }

  console.log(`Found ${allResults.length} total, ${added} new records`);
  return { total: allResults.length, added };
}

module.exports = { findBusinesses, NICHES };
