export type OpportunityType = 'LONG' | 'SHORT' | 'WAIT' | 'WATCH';

export type WatchTriggerType = 'price_below' | 'price_above' | 'volume_spike' | 'funding_change';

export interface WatchCondition {
  trigger: WatchTriggerType;
  value: number;
  then: string; // What opportunity emerges when triggered
}

export interface SignalOpportunity {
  opportunity: OpportunityType;
  probability: number;
  reasoning: string;
  entry?: number;
  stopLoss?: number;
  targets?: number[];
  riskReward?: number;
  watchConditions?: WatchCondition[];
  timeValidity?: '4h' | '12h' | '24h';
}

export interface StoredSignal {
  id: string;
  symbol: string;
  timestamp: number;
  opportunity: SignalOpportunity;
  followupCount: number;
  watchConditions: WatchCondition[];
  active: boolean;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  timestamp: number;
  volatility24h: number;
  volumeChange: number;
}
