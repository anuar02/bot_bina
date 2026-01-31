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
  private lastAnalysisTime: Map<string, number> = new Map();
  private readonly ANALYSIS_COOLDOWN_MS = 5 * 60 * 1000;

  constructor() {
    this.analyzer = new ClaudeAnalyzer(config.ANTHROPIC_API_KEY);
    this.dataCollector = new DataCollector();
    this.telegram = new TelegramNotifier(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID);
    this.storage = new SignalStorage(this.telegram); // Pass telegram to storage
    this.symbols = config.SYMBOLS.split(',').map(s => s.trim());
  }

  async start(): Promise<void> {
    await this.telegram.sendStartup(this.symbols);
    this.monitorMarkets();
  }

  private async monitorMarkets(): Promise<void> {
    const check = async () => {
      for (const symbol of this.symbols) {
        try {
          await this.checkSymbol(symbol);
        } catch (error: any) {
          await this.telegram.sendError(symbol, error.message || 'Unknown error');
        }
      }
    };

    await check();
    setInterval(check, config.CHECK_INTERVAL_SECONDS * 1000);
  }

  private async checkSymbol(symbol: string): Promise<void> {
    const snapshot = await this.dataCollector.getMarketSnapshot(symbol);

    // Check watch conditions
    const triggeredSignals = this.storage.checkWatchConditions(
        symbol,
        snapshot.price,
        snapshot.volumeChange >= config.PREFILTER_MIN_VOLUME_SPIKE
    );

    for (const signal of triggeredSignals) {
      await this.handleTriggeredWatchCondition(symbol, signal, snapshot.price);
    }

    // Check if new analysis needed
    if (this.shouldAnalyze(snapshot)) {
      await this.analyzeNewOpportunity(symbol, snapshot);
    }
  }

  private shouldAnalyze(snapshot: any): boolean {
    const highVolatility = snapshot.volatility24h >= config.PREFILTER_MIN_VOLATILITY;
    const volumeSpike = snapshot.volumeChange >= config.PREFILTER_MIN_VOLUME_SPIKE;

    return highVolatility || volumeSpike;
  }

  private async analyzeNewOpportunity(symbol: string, snapshot: any): Promise<void> {
    // Check cooldown
    const lastAnalysis = this.lastAnalysisTime.get(symbol) || 0;
    const timeSinceLastAnalysis = Date.now() - lastAnalysis;

    if (timeSinceLastAnalysis < this.ANALYSIS_COOLDOWN_MS) {
      const remainingMinutes = Math.ceil((this.ANALYSIS_COOLDOWN_MS - timeSinceLastAnalysis) / 60000);
      await this.telegram.sendCooldown(symbol, remainingMinutes);
      return;
    }

    // Build trigger reason
    const reasons = [];
    if (snapshot.volatility24h >= config.PREFILTER_MIN_VOLATILITY) {
      reasons.push(`Volatility ${(snapshot.volatility24h * 100).toFixed(2)}%`);
    }
    if (snapshot.volumeChange >= config.PREFILTER_MIN_VOLUME_SPIKE) {
      reasons.push(`Volume ${snapshot.volumeChange.toFixed(1)}x`);
    }
    const triggerReason = reasons.join(', ');

    // Notify analysis start
    await this.telegram.sendAnalysisStart(symbol, triggerReason);
    await this.telegram.sendClaudeRequest(symbol, snapshot.price);

    // Set cooldown
    this.lastAnalysisTime.set(symbol, Date.now());

    try {
      // Analyze with Claude
      const opportunity = await this.analyzer.analyzeOpportunity(
          symbol,
          snapshot.price,
          triggerReason,
          undefined,
          async (toolsUsed) => {
            // Send tool usage to Telegram
            await this.telegram.sendToolUsage(symbol, toolsUsed);
          }
      );

      if (!opportunity) {
        await this.telegram.sendNoOpportunity(symbol);
        return;
      }

      // Validate signal
      if (opportunity.opportunity === 'LONG' || opportunity.opportunity === 'SHORT') {
        if (opportunity.probability < config.MIN_PROBABILITY) {
          await this.telegram.sendRejection(
              symbol,
              `Probability ${opportunity.probability}% below minimum ${config.MIN_PROBABILITY}%`
          );
          return;
        }

        if (opportunity.riskReward && opportunity.riskReward < config.MIN_RISK_REWARD) {
          await this.telegram.sendRejection(
              symbol,
              `R:R ${opportunity.riskReward.toFixed(1)} below minimum ${config.MIN_RISK_REWARD}`
          );
          return;
        }
      }

      // Store and send signal
      this.storage.storeSignal(symbol, opportunity);
      await this.telegram.sendSignal(symbol, opportunity);

    } catch (error: any) {
      await this.telegram.sendError(symbol, `Claude analysis failed: ${error.message}`);
    }
  }

  private async handleTriggeredWatchCondition(
      symbol: string,
      signal: any,
      currentPrice: number
  ): Promise<void> {
    const followupCount = this.storage.incrementFollowup(signal.id);

    if (followupCount > config.MAX_FOLLOWUPS_PER_SIGNAL) {
      this.storage.deactivateSignal(signal.id);
      return;
    }

    // Find triggered condition
    const triggeredCondition = signal.watchConditions.find((cond: any) => {
      if (cond.trigger === 'price_below') return currentPrice < cond.value;
      if (cond.trigger === 'price_above') return currentPrice > cond.value;
      return false;
    });

    const conditionText = triggeredCondition
        ? `${triggeredCondition.trigger.replace('_', ' ')} $${triggeredCondition.value}`
        : 'Watch condition met';

    await this.telegram.sendWatchTriggered(symbol, conditionText);
    await this.telegram.sendClaudeRequest(symbol, currentPrice);

    const followupContext = triggeredCondition
        ? `Previous analysis suggested watching when ${triggeredCondition.trigger} $${triggeredCondition.value}. That condition just triggered. Previous assessment: ${signal.opportunity.reasoning}`
        : `Watch condition triggered.`;

    try {
      const opportunity = await this.analyzer.analyzeOpportunity(
          symbol,
          currentPrice,
          'Watch condition triggered',
          followupContext,
          async (toolsUsed) => {
            await this.telegram.sendToolUsage(symbol, toolsUsed);
          }
      );

      if (!opportunity) {
        await this.telegram.sendNoOpportunity(symbol);
        return;
      }

      await this.telegram.sendFollowup(symbol, conditionText, opportunity);

      // Update or deactivate signal
      if (opportunity.watchConditions && opportunity.watchConditions.length > 0) {
        signal.watchConditions = opportunity.watchConditions;
      } else {
        this.storage.deactivateSignal(signal.id);
      }

    } catch (error: any) {
      await this.telegram.sendError(symbol, `Follow-up analysis failed: ${error.message}`);
    }
  }
}