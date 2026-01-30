import Anthropic from '@anthropic-ai/sdk';
import type { SignalOpportunity } from './types.js';

export class ClaudeAnalyzer {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyzeOpportunity(
    symbol: string,
    currentPrice: number,
    triggerReason: string,
    followupContext?: string
  ): Promise<SignalOpportunity | null> {
    try {
      const prompt = this.buildPrompt(symbol, currentPrice, triggerReason, followupContext);
      
      console.log(`[Claude] Analyzing ${symbol} at $${currentPrice}...`);
      
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') return null;

      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[Claude] No JSON found in response');
        return null;
      }

      const opportunity: SignalOpportunity = JSON.parse(jsonMatch[0]);
      
      console.log(`[Claude] ✅ ${opportunity.opportunity} - Probability: ${opportunity.probability}%`);
      
      return opportunity;

    } catch (error) {
      console.error('[Claude] Analysis failed:', error);
      return null;
    }
  }

  private buildPrompt(
    symbol: string,
    currentPrice: number,
    triggerReason: string,
    followupContext?: string
  ): string {
    const basePrompt = `You are an elite crypto trader analyzing ${symbol}.

${followupContext ? `FOLLOW-UP CONTEXT:\n${followupContext}\n` : ''}
CURRENT SITUATION:
- Price: $${currentPrice}
- Trigger: ${triggerReason}

USE YOUR MCP TOOLS TO INVESTIGATE:

1. Crypto.com connector (use these tools):
   - get_ticker: Current market data
   - get_book: Orderbook depth (check walls, imbalance)
   - get_trades: Recent trades (last 50-100) to read tape
   - get_candlestick: Multi-timeframe candles (1D, 4H, 1H, 15m)

2. web_search (if macro matters):
   - Search "Bitcoin BTC market news today" for sentiment
   - Search "Bitcoin Fear Greed Index" for sentiment gauge
   - Check for upcoming FOMC or major economic events

ANALYZE QUICKLY:
- Order flow (is there buying or selling pressure?)
- Technical structure (trend, support/resistance)
- Leverage positioning (funding rate, overleveraged side)
- Macro backdrop (any critical events coming?)

RESPOND WITH JSON ONLY:

{
  "opportunity": "LONG" | "SHORT" | "WAIT" | "WATCH",
  "probability": <0-100>,
  "reasoning": "<2-3 sentences max explaining why>",
  
  // If LONG or SHORT:
  "entry": <price>,
  "stopLoss": <price>,
  "targets": [<tp1>, <tp2>],
  "riskReward": <ratio>,
  "timeValidity": "4h" | "12h" | "24h",
  
  // If WATCH or unclear:
  "watchConditions": [
    {
      "trigger": "price_below" | "price_above" | "volume_spike",
      "value": <specific number>,
      "then": "<what opportunity emerges>"
    }
  ]
}

CRITICAL RULES:
- Only signal LONG/SHORT if probability ≥65% AND risk/reward ≥2.5
- If uncertain, return "WATCH" with specific conditions to monitor
- Be concise (2-3 sentences max for reasoning)
- Use MCP tools to get real data - don't guess
- Specify exact price levels for watch conditions

Begin analysis now using your tools.`;

    return basePrompt;
  }
}
