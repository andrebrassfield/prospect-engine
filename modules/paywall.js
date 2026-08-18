/**
 * Step 5: Paywall & Checkout
 * Whop integration + webhook handling
 */

const express = require('express');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const router = express.Router();

// Whop webhook signature verification
function verifyWhopSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Deploy site to subdomain
function deploySite(businessId, subdomain) {
  const site = db.prepare('SELECT * FROM sites WHERE business_id = ?').get(businessId);
  if (!site) throw new Error('No site found');
  
  const deployPath = path.join(__dirname, '..', 'deploy', subdomain);
  fs.mkdirSync(deployPath, { recursive: true });
  
  // Copy site files
  execSync(`cp -r "${site.local_path}"/* "${deployPath}/"`);
  
  // Remove paywall bar from deployed version
  const indexPath = path.join(deployPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf-8');
    html = html.replace(/<div id="paywall"[\s\S]*?<\/div>/, '');
    html = html.replace(/<script>[\s\S]*?if \(window\.location[\s\S]*?<\/script>/, '');
    fs.writeFileSync(indexPath, html);
  }
  
  // Update database
  db.prepare(`
    UPDATE sites SET 
      deploy_url = ?,
      subdomain = ?,
      paid = 1,
      live = 1
    WHERE business_id = ?
  `).run(
    `https://${subdomain}.${process.env.BASE_DOMAIN}`,
    subdomain,
    businessId
  );
  
  db.prepare(`
    UPDATE businesses SET 
      status = 'converted',
      updated_at = datetime('now')
    WHERE id = ?
  `).run(businessId);
  
  return `https://${subdomain}.${process.env.BASE_DOMAIN}`;
}

// Whop webhook endpoint
router.post('/webhook/whop', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-whop-signature'];
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  
  // Verify signature in production
  if (process.env.NODE_ENV === 'production' && secret) {
    if (!verifyWhopSignature(req.body, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  
  const event = JSON.parse(req.body);
  
  console.log(`[Whop] Received event: ${event.type}`);
  
  switch (event.type) {
    case 'membership.was_created':
    case 'membership.was_updated':
      // Payment successful - activate site
      const membership = event.data;
      const email = membership.user?.email;
      
      if (email) {
        const business = db.prepare(`
          SELECT b.id FROM businesses b
          JOIN sites s ON b.id = s.business_id
          WHERE b.email = ? OR b.website LIKE '%' || ? || '%'
        `).get(email, email);
        
        if (business) {
          const subdomain = `client-${business.id}`;
          const url = deploySite(business.id, subdomain);
          
          // Send welcome email
          await sendWelcomeEmail(email, url, business.id);
          
          console.log(`[Whop] Activated site for business ${business.id}: ${url}`);
        }
      }
      break;
      
    case 'membership.was_canceled':
      // Handle cancellation
      console.log('[Whop] Membership cancelled');
      break;
  }
  
  res.json({ received: true });
});

async function sendWelcomeEmail(email, siteUrl, businessId) {
  // TODO: Integrate with email service (SendGrid, Resend, etc.)
  console.log(`[Email] Welcome email to ${email}: ${siteUrl}`);
  
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  
  const subject = `Your website is live!`;
  const body = `Hi ${business?.name || 'there'},

Your website is now live at ${siteUrl}

To request changes, simply reply to this email with:
- New prices or services
- Updated photos
- Service area changes
- Any other updates

We'll make the changes the same day.

Thanks for choosing Arkansas Automated!`;
  
  // Store for now, send via email service later
  console.log(`[Email] Subject: ${subject}`);
  console.log(`[Email] Body: ${body}`);
}

// Get pending payments for manual review
router.get('/pending', (req, res) => {
  const pending = db.prepare(`
    SELECT s.*, b.name, b.email, b.niche
    FROM sites s
    JOIN businesses b ON s.business_id = b.id
    WHERE s.paid = 0 AND s.local_path IS NOT NULL
    ORDER BY s.created_at DESC
  `).all();
  
  res.json(pending);
});

// Approve and deploy
router.post('/approve/:businessId', (req, res) => {
  try {
    const { businessId } = req.params;
    const subdomain = `client-${businessId}`;
    const url = deploySite(parseInt(businessId), subdomain);
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
