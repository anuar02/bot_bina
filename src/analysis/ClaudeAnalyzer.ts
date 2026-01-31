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
      followupContext?: string,
      onToolUsage?: (tools: Array<{ name: string; input: any }>) => void
  ): Promise<SignalOpportunity | null> {
    try {
      const prompt = this.buildPrompt(symbol, currentPrice, triggerReason, followupContext);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
        tools: this.getCryptoComMCPTools()
      });

      // ============================================
      // 🔍 EXTRACT TOOL USAGE
      // ============================================
      const toolsUsed = this.extractToolUsage(response.content);

      // Notify caller about tool usage
      if (onToolUsage) {
        onToolUsage(toolsUsed);
      }

      // Find text response
      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return null;
      }

      // Extract JSON
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const opportunity: SignalOpportunity = JSON.parse(jsonMatch[0]);

      // Add metadata about tool usage
      return {
        ...opportunity,
        _metadata: {
          toolsUsed: toolsUsed.map(t => t.name),
          toolCount: toolsUsed.length,
          usedRealData: toolsUsed.length > 0,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      throw error; // Let caller handle errors
    }
  }

  private extractToolUsage(content: any[]): Array<{ name: string; input: any }> {
    return content
        .filter(block => block.type === 'tool_use')
        .map(block => ({
          name: block.name,
          input: block.input
        }));
  }

  private buildPrompt(
      symbol: string,
      currentPrice: number,
      triggerReason: string,
      followupContext?: string
  ): string {
    return `You are an elite crypto trader analyzing ${symbol}.

${followupContext ? `FOLLOW-UP CONTEXT:\n${followupContext}\n\n` : ''}
CURRENT SITUATION:
- Price: $${currentPrice}
- Trigger: ${triggerReason}

USE YOUR MCP TOOLS TO INVESTIGATE:

1. Crypto.com connector (MANDATORY - use these tools):
   - get_ticker: Current market data
   - get_book: Orderbook depth (check walls, imbalance)
   - get_trades: Recent trades (last 100) to read tape
   - get_candlestick: Multi-timeframe candles (1D, 4h, 1h, 15m)

2. web_search (if macro matters):
   - Search "Bitcoin BTC market news today" for sentiment
   - Search "Bitcoin Fear Greed Index" for sentiment gauge

ANALYZE QUICKLY:
- Order flow (buying vs selling pressure from tape)
- Technical structure (trend, support/resistance from candles)
- Leverage positioning (funding rate, orderbook imbalance)
- Macro backdrop (any critical events?)

RESPOND WITH JSON ONLY:

{
  "opportunity": "LONG" | "SHORT" | "WAIT" | "WATCH",
  "probability": <0-100>,
  "reasoning": "<2-3 sentences citing specific data points>",
  
  // If LONG or SHORT:
  "entry": <price>,
  "stopLoss": <price>,
  "targets": [<tp1>, <tp2>],
  "riskReward": <ratio>,
  "timeValidity": "4h" | "12h" | "24h",
  
  // If WATCH:
  "watchConditions": [
    {
      "trigger": "price_below" | "price_above" | "volume_spike",
      "value": <number>,
      "then": "<what opportunity emerges>"
    }
  ]
}

CRITICAL RULES:
- MUST use MCP tools before responding (don't guess data)
- Only LONG/SHORT if probability ≥65% AND R:R ≥2.5
- If uncertain, return WATCH with specific price triggers
- Reference actual data in reasoning (e.g., "1H RSI at 28", "Orderbook 0.87 bid/ask")`;
  }

  private getCryptoComMCPTools(): Anthropic.Tool[] { // Add explicit return type
    return [
      {
        name: 'get_ticker',
        description: 'Get latest price and volume for a crypto symbol',
        input_schema: {
          type: 'object' as const, // 👈 KEY FIX: Add "as const" here
          properties: {
            instrument_name: {
              type: 'string',
              description: 'Symbol name (e.g. BTCUSD-PERP)'
            }
          },
          required: ['instrument_name']
        }
      },
      {
        name: 'get_orderbook',
        description: 'Get current bids and asks depth',
        input_schema: {
          type: 'object' as const, // 👈 KEY FIX: Add "as const" here
          properties: {
            instrument_name: { type: 'string' },
            depth: { type: 'number', description: 'Number of levels (default 10)' }
          },
          required: ['instrument_name']
        }
      },
      {
        name: 'get_candles',
        description: 'Get historical price candles (OHLCV)',
        input_schema: {
          type: 'object' as const, // 👈 KEY FIX: Add "as const" here
          properties: {
            instrument_name: { type: 'string' },
            timeframe: { type: 'string', description: '1m, 5m, 15m, 1h, 4h, 1d' },
            count: { type: 'number', description: 'Number of candles' }
          },
          required: ['instrument_name']
        }
      }
    ];
  }
}