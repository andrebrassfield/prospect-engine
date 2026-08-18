# Prospect Engine

Automated sales machine for web services. Finds businesses, builds sites, reaches out, takes payment, and keeps clients happy.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROSPECT ENGINE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  FINDER  │───▶│ SCORER   │───▶│ BUILDER  │───▶│ OUTREACH │  │
│  │          │    │          │    │          │    │          │  │
│  │ • SOS    │    │ • Gemini │    │ • 10     │    │ • Forms  │  │
│  │ • Google │    │ • Flash  │    │   templates│   │ • Cards  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ PAYWALL  │───▶│  EDIT    │───▶│ REVIEWS  │───▶│   API    │  │
│  │          │    │  AGENT   │    │          │    │          │  │
│  │ • Whop   │    │ • Haiku  │    │ • Finder │    │ • Express│  │
│  │ • Deploy │    │ • Inbox  │    │ • Images │    │ • Auth   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## What It Does

1. **Finds** businesses via new registrations + Google Maps
2. **Scores** them using Gemini Flash (site quality, mobile, forms, etc.)
3. **Builds** professional sites from templates (data merge, not generation)
4. **Reaches** owners via contact forms or physical postcards
5. **Takes payment** via Whop and deploys the site live
6. **Edits** sites when clients email changes (Claude Haiku)
7. **Gets reviews** with personalized image + email campaigns

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Initialize database
node -e "require('./db')"

# 5. Start API server
node index.js api
```

## API Endpoints

All endpoints require `Authorization: Bearer <API_TOKEN>` header.

### Find Businesses
```bash
POST /find
{
  "niche": "solar",
  "area": "Little Rock, AR"
}
```

### Score Unsorecd
```bash
POST /score
{
  "limit": 50
}
```

### Build Sites
```bash
POST /build
{
  "threshold": 7
}
```

### Run Outreach
```bash
POST /outreach
{
  "businessIds": [1, 2, 3]
}
```

### Get Pending Approvals
```bash
GET /pending
```

### Approve Items
```bash
POST /approve
{
  "ids": [1, 2, 3],
  "type": "outreach"  // or "sites"
}
```

### System Status
```bash
GET /status
```

## Templates

Located in `templates/` directory. Each template is:
- `template.html` - HTML with Tailwind CSS
- `data.json` - All copy, services, prices, images

Supported niches:
- Solar
- Roofing
- HVAC
- Pools
- Driveways
- Extensions
- Landscaping
- Windows
- Flooring
- Garage Doors
- Fencing
- Tree Surgery

## Pricing Model

| Service | Price |
|---------|-------|
| Website | $200/mo |
| Reviews | $99/mo (up to 200 customers) |
| Reviews | $199/mo (200+ customers) |
| Bundle | $250/mo |

## Running Costs

- Templates: ~$0 (data merge, not generation)
- Hosting: ~$0 (static sites)
- Reviews: ~$0 per customer (1 image gen + text overlay)
- Postcards: ~$3-5 each (including postage)

## Hermes Integration

Add to your Hermes agent's cron:

```yaml
# Daily at 6 AM
- name: prospect-engine-daily
  schedule: "0 6 * * *"
  command: "cd /path/to/prospect-engine && node index.js daily"
  
# Weekly on Monday
- name: prospect-engine-weekly
  schedule: "0 8 * * 1"
  command: "cd /path/to/prospect-engine && node index.js weekly"
```

## Model Usage

| Task | Model | Why |
|------|-------|-----|
| Orchestration | Claude Opus 5 | Decision making |
| Site evaluation | Gemini 2.5 Flash | Fast, accurate, cheap |
| Template rendering | Kimi K3 | Best frontend |
| Image generation | GPT Image 2 | Quality images |
| Edit agent | Claude Haiku | Simple, constant |

## Development

```bash
# Run in development
node index.js daily

# Test specific module
node -e "const f = require('./modules/finder'); f.findBusinesses('solar', 'Little Rock, AR', process.env.APIFY_TOKEN)"

# Check database
sqlite3 data/prospects.db "SELECT name, score, status FROM businesses ORDER BY score DESC LIMIT 10"
```

## Next Steps

1. [ ] Set up Apify account and get token
2. [ ] Configure Gemini API key
3. [ ] Create Whop product and get checkout URL
4. [ ] Set up domain and DNS
5. [ ] Deploy to Railway
6. [ ] Configure Hermes cron jobs
7. [ ] Test with one niche in one area
8. [ ] Scale to all niches
