# Prospect Engine — Activation Checklist

Everything is built. These are the exact commands to run.

---

## Step 1: Create accounts (15 min)

### Apify (for Google Maps scraping)
1. Go to https://apify.com → Sign up
2. Go to Settings → Integrations → Copy API token
3. You get $5 free credit/month — enough for hundreds of scrapes

### Gemini API (for scoring)
1. Go to https://aistudio.google.com → Get API key
2. Free tier: 15 RPM, 1M tokens/day — more than enough

### OpenAI (for postcard images)
1. Go to https://platform.openai.com → API Keys → Create
2. Add $10 credit for GPT Image 2 generation

### Anthropic (for edit agent)
1. Go to https://console.anthropic.com → API Keys → Create
2. Claude Haiku is cheap — ~$0.01 per email processed

### Whop (for payments)
1. Go to https://whop.com → Create account
2. Create product: "Professional Website — $200/month"
3. Copy checkout URL and webhook secret

### Domain (for client sites)
Option A: Use a domain you own
Option B: Buy `pro-sites.com` or similar on Namecheap (~$10/year)

---

## Step 2: Deploy to Railway (5 min)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to project
cd ~/workspace/prospect-engine

# Initialize Railway project
railway init

# Add environment variables (paste these with your actual values)
railway variables set API_TOKEN="your-random-token-here"
railway variables set APIFY_TOKEN="your-apify-token"
railway variables set GEMINI_API_KEY="your-gemini-key"
railway variables set ANTHROPIC_API_KEY="your-anthropic-key"
railway variables set OPENAI_API_KEY="your-openai-key"
railway variables set WHOP_API_KEY="your-whop-key"
railway variables set WHOP_WEBHOOK_SECRET="your-whop-secret"
railway variables set WHOP_CHECKOUT_URL="https://whop.com/checkout/your-product"
railway variables set BASE_DOMAIN="yourdomain.com"
railway variables set SITE_BASE_URL="https://yourdomain.com"

# Deploy
railway up

# Get your URL
railway domain
```

Your API is now live at `https://your-project.up.railway.app`

---

## Step 3: Create Telegram Bot (5 min)

1. Open Telegram, search for @BotFather
2. Send `/newbot`
3. Name it: `Prospect Engine`
4. Username: `prospect_engine_bot` (or similar)
5. Copy the bot token

Then tell me the token and I'll wire it into Hermes.

---

## Step 4: Hermes Integration

Once you give me:
- Railway URL
- API token
- Telegram bot token

I'll configure:
- Hermes agent that calls your API on schedule
- Telegram bot that messages you daily with pending items
- Cron jobs for daily/weekly operations

---

## Step 5: Test with One Niche

```bash
# Find solar businesses in Little Rock
curl -X POST https://your-url/find \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"niche": "solar", "area": "Little Rock, AR"}'

# Score them
curl -X POST https://your-url/score \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'

# Check status
curl https://your-url/status \
  -H "Authorization: Bearer your-token"
```

---

## What Each API Call Does

| Endpoint | When | What Happens |
|----------|------|--------------|
| `POST /find` | Weekly | Scrapes new businesses → SQLite |
| `POST /score` | Daily | Gemini Flash evaluates each site |
| `POST /build` | Daily | Builds sites for score ≥ 7 |
| `POST /outreach` | Daily | Fills forms / queues postcards |
| `POST /send` | Weekly | Posts queued postcards |
| `GET /pending` | Daily | Shows what needs approval |
| `POST /approve` | On demand | Releases approved items |
| `GET /status` | Anytime | Pipeline counts |

---

## Pricing Recap

| Service | Monthly | Cost to Serve |
|---------|---------|---------------|
| Website | $200 | ~$0 (static hosting) |
| Reviews | $99-199 | ~$0 per customer |
| Bundle | $250 | ~$3-5 total |

5 clients = $1,250/month. 20 clients = $5,000/month.

---

## What I Need From You

1. [ ] Apify token
2. [ ] Gemini API key
3. [ ] OpenAI API key
4. [ ] Anthropic API key
5. [ ] Whop checkout URL
6. [ ] Telegram bot token
7. [ ] Domain for client sites

Once I have those, I wire everything together and you're live.
