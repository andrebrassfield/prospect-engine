/**
 * Step 8: Express API
 * Wraps all functions with token auth
 */

const express = require('express');
const cors = require('cors');
const { findBusinesses, NICHES } = require('./modules/finder');
const { scoreBusinesses } = require('./modules/scorer');
const { buildSite } = require('./modules/builder');
const { fillForm, makePostcard } = require('./modules/outreach');
const { processQueue } = require('./modules/edit-agent');
const { findReviewProspects, sendReviewRequest } = require('./modules/reviews');
const paywallRouter = require('./modules/paywall');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/paywall', paywallRouter);

// Token auth middleware
const API_TOKEN = process.env.API_TOKEN || 'dev-token-change-me';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use(authMiddleware);

// === FIND ===
app.post('/find', async (req, res) => {
  try {
    const { niche, area } = req.body;
    if (!niche || !area) {
      return res.status(400).json({ error: 'niche and area required' });
    }
    
    const result = await findBusinesses(niche, area, process.env.APIFY_TOKEN);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === SCORE ===
app.post('/score', async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    const result = await scoreBusinesses(limit);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === BUILD ===
app.post('/build', async (req, res) => {
  try {
    const { threshold = 7 } = req.body;
    
    // Get businesses above threshold
    const businesses = db.prepare(`
      SELECT * FROM businesses 
      WHERE status = 'scored' AND score >= ?
      ORDER BY score DESC
    `).all(threshold);
    
    const results = [];
    for (const biz of businesses) {
      try {
        const path = buildSite(biz.id, biz.niche);
        results.push({ id: biz.id, name: biz.name, path, success: true });
      } catch (err) {
        results.push({ id: biz.id, name: biz.name, error: err.message, success: false });
      }
    }
    
    res.json({ success: true, built: results.filter(r => r.success).length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === OUTREACH ===
app.post('/outreach', async (req, res) => {
  try {
    const { businessIds, limit = 10 } = req.body;
    
    let businesses;
    if (businessIds?.length) {
      businesses = db.prepare(`
        SELECT * FROM businesses WHERE id IN (${businessIds.map(() => '?').join(',')})
      `).all(...businessIds);
    } else {
      businesses = db.prepare(`
        SELECT * FROM businesses 
        WHERE status = 'built' AND score >= 7
        LIMIT ?
      `).all(limit);
    }
    
    const results = [];
    for (const biz of businesses) {
      if (biz.has_contact_form) {
        const result = await fillForm(biz.id);
        results.push({ id: biz.id, name: biz.name, channel: 'form', ...result });
      } else {
        const result = await makePostcard(biz.id);
        results.push({ id: biz.id, name: biz.name, channel: 'postcard', ...result });
      }
    }
    
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === SEND (postcards) ===
app.post('/send', async (req, res) => {
  try {
    const pending = db.prepare(`
      SELECT * FROM outreach 
      WHERE channel = 'postcard' AND status = 'pending'
      LIMIT 20
    `).all();
    
    // TODO: Integrate with Lob or PostGrid API
    console.log(`[API] Would send ${pending.length} postcards`);
    
    res.json({ success: true, pending: pending.length, message: 'Postcard sending not yet implemented' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === PENDING ===
app.get('/pending', (req, res) => {
  const pending = {
    outreach: db.prepare(`
      SELECT o.*, b.name, b.niche, b.score
      FROM outreach o
      JOIN businesses b ON o.business_id = b.id
      WHERE o.status = 'pending'
      ORDER BY o.created_at DESC
    `).all(),
    
    sites: db.prepare(`
      SELECT s.*, b.name, b.niche, b.score
      FROM sites s
      JOIN businesses b ON s.business_id = b.id
      WHERE s.paid = 0 AND s.local_path IS NOT NULL
      ORDER BY s.created_at DESC
    `).all(),
    
    changes: db.prepare(`
      SELECT cc.*, b.name
      FROM client_changes cc
      JOIN businesses b ON cc.business_id = b.id
      WHERE cc.status = 'pending'
      ORDER BY cc.created_at DESC
    `).all()
  };
  
  res.json(pending);
});

// === APPROVE ===
app.post('/approve', (req, res) => {
  try {
    const { ids, type } = req.body; // type: 'outreach' or 'sites'
    
    if (type === 'outreach') {
      db.prepare(`
        UPDATE outreach SET status = 'approved' WHERE id IN (${ids.map(() => '?').join(',')})
      `).run(...ids);
    } else if (type === 'sites') {
      // Deploy sites
      const results = [];
      for (const id of ids) {
        try {
          const site = db.prepare('SELECT * FROM sites WHERE business_id = ?').get(id);
          if (site) {
            // Deploy logic here
            results.push({ id, success: true });
          }
        } catch (err) {
          results.push({ id, error: err.message, success: false });
        }
      }
      return res.json({ success: true, results });
    }
    
    res.json({ success: true, approved: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === STATUS ===
app.get('/status', (req, res) => {
  const status = {
    total_businesses: db.prepare('SELECT COUNT(*) as count FROM businesses').get().count,
    by_status: db.prepare(`
      SELECT status, COUNT(*) as count FROM businesses GROUP BY status
    `).all(),
    by_niche: db.prepare(`
      SELECT niche, COUNT(*) as count FROM businesses GROUP BY niche
    `).all(),
    sites_built: db.prepare('SELECT COUNT(*) as count FROM sites').get().count,
    sites_live: db.prepare('SELECT COUNT(*) as count FROM sites WHERE live = 1').get().count,
    outreach_sent: db.prepare("SELECT COUNT(*) as count FROM outreach WHERE status = 'sent'").get().count,
    reviews_sent: db.prepare('SELECT COUNT(*) as count FROM reviews').get().count,
    pending_changes: db.prepare("SELECT COUNT(*) as count FROM client_changes WHERE status = 'pending'").get().count
  };
  
  res.json(status);
});

// === REVIEWS ===
app.post('/reviews/find', (req, res) => {
  try {
    const { niche, area } = req.body;
    const prospects = findReviewProspects(niche, area);
    res.json({ success: true, prospects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/reviews/send', async (req, res) => {
  try {
    const { businessId, customerName, customerEmail } = req.body;
    const result = await sendReviewRequest(businessId, customerName, customerEmail);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[API] Prospect Engine running on port ${PORT}`);
  console.log(`[API] Niches: ${NICHES.join(', ')}`);
});

module.exports = app;
