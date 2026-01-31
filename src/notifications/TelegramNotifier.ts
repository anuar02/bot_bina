import TelegramBot from 'node-telegram-bot-api';
import type { SignalOpportunity, WatchCondition } from '../analysis/types.js';

export class TelegramNotifier {
  private bot: TelegramBot;
  private chatId: string;

  constructor(token: string, chatId: string) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
  }

  // ============================================
  // 🆕 PROGRESS TRACKING MESSAGES
  // ============================================

  async sendAnalysisStart(symbol: string, trigger: string): Promise<void> {
    const message = `🔥 <b>Analyzing ${symbol}</b>\n${trigger}`;
    await this.send(message);
  }

  async sendClaudeRequest(symbol: string, price: number): Promise<void> {
    const message = `🤖 Asking Claude to analyze ${symbol} at $${price.toLocaleString()}...`;
    await this.send(message);
  }

  async sendToolUsage(symbol: string, toolsUsed: Array<{ name: string; input: any }>): Promise<void> {
    if (toolsUsed.length === 0) {
      const message = `⚠️ <b>Warning:</b> Claude did NOT use MCP tools for ${symbol}\n` +
          `Signal reliability: LOW`;
      await this.send(message);
      return;
    }

    const toolNames = toolsUsed.map(t => {
      const shortName = t.name.replace('Crypto.com:', '');
      return shortName;
    });

    const message = `✅ Claude used <b>${toolsUsed.length} tools</b> for ${symbol}:\n` +
        `${toolNames.join(', ')}`;
    await this.send(message);
  }

  async sendRejection(symbol: string, reason: string): Promise<void> {
    const message = `❌ <b>Signal Rejected</b> - ${symbol}\n${reason}`;
    await this.send(message);
  }

  async sendCooldown(symbol: string, minutesRemaining: number): Promise<void> {
    const message = `⏳ ${symbol} on cooldown (${minutesRemaining}m remaining)`;
    await this.send(message);
  }

  async sendWatchTriggered(symbol: string, condition: string): Promise<void> {
    const message = `🎯 <b>Watch Condition Triggered</b>\n${symbol}: ${condition}`;
    await this.send(message);
  }

  async sendError(symbol: string, error: string): Promise<void> {
    const message = `❌ <b>Error</b> - ${symbol}\n${error}`;
    await this.send(message);
  }

  async sendNoOpportunity(symbol: string): Promise<void> {
    const message = `ℹ️ ${symbol}: Claude found no trading opportunity`;
    await this.send(message);
  }

  // ============================================
  // EXISTING SIGNAL MESSAGES
  // ============================================

  async sendSignal(symbol: string, opportunity: SignalOpportunity): Promise<void> {
    const message = this.formatSignalMessage(symbol, opportunity);
    await this.send(message);
  }

  async sendFollowup(symbol: string, triggerInfo: string, opportunity: SignalOpportunity): Promise<void> {
    const message = `🎯 <b>TRIGGER HIT: ${triggerInfo}</b>\n\n` + this.formatSignalMessage(symbol, opportunity);
    await this.send(message);
  }

  async sendStartup(symbols: string[]): Promise<void> {
    const message = `🤖 <b>Signal System Started</b>\n\n` +
        `📊 Monitoring: ${symbols.join(', ')}\n` +
        `✅ Ready to detect opportunities!`;
    await this.send(message);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async send(message: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
    } catch (error: any) {
      // If HTML parsing fails, retry without formatting
      if (error.response?.body?.description?.includes('parse')) {
        try {
          const plainMessage = this.stripHtmlTags(message);
          await this.bot.sendMessage(this.chatId, plainMessage);
        } catch (retryError) {
          console.error('[Telegram] Failed to send message:', retryError);
        }
      } else {
        console.error('[Telegram] Failed to send message:', error);
      }
    }
  }

  private formatSignalMessage(symbol: string, opp: SignalOpportunity): string {
    const safeReasoning = this.escapeHtml(opp.reasoning);

    if (opp.opportunity === 'LONG' || opp.opportunity === 'SHORT') {
      const emoji = opp.opportunity === 'LONG' ? '🟢' : '🔴';
      const probBar = this.createProbabilityBar(opp.probability);

      return `${emoji} <b>${opp.opportunity} Opportunity (${opp.probability}%)</b> ${probBar}\n\n` +
          `📊 ${symbol}\n` +
          `💵 Entry: $${opp.entry?.toLocaleString()}\n` +
          `🛑 Stop: $${opp.stopLoss?.toLocaleString()}\n` +
          `🎯 Targets: ${opp.targets?.map(t => `$${t.toLocaleString()}`).join(' → ')}\n` +
          `📈 R:R: 1:${opp.riskReward?.toFixed(1)}\n\n` +
          `📝 ${safeReasoning}\n\n` +
          `⏰ Valid: ${opp.timeValidity || '12h'}`;
    }

    if (opp.opportunity === 'WATCH') {
      return `👀 <b>WATCHING ${symbol}</b> (${opp.probability}% potential)\n\n` +
          `📝 ${safeReasoning}\n\n` +
          this.formatWatchConditions(opp.watchConditions || []);
    }

    return `⏸️ <b>WAIT</b> - ${symbol}\n\n` +
        `📝 ${safeReasoning}\n\n` +
        (opp.watchConditions?.length ? this.formatWatchConditions(opp.watchConditions) : '');
  }

  private formatWatchConditions(conditions: WatchCondition[]): string {
    if (conditions.length === 0) return '';

    let text = `🔔 <b>I'll alert you when:</b>\n`;
    for (const cond of conditions) {
      const trigger = this.formatTrigger(cond);
      text += `• ${trigger} → ${cond.then}\n`;
    }
    return text;
  }

  private formatTrigger(cond: WatchCondition): string {
    switch (cond.trigger) {
      case 'price_below':
        return `Price < $${cond.value.toLocaleString()}`;
      case 'price_above':
        return `Price > $${cond.value.toLocaleString()}`;
      case 'volume_spike':
        return `Volume spike (${cond.value}x)`;
      case 'funding_change':
        return `Funding rate changes to ${cond.value}%`;
      default:
        return String(cond.trigger);
    }
  }

  private createProbabilityBar(probability: number): string {
    const filled = Math.round(probability / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
  }

  private stripHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }
}