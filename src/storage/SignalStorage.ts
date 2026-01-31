import type { StoredSignal, WatchCondition } from '../analysis/types.js';
import type { TelegramNotifier } from '../notifications/TelegramNotifier.js';
import { randomUUID } from 'crypto';

export class SignalStorage {
  private signals: Map<string, StoredSignal> = new Map();
  private telegram: TelegramNotifier;

  constructor(telegram: TelegramNotifier) {
    this.telegram = telegram;
  }

  storeSignal(symbol: string, opportunity: any): string {
    const id = randomUUID();
    const signal: StoredSignal = {
      id,
      symbol,
      timestamp: Date.now(),
      opportunity,
      followupCount: 0,
      watchConditions: opportunity.watchConditions || [],
      active: true
    };

    this.signals.set(id, signal);
    return id;
  }

  getActiveSignals(symbol: string): StoredSignal[] {
    return Array.from(this.signals.values())
        .filter(s => s.symbol === symbol && s.active);
  }

  incrementFollowup(signalId: string): number {
    const signal = this.signals.get(signalId);
    if (signal) {
      signal.followupCount++;
      return signal.followupCount;
    }
    return 0;
  }

  deactivateSignal(signalId: string): void {
    const signal = this.signals.get(signalId);
    if (signal) {
      signal.active = false;
    }
  }

  checkWatchConditions(symbol: string, currentPrice: number, volumeSpike: boolean): StoredSignal[] {
    const triggered: StoredSignal[] = [];

    for (const signal of this.signals.values()) {
      if (signal.symbol !== symbol || !signal.active || signal.watchConditions.length === 0) {
        continue;
      }

      for (const condition of signal.watchConditions) {
        let isTriggered = false;

        switch (condition.trigger) {
          case 'price_below':
            isTriggered = currentPrice < condition.value;
            break;
          case 'price_above':
            isTriggered = currentPrice > condition.value;
            break;
          case 'volume_spike':
            isTriggered = volumeSpike;
            break;
        }

        if (isTriggered) {
          triggered.push(signal);
          break;
        }
      }
    }

    return triggered;
  }

  getAllActiveWatchConditions(symbol: string): WatchCondition[] {
    const conditions: WatchCondition[] = [];
    for (const signal of this.signals.values()) {
      if (signal.symbol === symbol && signal.active) {
        conditions.push(...signal.watchConditions);
      }
    }
    return conditions;
  }
}