# Prospect Engine — Activation Checklist

## 1. Railway Deploy from GitHub (3 min)

1. Go to https://railway.app/new
2. Select **"GitHub Repo"**
3. Choose **andrebrassfield/prospect-engine**
4. Railway auto-detects `Dockerfile`
5. Click **"Deploy Now"**

### Add Environment Variables in Railway

Go to your project → **Variables** tab → add:

```
API_TOKEN=<generate-a-random-token>
PORT=3000
APIFY_TOKEN=<your-apify-token>
GEMINI_API_KEY=<your-gemini-key>
OPENAI_API_KEY=<your-openai-key>
WHOP_API_KEY=<your-whop-key>
WHOP_WEBHOOK_SECRET=<generate-a-random-secret>
BASE_DOMAIN=<your-domain.com>
SITE_BASE_URL=https://<your-domain.com>
```

6. Railway gives you a public URL like `https://prospect-engine-production.up.railway.app`

## 2. Create Telegram Bot (2 min)

1. Open Telegram, search **@BotFather**
2. Send `/newbot`
3. Name it: `Prospect Engine`
4. Username: `prospect_engine_bot` (must end in `bot`)
5. Copy the **bot token**

Get your **chat ID**:
1. Search **@userinfobot**
2. Send `/start`
3. Copy your **chat ID** (number like `123456789`)

## 3. What to Send Me

Once Railway is live, send me:
1. **Railway URL**: `https://...up.railway.app`
2. **API token**: `<your API_TOKEN>`
3. **Telegram bot token**: `123456:ABC-DEF...`
4. **Telegram chat ID**: `123456789`

I'll wire Hermes to the bot and set all cron jobs.

## 4. Test the System

```bash
RAILWAY_URL="https://your-project.up.railway.app"
API_TOKEN="your-api-token"

# Test status
curl $RAILWAY_URL/status -H "Authorization: Bearer $API_TOKEN"

# Find businesses
curl -X POST $RAILWAY_URL/find \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"niche": "solar", "area": "Little Rock, AR"}'

# Score them
curl -X POST $RAILWAY_URL/score \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```
