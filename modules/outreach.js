/**
 * Step 4: Outreach Module
 * Two channels: Contact form filling + Postcard generation
 */

const { chromium } = require('playwright');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Rate limiting
const DAILY_LIMIT = 10;
const MIN_GAP_MS = 5 * 60 * 1000; // 5 minutes
let lastSendTime = 0;

async function fillForm(businessId) {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  if (!business.has_contact_form) throw new Error('Business has no contact form');
  if (!business.worst_thing) throw new Error('No worst_thing set for outreach message');
  
  // Check rate limit
  const todayCount = db.prepare(`
    SELECT COUNT(*) as count FROM outreach 
    WHERE channel = 'form' AND date(created_at) = date('now')
  `).get().count;
  
  if (todayCount >= DAILY_LIMIT) {
    console.log(`[Outreach] Daily limit reached (${DAILY_LIMIT})`);
    return { sent: false, reason: 'daily_limit' };
  }
  
  // Wait for minimum gap
  const timeSinceLastSend = Date.now() - lastSendTime;
  if (timeSinceLastSend < MIN_GAP_MS) {
    const waitTime = MIN_GAP_MS - timeSinceLastSend;
    console.log(`[Outreach] Waiting ${Math.round(waitTime/1000)}s for rate limit...`);
    await new Promise(r => setTimeout(r, waitTime));
  }
  
  const message = `Hi, I'm Andre from Arkansas Automated. I was looking at your website and noticed ${business.worst_thing}. We build professional websites for businesses like yours and I've already built a preview for ${business.name}: [SITE_URL]. Would you like to see it live?`;
  
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(business.website, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Find contact form
    const form = await page.$('form');
    if (!form) {
      await browser.close();
      throw new Error('No form found on page');
    }
    
    // Find and fill form fields
    const nameInput = await form.$('input[name*="name"], input[placeholder*="name" i]');
    const emailInput = await form.$('input[type="email"], input[name*="email"]');
    const phoneInput = await form.$('input[type="tel"], input[name*="phone"]');
    const messageInput = await form.$('textarea, input[name*="message"], input[name*="comment"]');
    
    if (nameInput) await nameInput.fill('Andre');
    if (emailInput) await emailInput.fill('andre@arkansasautomated.com');
    if (phoneInput) await phoneInput.fill('(479) 555-0100');
    if (messageInput) await messageInput.fill(message);
    
    // Submit form
    const submitButton = await form.$('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      await submitButton.click();
      await page.waitForTimeout(3000);
    }
    
    await browser.close();
    
    // Record outreach
    db.prepare(`
      INSERT INTO outreach (business_id, channel, content, status)
      VALUES (?, 'form', ?, 'sent')
    `).run(businessId, message);
    
    lastSendTime = Date.now();
    
    console.log(`[Outreach] Form submitted for ${business.name}`);
    return { sent: true, message };
    
  } catch (err) {
    console.error(`[Outreach] Form fill failed for ${business.name}: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

async function makePostcard(businessId) {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  
  const sitePath = db.prepare('SELECT local_path FROM sites WHERE business_id = ?').get(businessId);
  if (!sitePath) throw new Error('No site built for this business');
  
  try {
    // Screenshot the built site
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto(`file://${sitePath.local_path}/index.html`);
    await page.waitForTimeout(2000);
    
    const screenshotPath = path.join(sitePath.local_path, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await browser.close();
    
    // Generate postcard front with GPT Image 2
    const imageResponse = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: `Professional business postcard front for ${business.name}. Include:
        - The business name prominently displayed
        - Clean, modern design
        - Leave a blank white square in the bottom-right corner (will be filled with QR code)
        - Include a subtle "Your website is ready!" message
        - Professional colors appropriate for ${business.niche} industry`,
      size: '1024x1024',
      quality: 'high'
    });
    
    // Download and save image
    const imageUrl = imageResponse.data[0].url;
    const postcardPath = path.join(sitePath.local_path, 'postcard.png');
    
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(postcardPath, Buffer.from(buffer));
    
    // Generate QR code pointing to their site
    const siteUrl = `${process.env.SITE_BASE_URL}/${business.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(siteUrl + '?ref=postcard')}`;
    
    // Download QR code
    const qrResponse = await fetch(qrUrl);
    const qrBuffer = await qrResponse.arrayBuffer();
    const qrPath = path.join(sitePath.local_path, 'qr.png');
    fs.writeFileSync(qrPath, Buffer.from(qrBuffer));
    
    // Composite QR onto postcard (simple overlay)
    // For production, use sharp or canvas for proper compositing
    console.log(`[Outreach] Postcard generated for ${business.name}`);
    console.log(`[Outreach] Postcard: ${postcardPath}`);
    console.log(`[Outreach] QR: ${qrPath}`);
    console.log(`[Outreach] Site URL: ${siteUrl}`);
    
    // Record outreach
    db.prepare(`
      INSERT INTO outreach (business_id, channel, content, postcard_path, status)
      VALUES (?, 'postcard', ?, ?, 'pending')
    `).run(businessId, `Postcard for ${business.name}`, postcardPath);
    
    return { generated: true, postcardPath, qrPath, siteUrl };
    
  } catch (err) {
    console.error(`[Outreach] Postcard generation failed for ${business.name}: ${err.message}`);
    return { generated: false, error: err.message };
  }
}

module.exports = { fillForm, makePostcard };
