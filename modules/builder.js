/**
 * Step 3: Template Builder
 * Renders static sites from templates + data.json
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function renderTemplate(templateHtml, data) {
  let html = templateHtml;
  
  // Simple mustache-like rendering
  // Replace {{KEY}} with data.KEY
  html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
  
  // Handle {{#ARRAY}}...{{/ARRAY}} blocks
  html = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, block) => {
    const items = data[key];
    if (!Array.isArray(items)) return '';
    
    return items.map(item => {
      return block.replace(/\{\{(\w+)\}\}/g, (m, k) => {
        return item[k] !== undefined ? item[k] : '';
      });
    }).join('');
  });
  
  return html;
}

function buildSite(businessId, templateName) {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  
  const templatePath = path.join(TEMPLATES_DIR, templateName, 'template.html');
  if (!fs.existsSync(templatePath)) throw new Error(`Template ${templateName} not found`);
  
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  
  // Map business data to template data
  const data = {
    BUSINESS_NAME: business.name,
    TAGLINE: generateTagline(business),
    PHONE: business.phone || '(555) 000-0000',
    ADDRESS: business.address || '',
    SERVICE_AREA: generateServiceArea(business),
    YEAR: new Date().getFullYear().toString(),
    CHECKOUT_URL: process.env.WHOP_CHECKOUT_URL || '#',
    
    // Services (customize per niche)
    SERVICES: getServicesForNiche(business.niche),
    
    // Solar-specific
    AVG_SAVINGS: '$1,200',
    PAYBACK_YEARS: '6-8',
    ROI_PERCENT: '20%+',
    FINANCE_OPTIONS: [
      { name: 'Cash Purchase', description: 'Own your system outright', rate: 'Best ROI' },
      { name: 'Solar Loan', description: 'Low monthly payments', rate: '3.99% APR' },
      { name: 'Lease', description: 'No upfront cost', rate: '$0 down' }
    ],
    
    // Gallery (placeholder)
    GALLERY: [
      { url: '/images/gallery-1.jpg', alt: 'Completed project 1' },
      { url: '/images/gallery-2.jpg', alt: 'Completed project 2' },
      { url: '/images/gallery-3.jpg', alt: 'Completed project 3' }
    ]
  };
  
  const rendered = renderTemplate(templateHtml, data);
  
  // Output to business-specific folder
  const slug = business.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outputPath = path.join(OUTPUT_DIR, slug);
  fs.mkdirSync(outputPath, { recursive: true });
  
  fs.writeFileSync(path.join(outputPath, 'index.html'), rendered);
  
  // Copy data.json for future edits
  fs.writeFileSync(path.join(outputPath, 'data.json'), JSON.stringify(data, null, 2));
  
  // Record in database
  db.prepare(`
    INSERT INTO sites (business_id, template, local_path)
    VALUES (?, ?, ?)
  `).run(businessId, templateName, outputPath);
  
  db.prepare(`
    UPDATE businesses SET status = 'built', updated_at = datetime('now')
    WHERE id = ?
  `).run(businessId);
  
  console.log(`[Builder] Built site for ${business.name} at ${outputPath}`);
  return outputPath;
}

function generateTagline(business) {
  const taglines = {
    solar: 'Power Your Home, Save the Planet',
    roofing: 'Quality Roofing You Can Trust',
    hvac: 'Comfort All Year Round',
    pools: 'Your Dream Pool Awaits',
    driveways: 'Beautiful Driveways That Last',
    extensions: 'Expand Your Living Space',
    landscaping: 'Transform Your Outdoor Space',
    windows: 'Energy Efficient Windows',
    flooring: 'Premium Flooring Solutions',
    'garage-doors': 'Reliable Garage Door Services',
    fencing: 'Quality Fencing Installed',
    'tree-surgery': 'Expert Tree Care'
  };
  return taglines[business.niche] || 'Quality Service You Can Trust';
}

function generateServiceArea(business) {
  // Extract city/area from address or use the area field
  return business.area || 'Local Area';
}

function getServicesForNiche(niche) {
  const services = {
    solar: [
      { name: 'Solar Panel Installation', description: 'Professional installation of high-efficiency solar panels', price: '$15,000' },
      { name: 'Battery Storage', description: 'Store excess energy for use at night or during outages', price: '$8,000' },
      { name: 'Solar Maintenance', description: 'Keep your system running at peak performance', price: '$199/year' },
      { name: 'Energy Audit', description: 'Comprehensive assessment of your energy usage', price: 'Free' }
    ],
    roofing: [
      { name: 'Roof Inspection', description: 'Thorough inspection of your roof condition', price: 'Free' },
      { name: 'Roof Repair', description: 'Fast, reliable repairs for leaks and damage', price: '$500' },
      { name: 'Roof Replacement', description: 'Complete tear-off and installation', price: '$8,000' },
      { name: 'Emergency Service', description: '24/7 emergency response for storm damage', price: 'Call for quote' }
    ],
    hvac: [
      { name: 'AC Installation', description: 'High-efficiency cooling systems', price: '$3,500' },
      { name: 'Heating Repair', description: 'Fast furnace and heat pump repairs', price: '$200' },
      { name: 'Maintenance Plan', description: 'Annual tune-ups and priority service', price: '$199/year' },
      { name: 'Emergency Service', description: '24/7 emergency HVAC repair', price: 'Call for quote' }
    ]
  };
  
  return services[niche] || [
    { name: 'Professional Service', description: 'Expert quality workmanship', price: 'Call for quote' },
    { name: 'Free Consultation', description: 'No-obligation assessment', price: 'Free' },
    { name: 'Emergency Service', description: '24/7 availability', price: 'Call for quote' }
  ];
}

module.exports = { buildSite, renderTemplate };
