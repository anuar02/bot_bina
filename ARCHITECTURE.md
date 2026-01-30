# System Architecture

## Overview

This system uses **smart pre-filtering** and **Claude's MCP tools** to generate high-quality trading signals with minimal API costs.

## Key Design Principles

1. **Quality over quantity** - Only call Claude when market conditions warrant analysis
2. **Minimal responses** - Claude returns concise opportunities with probabilities
3. **Smart follow-ups** - System monitors watch conditions and calls Claude when triggered
4. **Strict limits** - Max 2-3 Claude calls per signal to prevent infinite loops
5. **MCP integration** - Claude autonomously pulls market data using tools

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SignalEngine                             │
│  (Main orchestrator - coordinates all components)               │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────────────────────┐
         │                                                         │
         ▼                                                         ▼
┌──────────────────────┐                              ┌──────────────────────┐
│   DataCollector      │                              │   ClaudeAnalyzer     │
│                      │                              │                      │
│ - Fetch price        │                              │ - Send prompt        │
│ - Calculate vol      │                              │ - Claude uses MCP    │
│ - Track history      │                              │ - Parse response     │
└──────────────────────┘                              └──────────────────────┘
         │                                                         │
         │                                                         │
         ▼                                                         ▼
┌──────────────────────┐                              ┌──────────────────────┐
│   SignalStorage      │                              │  TelegramNotifier    │
│                      │                              │                      │
│ - Store signals      │                              │ - Format messages    │
│ - Track follow-ups   │                              │ - Send alerts        │
│ - Monitor watches    │                              │ - Handle follow-ups  │
└──────────────────────┘                              └──────────────────────┘
```

---

## Data Flow

### Initial Analysis Flow

```
1. Timer triggers (every 30s)
   ↓
2. DataCollector.getMarketSnapshot()
   ↓
   - Fetch price from Crypto.com API
   - Calculate 24h volatility
   - Get volume change
   ↓
3. SignalEngine.shouldAnalyze()
   ↓
   Pre-filter check:
   - Volatility ≥1.5%? OR
   - Volume ≥2x average?
   ↓
   If YES → Continue
   If NO → Wait for next interval
   ↓
4. ClaudeAnalyzer.analyzeOpportunity()
   ↓
   - Build prompt with context
   - Call Claude API
   - Claude uses MCP tools:
     * get_ticker
     * get_book
     * get_trades
     * get_candlestick (multiple timeframes)
     * web_search (if needed)
   - Parse JSON response
   ↓
5. Validate opportunity
   ↓
   - Probability ≥65%?
   - Risk/Reward ≥2.5?
   ↓
6. SignalStorage.storeSignal()
   ↓
   - Generate UUID
   - Store opportunity + watch conditions
   - Initialize follow-up counter
   ↓
7. TelegramNotifier.sendSignal()
   ↓
   - Format message
   - Send to Telegram
```

### Watch Condition Flow

```
1. Timer triggers (every 30s)
   ↓
2. DataCollector.getMarketSnapshot()
   ↓
3. SignalStorage.checkWatchConditions()
   ↓
   For each active signal:
   - Check if price < trigger value?
   - Check if price > trigger value?
   - Check if volume spike?
   ↓
   If condition met → Continue
   If not → Wait
   ↓
4. SignalEngine.handleTriggeredWatchCondition()
   ↓
   - Increment follow-up counter
   - Check if max follow-ups exceeded
   ↓
   If exceeded → Deactivate signal
   If not → Continue
   ↓
5. ClaudeAnalyzer.analyzeOpportunity()
   ↓
   - Build prompt with follow-up context
   - Call Claude API
   - Claude re-analyzes with fresh data
   ↓
6. TelegramNotifier.sendFollowup()
   ↓
   - Format follow-up message
   - Include trigger info
   - Send to Telegram
   ↓
7. Update or deactivate signal
   ↓
   - New watch conditions? → Update
   - No watch conditions? → Deactivate
```

---

## Claude Integration (MCP)

### How Claude Uses MCP Tools

When Claude receives our prompt, it has access to:

1. **Crypto.com MCP Connector**
   - `get_ticker(symbol)` - Current price, 24h stats
   - `get_book(symbol, depth)` - Orderbook levels
   - `get_trades(symbol, count)` - Recent trades
   - `get_candlestick(symbol, timeframe)` - OHLCV data

2. **web_search Tool**
   - Search for news: "Bitcoin BTC news today"
   - Get sentiment: "Bitcoin Fear Greed Index"
   - Check events: "FOMC meeting date"

### Prompt Design

Our prompt tells Claude:

```
1. WHAT TO ANALYZE
   - Symbol, price, trigger reason
   - Follow-up context (if applicable)

2. WHICH TOOLS TO USE
   - get_ticker for current data
   - get_book for liquidity analysis
   - get_trades for order flow
   - get_candlestick for technical structure
   - web_search for sentiment/macro

3. HOW TO RESPOND
   - JSON format only
   - opportunity: LONG/SHORT/WAIT/WATCH
   - probability: 0-100
   - reasoning: 2-3 sentences
   - watchConditions: specific triggers
```

Claude then **autonomously** decides which tools to call based on the situation.

---

## Storage Design

### In-Memory Storage

Currently uses `Map<string, StoredSignal>` for simplicity.

**Why not a database?**
- Signals are short-lived (4-24 hours)
- System restarts clear old signals (desirable)
- No historical analysis needed
- Simpler deployment

**Future: Could add PostgreSQL for:**
- Signal performance tracking
- Historical analysis
- Multi-instance coordination

### Data Structure

```typescript
interface StoredSignal {
  id: string;                    // UUID
  symbol: string;                // e.g., "BTCUSD-PERP"
  timestamp: number;             // When created
  opportunity: SignalOpportunity; // Claude's response
  followupCount: number;         // 0-3
  watchConditions: WatchCondition[]; // Active triggers
  active: boolean;               // Still monitoring?
}
```

---

## Cost Optimization Strategy

### Pre-Filter Layer

**Problem:** Calling Claude every 30s = 2,880 calls/day = $288/day

**Solution:** Only call Claude when interesting

```typescript
shouldAnalyze(snapshot) {
  const highVolatility = snapshot.volatility24h >= 0.015; // 1.5%
  const volumeSpike = snapshot.volumeChange >= 2.0;      // 2x
  
  return highVolatility || volumeSpike;
}
```

**Result:** 70-80% reduction in Claude calls

### Follow-up Limits

**Problem:** Infinite loops if Claude keeps returning watch conditions

**Solution:** Max 3 follow-ups per signal

```typescript
if (followupCount > MAX_FOLLOWUPS) {
  this.deactivateSignal(signal.id);
  return;
}
```

**Result:** Predictable costs per signal

### Minimal Responses

**Problem:** Large Claude responses = higher token costs

**Solution:** Strict JSON format, 2-3 sentence reasoning

```json
{
  "probability": 72,
  "reasoning": "Weak support, high funding, FOMC uncertainty."
}
```

**Result:** ~500-800 output tokens vs 2000+

---

## Error Handling

### API Failures

**Crypto.com API fails:**
```typescript
try {
  const snapshot = await this.dataCollector.getMarketSnapshot(symbol);
} catch (error) {
  console.error('Failed to get snapshot:', error);
  // Skip this interval, continue monitoring
}
```

**Claude API fails:**
```typescript
try {
  const opportunity = await this.analyzer.analyzeOpportunity(...);
} catch (error) {
  console.error('Claude analysis failed:', error);
  return null; // Don't send signal
}
```

**Telegram API fails:**
```typescript
try {
  await this.bot.sendMessage(...);
} catch (error) {
  console.error('Telegram send failed:', error);
  // Log but continue (signal still stored)
}
```

### Data Validation

**Zod schema validation:**
```typescript
const configSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  MIN_PROBABILITY: z.coerce.number().min(0).max(100)
});
```

**JSON parsing:**
```typescript
const jsonMatch = content.text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.warn('No JSON found');
  return null;
}
```

---

## Scalability Considerations

### Current Limits

- **Symbols:** 1-5 symbols (tested)
- **Check interval:** 30s minimum (API rate limits)
- **Claude calls:** ~10-20/day per symbol
- **Memory:** ~1MB for active signals

### Scaling Up (10+ symbols)

1. **Stagger checks:**
   ```typescript
   setTimeout(() => checkSymbol('BTC'), 0);
   setTimeout(() => checkSymbol('ETH'), 10000);
   setTimeout(() => checkSymbol('SOL'), 20000);
   ```

2. **Add Redis for distributed storage**
3. **Implement API rate limit queue**
4. **Consider separate instances per symbol**

### Cost at Scale

| Symbols | Claude Calls/Day | Monthly Cost |
|---------|------------------|--------------|
| 1       | 10-15            | $30-45       |
| 2       | 20-30            | $60-90       |
| 5       | 50-75            | $150-225     |
| 10      | 100-150          | $300-450     |

---

## Security

### API Key Protection

- ✅ Keys in `.env` (not committed)
- ✅ `.env` in `.gitignore`
- ✅ No keys in code
- ✅ No keys in logs

### Telegram Security

- ✅ Bot token kept secret
- ✅ Chat ID kept private
- ✅ No public group sharing

### Best Practices

1. Rotate API keys quarterly
2. Use separate bot per instance
3. Don't share `.env` file
4. Review Telegram chat permissions

---

## Future Enhancements

### Phase 1: Core Improvements

- [ ] Add PostgreSQL for signal tracking
- [ ] Track signal performance (win rate)
- [ ] Add backtesting framework
- [ ] Implement Claude Code integration

### Phase 2: Advanced Features

- [ ] Multi-strategy support (scalping, swing)
- [ ] Portfolio position sizing
- [ ] Risk management (max exposure)
- [ ] Exchange API integration (auto-trading)

### Phase 3: Intelligence

- [ ] Learn from past signals (Claude Code)
- [ ] Adapt pre-filters dynamically
- [ ] Sentiment analysis from Twitter/Reddit
- [ ] Cross-asset correlation signals

---

## Testing Strategy

### Manual Testing

1. **Trigger pre-filter:**
   ```env
   PREFILTER_MIN_VOLATILITY=0.001
   ```
   
2. **Watch logs:**
   ```
   [Engine] 🔥 Pre-filter triggered
   [Claude] Analyzing BTCUSD-PERP...
   [Telegram] Signal sent
   ```

3. **Check Telegram message format**

4. **Reset to normal settings**

### Integration Testing

```typescript
// tests/integration/flow.test.ts
test('complete signal flow', async () => {
  const engine = new SignalEngine();
  // Mock volatile market
  // Verify Claude call
  // Verify Telegram message
  // Verify storage
});
```

---

## Deployment

### Development

```bash
npm run dev  # Hot reload with tsx
```

### Production

```bash
npm run build
node dist/index.js
```

### Background Service (PM2)

```bash
pm2 start dist/index.js --name crypto-signals
pm2 logs crypto-signals
```

### Docker (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

---

## Monitoring

### Key Metrics

- Claude calls per day
- Signals generated per day
- Follow-up ratio (avg per signal)
- Cost per signal
- Pre-filter efficiency

### Logging

All components log to console:

```
[DataCollector] Getting snapshot for BTCUSD-PERP
[Engine] 🔥 Pre-filter triggered: Volatility 2.1%
[Claude] Analyzing BTCUSD-PERP at $89,200...
[Claude] ✅ SHORT - Probability: 72%
[Storage] Stored signal abc-123 for BTCUSD-PERP
[Telegram] Signal sent
```

### Cost Tracking

```typescript
// Log after each Claude call
console.log(`[Cost] Estimated: $${(inputTokens * 0.003 + outputTokens * 0.015) / 1000}`);
```

---

**This architecture prioritizes cost efficiency, simplicity, and quality over complexity.**
