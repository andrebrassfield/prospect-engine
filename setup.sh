#!/bin/bash
# Prospect Engine — Setup Script
# Run this on your Mac when you get back

set -e

echo "=== Prospect Engine Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org/"
  exit 1
fi

echo "✓ Node.js $(node --version) found"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Install Playwright browsers
echo ""
echo "Installing Playwright browsers..."
npx playwright install chromium

# Create .env file
echo ""
echo "Setting up environment variables..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env file"
  echo ""
  echo "⚠️  You need to edit .env with your API keys"
  echo "   Open .env and fill in:"
  echo "   - API_TOKEN"
  echo "   - APIFY_TOKEN"
  echo "   - GEMINI_API_KEY"
  echo "   - OPENAI_API_KEY"
  echo "   - WHOP_API_KEY"
  echo "   - WHOP_WEBHOOK_SECRET"
  echo "   - WHOP_CHECKOUT_URL"
  echo "   - BASE_DOMAIN"
  echo "   - SITE_BASE_URL"
else
  echo "✓ .env already exists"
fi

# Initialize database
echo ""
echo "Initializing database..."
node -e "require('./db')"
echo "✓ Database ready"

# Test API server
echo ""
echo "Starting API server..."
echo "Server will run on http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Edit .env with your API keys"
echo "2. Run: npm start"
echo "3. Test with: curl http://localhost:3000/status"
