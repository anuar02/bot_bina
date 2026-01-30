# Smart Crypto Signal System with Claude

**Minimal, efficient, actionable** crypto trading signals powered by Claude Sonnet 4.5 with MCP integration.

## 🎯 Key Features

- ✅ **Smart Pre-Filters**: Only calls Claude when volatility/volume spikes (saves 70%+ costs)
- ✅ **Watch Conditions**: Claude says "watch when price hits $X", system monitors and follows up
- ✅ **Follow-up Limits**: Max 2-3 Claude calls per signal (prevents spam)
- ✅ **Clean Telegram Alerts**: Short, actionable messages with probabilities
- ✅ **MCP Integration**: Claude uses Crypto.com tools to analyze live market data
- ✅ **Multi-Symbol**: Monitor BTC, ETH, SOL simultaneously

---

## 📋 Required API Keys

You only need **2 API keys**:

1. ✅ **Anthropic API** ([Get it here](https://console.anthropic.com))
2. ✅ **Telegram Bot** (5-minute setup below)

**You DON'T need:**
- ❌ Crypto.com API (Claude's MCP connector handles it)
- ❌ CoinGlass API
- ❌ CryptoQuant API

---

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Telegram Bot

**Option A: Simple (Use Your Personal Chat)**

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`
3. Follow prompts to create bot
4. Copy the bot token
5. Send a message to your new bot (any message)
6. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
7. Copy the `chat.id` from the response

**Option B: Group Chat**

1. Create bot with @BotFather
2. Create group, add bot
3. Send message in group
4. Visit getUpdates URL, copy group `chat.id` (starts with `-`)

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your keys
```

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
TELEGRAM_BOT_TOKEN=7123456789:AAH...
TELEGRAM_CHAT_ID=123456789
```

### 4. Run

```bash
# Development mode (hot reload)
npm run dev

# Production build
npm run build
npm start
```

---

## 💰 Cost Analysis

### Expected Usage (2 symbols, default settings)

**Pre-filter checks:** 
- Every 30 seconds = 2,880 checks/day
- **Cost: $0** (just price API calls)

**Claude calls:**
- Triggered ~8-12 times/day (when volatility/volume spikes)
- Follow-ups: ~4-6 times/day (when watch conditions hit)
- **Total: ~15 Claude calls/day**

**Monthly cost:**
- 15 calls/day × 30 days = 450 calls/month
- ~$0.10 per call (input + output)
- **Total: ~$45/month**

### Cost Optimization Tips

1. **Increase `CHECK_INTERVAL_SECONDS`** to 60 (reduces pre-filter frequency)
2. **Increase `PREFILTER_MIN_VOLATILITY`** to 0.02 (2%) for fewer triggers
3. **Monitor 1 symbol** instead of 2-3
4. **Lower `MAX_FOLLOWUPS_PER_SIGNAL`** to 2

**Conservative settings:** ~$25-30/month
**Aggressive settings:** ~$60-80/month

---

## 🧠 How It Works

```
┌─────────────────────────────────────────┐
│ 1. Every 30s: Check price/volume        │
│    - No Claude call (FREE)              │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 2. Pre-filter triggers?                 │
│    - Volatility >1.5% OR Volume >2x     │
│    - Yes → Continue                     │
│    - No → Wait                          │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 3. Call Claude (FIRST TIME)             │
│    - Uses MCP tools to analyze          │
│    - Returns: LONG/SHORT/WAIT/WATCH     │
│    - Includes watch conditions          │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 4. Send Telegram message                │
│    - Opportunity + probability          │
│    - Entry/stop/targets (if signal)     │
│    - Watch conditions (if waiting)      │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 5. System monitors watch conditions     │
│    - "Watch: price < $88,000"           │
│    - Checks every 30s (FREE)            │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 6. When condition met → Call Claude     │
│    - "You said watch $88k, it broke"    │
│    - Claude updates analysis            │
│    - Max 2-3 follow-ups per signal      │
└─────────────────────────────────────────┘
```

---

## 📊 Example Telegram Messages

### Initial Signal
```
🔴 SHORT Opportunity (72%) ████████░░

📊 BTCUSD-PERP
💵 Entry: $89,200
🛑 Stop: $90,500
🎯 Targets: $87,000 → $85,000
📈 R:R: 1:3.4

📝 Weak support, high funding rate, FOMC uncertainty. Orderbook shows seller pressure.

⏰ Valid: 12h
```

### Watch Message
```
👀 WATCHING BTCUSD-PERP (55% potential)

📝 Market indecisive. Strong support at $88.4k. Need confirmation.

🔔 I'll alert you when:
• Price < $88,400 → Downside accelerates
• Price > $90,500 → Short squeeze possible
```

### Follow-up Message
```
🎯 TRIGGER HIT: Price < $88,400

🔴 SHORT NOW (78%) ████████░░

📊 BTCUSD-PERP
💵 Entry: $88,350
🛑 Stop: $89,200
🎯 Targets: $86,500 → $84,000
📈 R:R: 1:3.2

📝 Support broken. Accelerating downside momentum with volume confirmation.

⏰ Valid: 8h
```

---

## ⚙️ Configuration

### Key Settings in `.env`

```env
# === API KEYS ===
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# === SYMBOLS ===
# Comma-separated, no spaces
SYMBOLS=BTCUSD-PERP,ETHUSD-PERP,SOLUSD-PERP

# === SIGNAL QUALITY ===
MIN_PROBABILITY=65          # Only signal if ≥65% probability
MIN_RISK_REWARD=2.5         # Only signal if R:R ≥2.5

# === MONITORING ===
CHECK_INTERVAL_SECONDS=30   # How often to check markets (30s recommended)
MAX_FOLLOWUPS_PER_SIGNAL=3  # Max Claude calls per signal (prevents spam)

# === PRE-FILTERS ===
PREFILTER_MIN_VOLATILITY=0.015   # 1.5% price move triggers Claude
PREFILTER_MIN_VOLUME_SPIKE=2.0   # 2x volume spike triggers Claude
```

### Recommended Settings by Budget

**Budget-Conscious ($20-30/month):**
```env
SYMBOLS=BTCUSD-PERP
CHECK_INTERVAL_SECONDS=60
PREFILTER_MIN_VOLATILITY=0.025
MAX_FOLLOWUPS_PER_SIGNAL=2
```

**Balanced ($40-50/month):**
```env
SYMBOLS=BTCUSD-PERP,ETHUSD-PERP
CHECK_INTERVAL_SECONDS=30
PREFILTER_MIN_VOLATILITY=0.015
MAX_FOLLOWUPS_PER_SIGNAL=3
```

**Aggressive ($60-80/month):**
```env
SYMBOLS=BTCUSD-PERP,ETHUSD-PERP,SOLUSD-PERP
CHECK_INTERVAL_SECONDS=30
PREFILTER_MIN_VOLATILITY=0.01
MAX_FOLLOWUPS_PER_SIGNAL=3
```

---

## 🏗️ Project Structure

```
crypto-signal-system/
├── src/
│   ├── config/
│   │   └── index.ts              # Environment config (Zod validated)
│   ├── data/
│   │   └── DataCollector.ts      # Fetch price/volume from Crypto.com
│   ├── analysis/
│   │   ├── types.ts              # TypeScript types
│   │   └── ClaudeAnalyzer.ts     # Claude API integration with MCP
│   ├── storage/
│   │   └── SignalStorage.ts      # Store signals & watch conditions
│   ├── notifications/
│   │   └── TelegramNotifier.ts   # Send clean Telegram messages
│   ├── execution/
│   │   └── SignalEngine.ts       # Main orchestration engine
│   └── index.ts                  # Entry point
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🔧 Advanced Usage

### Run as Background Service

**Using PM2:**
```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name crypto-signals
pm2 save
pm2 startup
```

**Using systemd (Linux):**
```bash
sudo nano /etc/systemd/system/crypto-signals.service
```

```ini
[Unit]
Description=Crypto Signal System
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/crypto-signal-system
ExecStart=/usr/bin/node /path/to/crypto-signal-system/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable crypto-signals
sudo systemctl start crypto-signals
sudo systemctl status crypto-signals
```

---

## 🎓 Understanding the System

### Pre-Filters (When Claude Gets Called)

The system uses **two triggers** to decide when to call Claude:

1. **Volatility**: Price moved ≥1.5% in recent history
2. **Volume**: Trading volume ≥2x normal

This prevents Claude from analyzing boring, sideways markets (saves 70-80% of potential calls).

### Watch Conditions (Smart Follow-ups)

When Claude analyzes a market, it can return watch conditions:

```json
{
  "opportunity": "WATCH",
  "watchConditions": [
    {
      "trigger": "price_below",
      "value": 88400,
      "then": "SHORT opportunity increases to 75%"
    }
  ]
}
```

The system then **monitors** that condition every 30s. When price breaks $88,400, it automatically calls Claude again for an update.

### Follow-up Limits

To prevent infinite Claude loops, there's a max follow-up limit (default: 3).

Example flow:
1. Pre-filter triggers → Claude call #1 → Returns "WATCH price < $88k"
2. Price breaks $88k → Claude call #2 → Returns "WATCH volume spike"
3. Volume spikes → Claude call #3 → Returns final signal
4. Signal complete → No more calls for this opportunity

---

## ❓ FAQ

### Why so few signals?

This system prioritizes **quality over quantity**. It only signals when:
- Pre-filters detect interesting market conditions
- Claude's probability ≥65%
- Risk/reward ≥2.5

Most market movement is noise. You'll get 2-5 high-quality signals per week.

### Can I adjust sensitivity?

Yes! Lower `PREFILTER_MIN_VOLATILITY` to 0.01 (1%) for more frequent analysis, or raise it to 0.03 (3%) for fewer but higher-conviction setups.

### What happens if I miss a signal?

Signals have time validity (4h, 12h, 24h). If you miss the entry window, wait for the next opportunity. Never chase.

### How accurate are the probabilities?

Claude provides **estimated probabilities** based on its analysis. Treat them as confidence levels, not guaranteed outcomes. Always use proper risk management.

### Can I backtest?

Not currently built-in. You could extend the system to log all signals and track outcomes manually.

---

## ⚠️ Disclaimer

This is an **educational tool**, not financial advice. Cryptocurrency trading carries significant risk. Only trade with capital you can afford to lose. Past performance does not guarantee future results.

---

## 🤝 Support

- Issues: Open a GitHub issue
- Questions: Check FAQ above
- Telegram setup help: See Quick Start section

---

**Built with Claude Sonnet 4.5** 🤖
