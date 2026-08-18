/**
 * Step 2: Scoring & Filtering
 * Uses Gemini Flash to evaluate each business
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function evaluateSite(url) {
  if (!url) return { has_site: 0 };
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `Analyze this business website and return JSON with these fields:
{
  "works_on_phone": true/false,
  "last_touched": "estimate when last updated based on design/content",
  "hours_on_page": true/false,
  "phone_on_page": true/false,
  "address_on_page": true/false,
  "owner_run": true/false,
  "has_contact_form": true/false,
  "contact_form_fields": ["list", "of", "fields"],
  "worst_thing": "single worst issue in one line"
}

URL: ${url}

Return ONLY valid JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error(`[Scoring] Error evaluating ${url}: ${err.message}`);
  }
  
  return { has_site: 1, worst_thing: 'Could not evaluate site' };
}

function calculateScore(evaluation) {
  let score = 5; // Base score
  
  // Penalties
  if (!evaluation.has_site) score += 2; // No site = opportunity
  if (evaluation.works_on_phone) score -= 1;
  if (evaluation.hours_on_page) score -= 1;
  if (evaluation.phone_on_page) score -= 1;
  if (evaluation.address_on_page) score -= 1;
  if (evaluation.owner_run) score += 1;
  if (evaluation.has_contact_form) score -= 1; // They're already capturing leads
  
  // Boost for clear opportunities
  if (!evaluation.has_site && evaluation.owner_run) score += 2;
  if (evaluation.worst_thing?.includes('broken') || evaluation.worst_thing?.includes('mobile')) {
    score += 1;
  }
  
  return Math.max(1, Math.min(10, score));
}

function shouldFilter(evaluation, reviewCount, lastActivity) {
  // Drop modern platforms with decent sites
  if (evaluation.works_on_phone && evaluation.has_site && evaluation.hours_on_page) {
    return true;
  }
  
  // Drop chains
  if (!evaluation.owner_run) {
    return true;
  }
  
  // Drop inactive (no activity in last year)
  // This is approximate - real implementation would check review dates
  if (reviewCount > 50 && evaluation.works_on_phone) {
    return true; // Likely established, not a prospect
  }
  
  return false;
}

async function scoreBusinesses(limit = 50) {
  console.log(`\n=== Scoring up to ${limit} unscored businesses ===`);
  
  const businesses = db.prepare(`
    SELECT * FROM businesses WHERE status = 'unscored' LIMIT ?
  `).all(limit);

  let scored = 0;
  let filtered = 0;

  for (const biz of businesses) {
    console.log(`[Scoring] ${biz.name}...`);
    
    const evaluation = biz.website ? await evaluateSite(biz.website) : { has_site: 0 };
    const score = calculateScore({ ...evaluation, has_site: biz.website ? 1 : 0 });
    const isFiltered = shouldFilter(evaluation, biz.review_count, null);
    
    const worstThing = evaluation.worst_thing || 
      (biz.website ? 'Site could not be evaluated' : 'No website at all');
    
    db.prepare(`
      UPDATE businesses SET
        has_site = ?,
        site_works_on_phone = ?,
        hours_on_page = ?,
        phone_on_page = ?,
        address_on_page = ?,
        owner_run = ?,
        has_contact_form = ?,
        contact_form_fields = ?,
        score = ?,
        worst_thing = ?,
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      evaluation.has_site || (biz.website ? 1 : 0),
      evaluation.works_on_phone ? 1 : 0,
      evaluation.hours_on_page ? 1 : 0,
      evaluation.phone_on_page ? 1 : 0,
      evaluation.address_on_page ? 1 : 0,
      evaluation.owner_run !== false ? 1 : 0,
      evaluation.has_contact_form ? 1 : 0,
      JSON.stringify(evaluation.contact_form_fields || []),
      score,
      worstThing,
      isFiltered ? 'filtered' : 'scored',
      biz.id
    );
    
    scored++;
    if (isFiltered) filtered++;
    
    // Rate limit: 1 request per second
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`Scored ${scored} businesses, filtered ${filtered}`);
  return { scored, filtered };
}

module.exports = { scoreBusinesses, evaluateSite, calculateScore };
