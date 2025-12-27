
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export enum SignalType {
  HAMMER = 'HAMMER',
  SHOOTING_STAR = 'SHOOTING_STAR',
  BULLISH_ENGULFING = 'BULLISH_ENGULFING',
  BEARISH_ENGULFING = 'BEARISH_ENGULFING',
  DOJI = 'DOJI',
  DOUBLE_BOTTOM = 'DOUBLE_BOTTOM',
  DOUBLE_TOP = 'DOUBLE_TOP',
  HEAD_AND_SHOULDERS = 'HEAD_AND_SHOULDERS',
  INVERSE_H_AND_S = 'INVERSE_H_AND_S',
  FAST_REBOUND_BOTTOM = 'FAST_REBOUND_BOTTOM',
  FAST_REJECTION_TOP = 'FAST_REJECTION_TOP',
  BULLISH_INSIDE_BAR = 'BULLISH_INSIDE_BAR',
  BEARISH_INSIDE_BAR = 'BEARISH_INSIDE_BAR',
  MORNING_STAR = 'MORNING_STAR',
  EVENING_STAR = 'EVENING_STAR',
  BULLISH_SPINNING_TOP = 'BULLISH_SPINNING_TOP',
  BEARISH_SPINNING_TOP = 'BEARISH_SPINNING_TOP',
  BOLLINGER_UPPER_REJECTION = 'BOLLINGER_UPPER_REJECTION',
  BOLLINGER_LOWER_REJECTION = 'BOLLINGER_LOWER_REJECTION',
  INSTITUTIONAL_SPRING = 'INSTITUTIONAL_SPRING',
  INSTITUTIONAL_UPTHRUST = 'INSTITUTIONAL_UPTHRUST',
  SUDDEN_REVERSAL_UP = 'SUDDEN_REVERSAL_UP',
  SUDDEN_REVERSAL_DOWN = 'SUDDEN_REVERSAL_DOWN',
  TWEEZERS_TOP = 'TWEEZERS_TOP',
  TWEEZERS_BOTTOM = 'TWEEZERS_BOTTOM',
  NONE = 'NONE'
}

export interface TradingSignal {
  candle: Candle;
  type: SignalType;
  timestamp: number;
  aiConfirmation?: string;
  isConfirmed: boolean;
  score: number; // 0-100
  stochRsi?: number;
}

export interface MarketState {
  symbol: string;
  interval: string;
  lastPrice: number;
  candles: Candle[];
  signals: TradingSignal[];
  isScanning: boolean;
}
