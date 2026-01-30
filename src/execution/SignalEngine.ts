import { ClaudeAnalyzer } from '../analysis/ClaudeAnalyzer.js';
import { DataCollector } from '../data/DataCollector.js';
import { TelegramNotifier } from '../notifications/TelegramNotifier.js';
import { SignalStorage } from '../storage/SignalStorage.js';
import { config } from '../config/index.js';
import type { SignalOpportunity } from '../analysis/types.js';

export class SignalEngine {
  private analyzer: ClaudeAnalyzer;
  private dataCollector: DataCollector;
  private telegram: TelegramNotifier;
  private storage: SignalStorage;
  private symbols: string[];

  constructor() {
    this.analyzer = new ClaudeAnalyzer(config.ANTHROPIC_API_KEY);
    this.dataCollector = new DataCollector();
    this.telegram = new TelegramNotifier(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID);
    this.storage = new SignalStorage();
    this.symbols = config.SYMBOLS.split(',').map(s => s.trim());
  }

  async start(): Promise<void> {
    console.log('🤖 Smart Signal System Starting...\n');
    console.log(`📊 Monitoring: ${this.symbols.join(', ')}`);
    console.log(`⏱️  Check interval: ${config.CHECK_INTERVAL_SECONDS}s`);
    console.log(`🎯 Min probability: ${config.MIN_PROBABILITY}%`);
    console.log(`📈 Min R:R: ${config.MIN_RISK_REWARD}\n`);

    await this.telegram.sendStartup(this.symbols);

    // Start monitoring loop
    this.monitorMarkets();
  }

  private async monitorMarkets(): Promise<void> {
    const check = async () => {
      for (const symbol of this.symbols) {
        try {
          await this.checkSymbol(symbol);
        } catch (error) {
          console.error(`[Engine] Error checking ${symbol}:`, error);
        }
      }
    };

    // Initial check
    await check();

    // Schedule regular checks
    setInterval(check, config.CHECK_INTERVAL_SECONDS * 1000);
  }

  // 👇 THIS IS THE MAIN UPDATE
  private async checkSymbol(symbol: string): Promise<void> {
    const snapshot = await this.dataCollector.getMarketSnapshot(symbol);

    // 1. Check Watch Conditions (Existing logic)
    const triggeredSignals = this.storage.checkWatchConditions(
        symbol,
        snapshot.price,
        snapshot.volumeChange >= config.PREFILTER_MIN_VOLUME_SPIKE
    );

    for (const signal of triggeredSignals) {
      await this.handleTriggeredWatchCondition(symbol, signal, snapshot.price);
    }

    // 2. Check Pre-filters (Volatility/Volume)
    if (this.shouldAnalyze(snapshot)) {

      // ✅ NEW: Retrieve price history for the sparkline
      const history = this.dataCollector.getPriceHistory(symbol);

      // ✅ NEW: Send visual alert to Telegram immediately
      await this.telegram.sendTriggerAlert(symbol, history, {
        volatility: (snapshot.volatility24h * 100).toFixed(2),
        volumeChange: snapshot.volumeChange
      });

      // 3. Trigger Claude Analysis
      await this.analyzeNewOpportunity(symbol, snapshot);
    }
  }

  private shouldAnalyze(snapshot: any): boolean {
    const highVolatility = snapshot.volatility24h >= config.PREFILTER_MIN_VOLATILITY;
    const volumeSpike = snapshot.volumeChange >= config.PREFILTER_MIN_VOLUME_SPIKE;

    if (highVolatility || volumeSpike) {
      const reasons = [];
      if (highVolatility) reasons.push(`Volatility ${(snapshot.volatility24h * 100).toFixed(2)}%`);
      if (volumeSpike) reasons.push(`Volume ${snapshot.volumeChange.toFixed(1)}x`);

      console.log(`[Engine] 🔥 Pre-filter triggered for ${snapshot.symbol}: ${reasons.join(', ')}`);
      return true;
    }

    return false;
  }

  private async analyzeNewOpportunity(symbol: string, snapshot: any): Promise<void> {
    const triggerReason = `Volatility ${(snapshot.volatility24h * 100).toFixed(2)}%, Volume ${snapshot.volumeChange.toFixed(1)}x`;

    // ... (rest of the method remains exactly the same) ...
    const opportunity = await this.analyzer.analyzeOpportunity(
        symbol,
        snapshot.price,
        triggerReason
    );

    if (!opportunity) {
      console.log(`[Engine] Claude returned no opportunity for ${symbol}`);
      return;
    }

    if (opportunity.opportunity === 'LONG' || opportunity.opportunity === 'SHORT') {
      if (opportunity.probability < config.MIN_PROBABILITY) {
        console.log(`[Engine] ❌ Probability ${opportunity.probability}% below minimum ${config.MIN_PROBABILITY}%`);
        return;
      }

      if (opportunity.riskReward && opportunity.riskReward < config.MIN_RISK_REWARD) {
        console.log(`[Engine] ❌ R:R ${opportunity.riskReward} below minimum ${config.MIN_RISK_REWARD}`);
        return;
      }
    }

    const signalId = this.storage.storeSignal(symbol, opportunity);
    await this.telegram.sendSignal(symbol, opportunity);

    console.log(`[Engine] ✅ Signal sent for ${symbol} (ID: ${signalId})`);
  }

  private async handleTriggeredWatchCondition(
      symbol: string,
      signal: any,
      currentPrice: number
  ): Promise<void> {
    // ... (rest of the method remains exactly the same) ...

    // (Existing implementation continues here)
    const followupCount = this.storage.incrementFollowup(signal.id);

    if (followupCount > config.MAX_FOLLOWUPS_PER_SIGNAL) {
      console.log(`[Engine] Max follow-ups (${config.MAX_FOLLOWUPS_PER_SIGNAL}) reached for signal ${signal.id}`);
      this.storage.deactivateSignal(signal.id);
      return;
    }

    console.log(`[Engine] 🎯 Watch condition triggered for ${symbol} (Follow-up ${followupCount}/${config.MAX_FOLLOWUPS_PER_SIGNAL})`);

    const triggeredCondition = signal.watchConditions.find((cond: any) => {
      if (cond.trigger === 'price_below') return currentPrice < cond.value;
      if (cond.trigger === 'price_above') return currentPrice > cond.value;
      return false;
    });

    const followupContext = triggeredCondition
        ? `Previous analysis suggested watching when ${triggeredCondition.trigger} $${triggeredCondition.value}. That condition just triggered. Previous assessment: ${signal.opportunity.reasoning}`
        : `Watch condition triggered for previous signal.`;

    const opportunity = await this.analyzer.analyzeOpportunity(
        symbol,
        currentPrice,
        'Watch condition triggered',
        followupContext
    );

    if (!opportunity) return;

    const triggerInfo = triggeredCondition
        ? `${triggeredCondition.trigger} $${triggeredCondition.value}`
        : 'Watch condition met';

    await this.telegram.sendFollowup(symbol, triggerInfo, opportunity);

    if (opportunity.watchConditions && opportunity.watchConditions.length > 0) {
      signal.watchConditions = opportunity.watchConditions;
    } else {
      this.storage.deactivateSignal(signal.id);
    }
  }
}