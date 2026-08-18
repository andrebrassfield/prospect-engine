/**
 * Competitor Command Center
 * Tracks competitor facts with memory rules:
 * new, changed, confirmed, contradicted, old
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function insertFact({ company, product, category, claim, source, source_url, status = 'new', previous_id = null, decision_owner = null, suggested_response = null }) {
  const result = db.prepare(`
    INSERT INTO competitor_facts (company, product, category, claim, status, source, source_url, checked_at, previous_id, decision_owner, suggested_response)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
  `).run(company, product, category, claim, status, source, source_url, previous_id, decision_owner, suggested_response);
  return result.lastInsertRowid;
}

function getCurrentView(company, category) {
  let sql = 'SELECT * FROM competitor_facts WHERE 1=1';
  const params = [];
  if (company) {
    sql += ' AND company = ?';
    params.push(company);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY checked_at DESC';
  return db.prepare(sql).all(...params);
}

function getLatestByCompanyProduct(company, product, category) {
  return db.prepare(`
    SELECT * FROM competitor_facts
    WHERE company = ? AND (product = ? OR ? IS NULL) AND category = ?
    ORDER BY checked_at DESC
    LIMIT 1
  `).get(company, product, product, category);
}

function classifyChange(previous, current) {
  if (!previous) return 'new';
  if (previous.claim === current.claim) return 'confirmed';
  return 'changed';
}

async function researchCompetitor(company, sources, categories = ['pricing', 'product', 'positioning', 'integrations', 'limitations']) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a competitive intelligence analyst. Research changes for: ${company}.

Current view:
${JSON.stringify(getCurrentView(company), null, 2)}

Watch these categories: ${categories.join(', ')}.
Watch these sources: ${sources.join(', ')}

Rules:
- Return only material differences.
- Label each finding: new, changed, confirmed, contradicted, or old.
- For changed facts, include previous and current values.
- Ignore minor announcements unless they affect pricing, positioning, product, or investment decisions.
- If sources disagree, label as contradicted and keep both claims.
- Include: company, product, category, claim, source, source_url, decision_owner, suggested_response.

Return JSON:
{
  "findings": [
    {
      "company": "",
      "product": "",
      "category": "",
      "claim": "",
      "status": "new|changed|confirmed|contradicted|old",
      "previous": "",
      "source": "",
      "source_url": "",
      "decision_owner": "sales|marketing|product|investment",
      "suggested_response": ""
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('Could not parse competitor research response');
    }

    const parsed = JSON.parse(match[0]);
    const findings = parsed.findings || [];

    const saved = [];
    for (const finding of findings) {
      const previous = getLatestByCompanyProduct(finding.company, finding.product, finding.category);
      const status = classifyChange(previous, finding);

      const id = insertFact({
        company: finding.company,
        product: finding.product,
        category: finding.category,
        claim: finding.claim,
        status: finding.status === 'contradicted' ? 'contradicted' : status,
        source: finding.source,
        source_url: finding.source_url,
        previous_id: previous ? previous.id : null,
        decision_owner: finding.decision_owner,
        suggested_response: finding.suggested_response
      });

      saved.push({ id, ...finding, computed_status: status });
    }

    return { company, findings: saved };
  } catch (err) {
    console.error(`[Intel] Error researching ${company}: ${err.message}`);
    return { company, findings: [], error: err.message };
  }
}

function getBrief(limit = 20) {
  const material = db.prepare(`
    SELECT * FROM competitor_facts
    WHERE status IN ('new', 'changed', 'contradicted')
    ORDER BY checked_at DESC
    LIMIT ?
  `).all(limit);

  const history = db.prepare(`
    SELECT * FROM competitor_facts
    WHERE status = 'confirmed'
    ORDER BY checked_at DESC
    LIMIT 50
  `).all();

  return { material, history };
}

module.exports = { researchCompetitor, getCurrentView, getBrief, insertFact };
