# Quick Setup Guide (5 Minutes)

## Step 1: Get Anthropic API Key (2 min)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / Log in
3. Go to **API Keys** section
4. Click **Create Key**
5. Copy your key (starts with `sk-ant-...`)

## Step 2: Create Telegram Bot (2 min)

1. Open Telegram
2. Search for `@BotFather`
3. Send `/newbot`
4. Follow prompts:
   - Name: `My Signal Bot`
   - Username: `my_signal_bot` (must be unique)
5. Copy the bot token (looks like `7123456789:AAH...`)

## Step 3: Get Your Chat ID (1 min)

**Method 1: Personal Chat (Easiest)**

1. Send any message to your new bot
2. Visit this URL in browser (replace `<TOKEN>` with your bot token):
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
3. Look for `"chat":{"id":123456789}`
4. Copy that number (your chat ID)

**Method 2: Group Chat**

1. Create a group chat in Telegram
2. Add your bot to the group
3. Send a message in the group
4. Visit the getUpdates URL (same as above)
5. Look for chat ID (will start with `-` like `-1001234567890`)

## Step 4: Configure Project

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your keys
nano .env  # or use any text editor
```

Your `.env` should look like:

```env
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
TELEGRAM_BOT_TOKEN=7123456789:AAHaBcDeFgHiJkLmNoPqRsTuVwXyZ
TELEGRAM_CHAT_ID=123456789
SYMBOLS=BTCUSD-PERP
```

## Step 5: Run!

```bash
npm run dev
```

You should see:
```
🤖 Smart Signal System Starting...
📊 Monitoring: BTCUSD-PERP
⏱️  Check interval: 30s
```

And receive a Telegram message:
```
🤖 Signal System Started
📊 Monitoring: BTCUSD-PERP
✅ Ready to detect opportunities!
```

## Troubleshooting

### "Anthropic API key is required"
- Check your `.env` file exists in project root
- Make sure key starts with `sk-ant-`
- No quotes needed in `.env`

### "Telegram bot token is required"
- Get token from @BotFather
- Format: `numbers:letters` (no spaces)

### "No Telegram messages received"
- Send a message to your bot first
- Check chat ID is correct (use getUpdates URL)
- For groups, chat ID starts with `-`

### "Module not found" errors
- Run `npm install` first
- Make sure you're in project directory

## Next Steps

- Wait for first signal (could take hours if market is quiet)
- Adjust sensitivity in `.env` if needed
- Read full README.md for configuration options

## Testing (Optional)

Want to force a signal to test Telegram?

Temporarily lower the pre-filter threshold:

```env
PREFILTER_MIN_VOLATILITY=0.001
```

This will trigger Claude on any small price movement. **Change back after testing!**

---

**Need help?** Read the FAQ in README.md
