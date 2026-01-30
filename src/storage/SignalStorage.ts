import type { StoredSignal, WatchCondition } from '../analysis/types.js';
import { randomUUID } from 'crypto';

export class SignalStorage {
  private signals: Map<string, StoredSignal> = new Map();

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
    console.log(`[Storage] Stored signal ${id} for ${symbol}`);
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
      console.log(`[Storage] Deactivated signal ${signalId}`);
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
          console.log(`[Storage] Watch condition triggered for signal ${signal.id}: ${condition.trigger} ${condition.value}`);
          triggered.push(signal);
          break; // Only trigger once per signal
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
