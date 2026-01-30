import type { MarketSnapshot } from '../analysis/types.js';

export class DataCollector {
  // Store history: Symbol -> Array of prices
  private priceHistory: Map<string, number[]> = new Map();

  async getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
    try {
      // 1. Get current price from Crypto.com API
      const ticker = await this.getTicker(symbol);
      const price = parseFloat(ticker.a);

      // 2. Calculate volatility using local history
      const volatility24h = this.calculateVolatility(symbol, price);

      // 3. Get volume change from API
      const volumeChange = parseFloat(ticker.v_change || '1');

      return {
        symbol,
        price,
        timestamp: Date.now(),
        volatility24h,
        volumeChange
      };

    } catch (error) {
      console.error(`[DataCollector] Failed to get snapshot for ${symbol}:`, error);
      throw error;
    }
  }

  // 👇 NEW: Public accessor needed for the Sparkline Chart
  public getPriceHistory(symbol: string): number[] {
    return this.priceHistory.get(symbol) || [];
  }

  private async getTicker(symbol: string): Promise<any> {
    const response = await fetch(
        `https://api.crypto.com/v2/public/get-ticker?instrument_name=${symbol}`
    );

    // 👇 FIX: Add 'as any' here so TypeScript lets us access properties
    const data = await response.json() as any;

    if (!data.result?.data?.[0]) {
      throw new Error('Invalid ticker response');
    }

    return data.result.data[0];
  }

  private calculateVolatility(symbol: string, currentPrice: number): number {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(currentPrice);

    // Keep last 100 prices (roughly 50 minutes)
    if (history.length > 100) {
      history.shift();
    }

    if (history.length < 2) return 0;

    // 👇 IMPROVED MATH: Calculates High vs Low instead of just Start vs End
    // This catches "V-shapes" where price drops and recovers (high volatility)
    const min = Math.min(...history);
    const max = Math.max(...history);

    // Avoid division by zero
    if (min === 0) return 0;

    return (max - min) / min;
  }
}