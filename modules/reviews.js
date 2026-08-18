/**
 * Step 7: Review Module
 * Finder + image generation + sender
 */

const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Find businesses with low review counts
function findReviewProspects(niche, area, radiusMiles = 10) {
  console.log(`[Reviews] Finding review prospects in ${niche} near ${area}`);
  
  // Get average reviews for category
  const avgResult = db.prepare(`
    SELECT AVG(review_count) as avg_reviews
    FROM businesses
    WHERE niche = ? AND area = ? AND review_count > 0
  `).get(niche, area);
  
  const avgReviews = avgResult?.avg_reviews || 10;
  const threshold = avgReviews * 0.5; // Flag if less than 50% of average
  
  // Find businesses significantly below average
  const prospects = db.prepare(`
    SELECT * FROM businesses
    WHERE niche = ? 
    AND area = ?
    AND review_count < ?
    AND status = 'converted'
    AND id NOT IN (SELECT business_id FROM reviews)
    ORDER BY review_count ASC
  `).all(niche, area, threshold);
  
  console.log(`[Reviews] Found ${prospects.length} prospects below average (${Math.round(avgReviews)} avg)`);
  return prospects;
}

// Generate base image for business
async function generateBaseImage(businessId, imageUrl) {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  
  console.log(`[Reviews] Generating base image for ${business.name}`);
  
  // Generate professional card with blank area for customer name
  const response = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `Professional thank you card for ${business.name}, a ${business.niche} company. Include:
      - Clean, modern design
      - Business name prominently displayed
      - "Thank you for your business!" message
      - Large blank white rectangular area in the center (for customer name overlay)
      - Company branding colors
      - Professional and warm tone`,
    size: '1024x1024',
    quality: 'high'
  });
  
  const imageUrl2 = response.data[0].url;
  const outputPath = path.join(__dirname, '..', 'data', 'review-images', `${businessId}-base.png`);
  
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  
  const imgResponse = await fetch(imageUrl2);
  const buffer = await imgResponse.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  
  // Store in business record
  db.prepare(`
    UPDATE businesses SET review_base_image = ? WHERE id = ?
  `).run(outputPath, businessId);
  
  console.log(`[Reviews] Base image saved: ${outputPath}`);
  return outputPath;
}

// Send review request to customer
async function sendReviewRequest(businessId, customerName, customerEmail) {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  
  const baseImage = db.prepare('SELECT review_base_image FROM businesses WHERE id = ?').get(businessId);
  
  let imagePath;
  
  if (baseImage?.review_base_image && fs.existsSync(baseImage.review_base_image)) {
    // Use cached base image with text overlay
    imagePath = baseImage.review_base_image;
    console.log(`[Reviews] Using cached image for ${customerName}`);
  } else {
    // Generate new base image first
    imagePath = await generateBaseImage(businessId, null);
  }
  
  // In production: composite customer name onto image
  // For now, use the base image
  
  // Generate review link (placeholder - integrate with Google Reviews API)
  const reviewLink = `https://g.page/r/CUSTOMER_REVIEW_LINK/review`;
  
  // Record customer
  db.prepare(`
    INSERT INTO reviews (business_id, customer_name, customer_email, image_sent)
    VALUES (?, ?, ?, 1)
  `).run(businessId, customerName, customerEmail);
  
  // Send email
  console.log(`[Reviews] Sending review request to ${customerEmail}`);
  console.log(`[Reviews] Image: ${imagePath}`);
  console.log(`[Reviews] Review link: ${reviewLink}`);
  
  // TODO: Integrate with email service
  const emailContent = {
    to: customerEmail,
    subject: `Thank you for choosing ${business.name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${customerName},</p>
        <p>Thank you for choosing ${business.name} for your recent ${business.niche} project!</p>
        <p>We'd love to hear about your experience. Would you mind taking a moment to leave us a review?</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${reviewLink}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Leave a Review</a>
        </p>
        <p>Your feedback helps us serve you better and helps other homeowners find quality ${business.niche} services.</p>
        <p>Thank you!</p>
        <p>${business.name}</p>
        <p>${business.phone}</p>
      </div>
    `
  };
  
  return { sent: true, customerName, customerEmail, reviewLink };
}

module.exports = { findReviewProspects, generateBaseImage, sendReviewRequest };
