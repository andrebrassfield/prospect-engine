/**
 * Prospect Engine - Main Entry Point
 * Automated sales machine for web services
 */

require('dotenv').config();

const { findBusinesses, NICHES } = require('./modules/finder');
const { scoreBusinesses } = require('./modules/scorer');
const { buildSite } = require('./modules/builder');
const { fillForm, makePostcard } = require('./modules/outreach');
const { processQueue } = require('./modules/edit-agent');
const { findReviewProspects, sendReviewRequest } = require('./modules/reviews');
const db = require('./db');

// Daily operations
async function runDaily() {
  console.log('\n=== DAILY RUN ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  // 1. Check for new registrations and score them
  console.log('\n--- Finding new businesses ---');
  for (const niche of NICHES.slice(0, 3)) { // Limit to 3 niches per day
    await findBusinesses(niche, 'Arkansas', process.env.APIFY_TOKEN);
  }
  
  // 2. Score unscored businesses
  console.log('\n--- Scoring businesses ---');
  await scoreBusinesses(50);
  
  // 3. Build sites for high-score businesses
  console.log('\n--- Building sites ---');
  const highScore = db.prepare(`
    SELECT * FROM businesses 
    WHERE status = 'scored' AND score >= 7
    ORDER BY score DESC
    LIMIT 5
  `).all();
  
  for (const biz of highScore) {
    try {
      await buildSite(biz.id, biz.niche);
    } catch (err) {
      console.error(`Failed to build for ${biz.name}: ${err.message}`);
    }
  }
  
  // 4. Process edit agent queue
  console.log('\n--- Processing edit queue ---');
  await processQueue();
  
  // 5. Get status
  const status = {
    businesses: db.prepare('SELECT COUNT(*) as count FROM businesses').get().count,
    scored: db.prepare("SELECT COUNT(*) as count FROM businesses WHERE status = 'scored'").get().count,
    built: db.prepare("SELECT COUNT(*) as count FROM businesses WHERE status = 'built'").get().count,
    converted: db.prepare("SELECT COUNT(*) as count FROM businesses WHERE status = 'converted'").get().count
  };
  
  console.log('\n--- Status ---');
  console.log(`Total businesses: ${status.businesses}`);
  console.log(`Scored: ${status.scored}`);
  console.log(`Built: ${status.built}`);
  console.log(`Converted: ${status.converted}`);
  
  return status;
}

// Weekly operations
async function runWeekly() {
  console.log('\n=== WEEKLY RUN ===');
  
  // Find review prospects
  for (const niche of NICHES.slice(0, 3)) {
    const prospects = findReviewProspects(niche, 'Arkansas');
    console.log(`${niche}: ${prospects.length} review prospects`);
  }
  
  return { completed: true };
}

// Run based on command line arg
const command = process.argv[2];

async function main() {
  try {
    switch (command) {
      case 'daily':
        await runDaily();
        break;
      case 'weekly':
        await runWeekly();
        break;
      case 'api':
        require('./api');
        break;
      default:
        console.log('Usage: node index.js [daily|weekly|api]');
        console.log('  daily  - Run daily operations');
        console.log('  weekly - Run weekly operations');
        console.log('  api    - Start API server');
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
