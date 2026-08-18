/**
 * Step 6: Edit Agent — cheap version
 * Uses Gemini 2.5 Flash instead of Anthropic
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildSite } = require('./builder');
const db = require('../db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// In-memory email queue
let emailQueue = [];

async function processEmail(fromEmail, subject, body, attachments = []) {
  console.log(`[EditAgent] Processing email from ${fromEmail}`);

  const business = db.prepare(`
    SELECT * FROM businesses WHERE email = ? OR website LIKE '%' || ? || '%'
  `).get(fromEmail, fromEmail);

  if (!business) {
    console.log(`[EditAgent] No matching client for ${fromEmail}`);
    return { processed: false, reason: 'no_match' };
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a lightweight ops agent for a small business website. 
Read the client email and decide what changes it implies.

Email from: ${fromEmail}
Subject: ${subject}
Body: ${body}

Allowed fields:
- name
- tagline
- phone
- address
- services
- gallery
- service_area

Rules:
- If ambiguous or implies pricing changes, set requires_clarification=true and ask ONE question.
- If it requests a photo attachment, mark needs_photo=true and don't claim image paths.

Return ONLY JSON:
{
  "changes": [
    {"field": "field_name", "action": "update|add|remove", "value": "new value or item"}
  ],
  "requires_clarification": true/false,
  "clarification_question": "string",
  "needs_photo": true/false,
  "photo_note": "where to put it if present"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('Could not parse model response');
    }

    const parsed = JSON.parse(match[0]);

    db.prepare(`
      INSERT INTO client_changes (business_id, email_from, request_text, fields_changed, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      business.id,
      fromEmail,
      body,
      JSON.stringify(parsed.changes),
      parsed.requires_clarification ? 'needs_clarification' : 'pending'
    );

    if (parsed.requires_clarification) {
      console.log(`[EditAgent] Needs clarification: ${parsed.clarification_question}`);
      return { processed: true, action: 'clarification', question: parsed.clarification_question };
    }

    const site = db.prepare('SELECT local_path FROM sites WHERE business_id = ?').get(business.id);
    if (!site) throw new Error('No site found for this business');

    const dataPath = require('path').join(site.local_path, 'data.json');
    const data = JSON.parse(require('fs').readFileSync(dataPath, 'utf-8'));

    for (const change of parsed.changes) {
      if (change.action === 'update') {
        data[change.field.toUpperCase()] = change.value;
      } else if (change.action === 'add' && Array.isArray(data[change.field.toUpperCase()])) {
        data[change.field.toUpperCase()].push(change.value);
      } else if (change.action === 'remove' && Array.isArray(data[change.field.toUpperCase()])) {
        data[change.field.toUpperCase()] = data[change.field.toUpperCase()].filter(
          item => item !== change.value
        );
      }
    }

    if (parsed.needs_photo && attachments.length > 0) {
      const galleryDir = require('path').join(site.local_path, 'images');
      require('fs').mkdirSync(galleryDir, { recursive: true });
      const saved = require('path').join(galleryDir, `client-upload-${Date.now()}.jpg`);
      require('fs').writeFileSync(saved, Buffer.from(attachments[0]));
      data['GALLERY'] = data['GALLERY'] || [];
      data['GALLERY'].push({ url: `/images/${require('path').basename(saved)}`, alt: 'Client upload' });
    }

    require('fs').writeFileSync(dataPath, JSON.stringify(data, null, 2));
    buildSite(business.id, business.niche);

    db.prepare(`
      UPDATE client_changes SET status = 'applied' WHERE business_id = ? AND status = 'pending'
    `).run(business.id);

    console.log(`[EditAgent] Applied ${parsed.changes.length} changes for ${business.name}`);
    return { processed: true, action: 'applied', changes: parsed.changes };
  } catch (err) {
    console.error(`[EditAgent] Error processing email: ${err.message}`);
    return { processed: false, error: err.message };
  }
}

function queueEmail(fromEmail, subject, body, attachments) {
  emailQueue.push({ fromEmail, subject, body, attachments, timestamp: Date.now() });
  console.log(`[EditAgent] Queued email from ${fromEmail}`);
}

async function processQueue() {
  const results = [];
  while (emailQueue.length > 0) {
    const email = emailQueue.shift();
    const result = await processEmail(email.fromEmail, email.subject, email.body, email.attachments);
    results.push({ ...email, result });
  }
  return results;
}

module.exports = { processEmail, queueEmail, processQueue };
