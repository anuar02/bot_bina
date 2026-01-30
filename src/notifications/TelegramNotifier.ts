import TelegramBot from 'node-telegram-bot-api';
import type { SignalOpportunity, WatchCondition } from '../analysis/types.js';
import {generateSparklineUrl} from "../utils/chart.js";

export class TelegramNotifier {
  private bot: TelegramBot;
  private chatId: string;

  constructor(token: string, chatId: string) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
  }

  async sendSignal(symbol: string, opportunity: SignalOpportunity): Promise<void> {
    const message = this.formatSignalMessage(symbol, opportunity);
    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
      console.log('[Telegram] Signal sent');
    } catch (error) {
      console.error('[Telegram] Failed to send message:', error);
    }
  }




  async sendFollowup(symbol: string, triggerInfo: string, opportunity: SignalOpportunity): Promise<void> {
    const message = `🎯 <b>TRIGGER HIT: ${triggerInfo}</b>\n\n` + this.formatSignalMessage(symbol, opportunity);
    
    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
      console.log('[Telegram] Follow-up sent');
    } catch (error) {
      console.error('[Telegram] Failed to send follow-up:', error);
    }
  }

  async sendStartup(symbols: string[]): Promise<void> {
    const message = `🤖 <b>Signal System Started</b>\n\n` +
      `📊 Monitoring: ${symbols.join(', ')}\n` +
      `✅ Ready to detect opportunities!`;
    
    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('[Telegram] Failed to send startup message');
    }
  }

  async sendTriggerAlert(symbol: string, prices: number[], analysisData: { volatility: string, volumeChange: number }): Promise<void> {
    const chartUrl = generateSparklineUrl(prices);

    const caption = `🔥 <b>PRE-FILTER TRIGGERED</b>\n` +
        `📊 <b>${symbol}</b>\n` +
        `🌊 Volatility: ${analysisData.volatility}%\n` +
        `📢 Volume Spike: ${analysisData.volumeChange}x\n\n` +
        `🤖 <i>Waking up Claude for analysis...</i>`;

    try {
      // node-telegram-bot-api handles URLs automatically
      await this.bot.sendPhoto(this.chatId, chartUrl, {
        caption: caption,
        parse_mode: 'HTML'
      });
      console.log(`[Telegram] Trigger alert sent for ${symbol}`);
    } catch (error) {
      console.error('[Telegram] Failed to send trigger photo:', error);
    }
  }

  private formatSignalMessage(symbol: string, opp: SignalOpportunity): string {
    if (opp.opportunity === 'LONG' || opp.opportunity === 'SHORT') {
      const emoji = opp.opportunity === 'LONG' ? '🟢' : '🔴';
      const probBar = this.createProbabilityBar(opp.probability);
      
      return `${emoji} <b>${opp.opportunity} Opportunity (${opp.probability}%)</b> ${probBar}\n\n` +
        `📊 ${symbol}\n` +
        `💵 Entry: $${opp.entry?.toLocaleString()}\n` +
        `🛑 Stop: $${opp.stopLoss?.toLocaleString()}\n` +
        `🎯 Targets: ${opp.targets?.map(t => `$${t.toLocaleString()}`).join(' → ')}\n` +
        `📈 R:R: 1:${opp.riskReward?.toFixed(1)}\n\n` +
        `📝 ${opp.reasoning}\n\n` +
        `⏰ Valid: ${opp.timeValidity || '12h'}`;
    }

    if (opp.opportunity === 'WATCH') {
      return `👀 <b>WATCHING ${symbol}</b> (${opp.probability}% potential)\n\n` +
        `📝 ${opp.reasoning}\n\n` +
        this.formatWatchConditions(opp.watchConditions || []);
    }

    // WAIT
    return `⏸️ <b>WAIT</b> - ${symbol}\n\n` +
      `📝 ${opp.reasoning}\n\n` +
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
}
