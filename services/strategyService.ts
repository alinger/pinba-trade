
import { Candle, SignalType, TradingSignal } from '../types';

/**
 * Institutional Elite Reversal Strategy (v24.1):
 * Enhanced with refined Doji detection and dynamic scoring.
 */

const RECENT_LOOKBACK = 50;
const RSI_PERIOD = 14;
const STOCH_PERIOD = 14;
const BB_PERIOD = 20;
const BB_STD_DEV = 2.0;

const PINBA_WICK_PERCENT = 0.5;
const ULTRA_WICK_RATIO = 3.0; 
const CLIMATIC_VOLUME_MULT = 3; 
const REVERSAL_VOLUME_MULT = 2;
const DOJI_BODY_THRESHOLD = 0.05;
const TWEEZER_TOLERANCE = 0.0001;

const calculateRSIValue = (candles: Candle[], index: number): number => {
  if (index < RSI_PERIOD) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = index - RSI_PERIOD + 1; i <= index; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = (gains / RSI_PERIOD) / (losses / RSI_PERIOD);
  return 100 - (100 / (1 + rs));
};

export const calculateStochRSI = (candles: Candle[], index: number): number => {
  if (index < RSI_PERIOD + STOCH_PERIOD) return 50;
  const rsiValues: number[] = [];
  for (let i = index - STOCH_PERIOD + 1; i <= index; i++) {
    rsiValues.push(calculateRSIValue(candles, i));
  }
  const currentRsi = rsiValues[rsiValues.length - 1];
  const minRsi = Math.min(...rsiValues);
  const maxRsi = Math.max(...rsiValues);
  if (maxRsi === minRsi) return 0;
  return ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
};
//布林带
const calculateBollingerBands = (candles: Candle[], index: number) => {
  if (index < BB_PERIOD) return null;
  const slice = candles.slice(index - BB_PERIOD + 1, index + 1);
  const sma = slice.reduce((sum, c) => sum + c.close, 0) / BB_PERIOD;
  const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - sma, 2), 0) / BB_PERIOD;
  const stdDev = Math.sqrt(variance);
  return {
    middle: sma,
    upper: sma + (BB_STD_DEV * stdDev),
    lower: sma - (BB_STD_DEV * stdDev)
  };
};

export const detectSignal = (candles: Candle[], index: number): { type: SignalType, stochRsi: number, score: number } => {
  if (index < RECENT_LOOKBACK || index > candles.length - 2) return { type: SignalType.NONE, stochRsi: 50, score: 0 };

  const curr = candles[index];
  const prev = candles[index - 1];
  const prev2 = candles[index - 2];
  const next = candles[index + 1];
  const stochRsi = calculateStochRSI(candles, index);
  const bb = calculateBollingerBands(candles, index);
  
  const range = curr.high - curr.low;
  if (range === 0) return { type: SignalType.NONE, stochRsi, score: 0 };

  const body = Math.max(0.0001, Math.abs(curr.close - curr.open));
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;

  const recentSlices = candles.slice(index - RECENT_LOOKBACK, index);
  const avgVol = recentSlices.reduce((sum, c) => sum + c.volume, 0) / RECENT_LOOKBACK;
  const recentLow = Math.min(...recentSlices.map(c => c.low));
  const recentHigh = Math.max(...recentSlices.map(c => c.high));
  const volMult = curr.volume / avgVol;

  let finalScore = 0;

  // 1. CLIMATIC INSTITUTIONAL SPRING（向下流动性掠杀）
  if (bb && lowerWick > body * ULTRA_WICK_RATIO && stochRsi < 20) {
    const isDeepSweep = curr.low < recentLow;
    if (volMult > CLIMATIC_VOLUME_MULT && isDeepSweep && curr.low < bb.lower && next.close > curr.low) {
      finalScore = 60 + Math.min(20, (volMult - 2) * 10) + (isDeepSweep ? 10 : 0) + (stochRsi < 15 ? 10 : 0);
      return { type: SignalType.INSTITUTIONAL_SPRING, stochRsi, score: Math.min(95, finalScore) };
    }
  }

  // INSTITUTIONAL UPTHRUST （向上流动性掠杀）
  if (bb && upperWick > body * ULTRA_WICK_RATIO && stochRsi > 80) {
    const isDeepSweep = curr.high > recentHigh;
    if (volMult > CLIMATIC_VOLUME_MULT && isDeepSweep && curr.high > bb.upper && next.close < curr.high ) {
      finalScore = 60 + Math.min(20, (volMult - 2) * 10) + (isDeepSweep ? 10 : 0) + (stochRsi > 85 ? 10 : 0);
      return { type: SignalType.INSTITUTIONAL_UPTHRUST, stochRsi, score: Math.min(95, finalScore) };
    }
  }

  // 2. TWEEZERS（镊子型）
  const highsDiff = Math.abs(curr.high - prev.high) / curr.high;
  if (highsDiff < TWEEZER_TOLERANCE && prev.close > prev.open && curr.close < curr.open && stochRsi > 85 && curr.high >= recentHigh) {
    const volBonus = curr.volume > avgVol * 1.5 ? 15 : 0;
    finalScore = 50 + (stochRsi > 90 ? 15 : 5) + volBonus + (highsDiff < 0.00005 ? 10 : 0);
    return { type: SignalType.TWEEZERS_TOP, stochRsi, score: finalScore };
  }
  const lowsDiff = Math.abs(curr.low - prev.low) / curr.low;
  if (lowsDiff < TWEEZER_TOLERANCE && prev.close < prev.open && curr.close > curr.open && stochRsi < 15 && curr.low <= recentLow) {
    const volBonus = curr.volume > avgVol * 1.5 ? 15 : 0;
    finalScore = 50 + (stochRsi < 10 ? 15 : 5) + volBonus + (lowsDiff < 0.00005 ? 10 : 0);
    return { type: SignalType.TWEEZERS_BOTTOM, stochRsi, score: finalScore };
  }

  // 3. SUDDEN REVERSAL
  //看涨反转
  if (prev.close < prev.open && prev2.close < prev2.open && stochRsi < 20) {
    if (curr.close > curr.open && curr.close > prev.open && volMult > REVERSAL_VOLUME_MULT) {
        finalScore = 45 + Math.min(25, (volMult - 1) * 15) + (curr.close > prev2.open ? 15 : 5);
        return { type: SignalType.SUDDEN_REVERSAL_UP, stochRsi, score: finalScore };
    }
  }
  //看跌反转
  if (prev.close > prev.open && prev2.close > prev2.open && stochRsi > 80) {
    if (curr.close < curr.open && curr.close < prev.open && volMult > REVERSAL_VOLUME_MULT) {
        finalScore = 45 + Math.min(25, (volMult - 1) * 15) + (curr.close < prev2.open ? 15 : 5);
        return { type: SignalType.SUDDEN_REVERSAL_DOWN, stochRsi, score: finalScore };
    }
  }

  // 4. ENGULFING SIGNALS(看涨吞没)
  const prevBody = Math.abs(prev.close - prev.open);
  if (curr.close > curr.open && prev.close < prev.open && body > prevBody) {
    if (stochRsi < 20 && curr.low <= recentLow) {
      finalScore = 40 + (volMult > 1.2 ? 15 : 0) + (body / prevBody > 1.5 ? 20 : 10);
      return { type: SignalType.BULLISH_ENGULFING, stochRsi, score: finalScore };
    }
  }
  //（看跌吞没）
  if (curr.close < curr.open && prev.close > prev.open &&  body > prevBody) {
    if (stochRsi > 80 && curr.high >= recentHigh) {
      finalScore = 40 + (volMult > 1.2 ? 15 : 0) + (body / prevBody > 1.5 ? 20 : 10);
      return { type: SignalType.BEARISH_ENGULFING, stochRsi, score: finalScore };
    }
  }

  // 5. CLASSIC PINBARS (HAMMER / SHOOTING STAR)
  //（锤子）
  if (lowerWick >= range * PINBA_WICK_PERCENT && stochRsi <= 20 && curr.low <= recentLow && next.close > next.open) {
    finalScore = 35 + (lowerWick / body > 2 ? 20 : 10) + (volMult > 1.2 ? 15 : 0);
    return { type: SignalType.HAMMER, stochRsi, score: finalScore };
  }
  //黄昏星
  if (upperWick >= range * PINBA_WICK_PERCENT && stochRsi >= 80 && curr.high >= recentHigh && next.close < next.open) {
    finalScore = 35 + (upperWick / body > 2 ? 20 : 10) + (volMult > 1.2 ? 15 : 0);
    return { type: SignalType.SHOOTING_STAR, stochRsi, score: finalScore };
  }

  // 6. DOJI DETECTION（十字星）
  if (body / range < DOJI_BODY_THRESHOLD && (curr.low <= recentLow || curr.high >= recentHigh)) {
    const isExtreme = stochRsi < 20 || stochRsi > 80;
    finalScore = 30 + (isExtreme ? 30 : 0) + (volMult > 1.5 ? 15 : 0);
    return { type: SignalType.DOJI, stochRsi, score: finalScore };
  }

  return { type: SignalType.NONE, stochRsi, score: 0 };
};

export const scanForSignals = (candles: Candle[]): TradingSignal[] => {
  const signals: TradingSignal[] = [];
  for (let i = 25; i < candles.length - 1; i++) {
    const { type, stochRsi, score } = detectSignal(candles, i);
    if (type !== SignalType.NONE) {
      signals.push({
        candle: candles[i],
        type,
        timestamp: candles[i].time,
        isConfirmed: false,
        score: score,
        stochRsi,
      });
    }
  }
  return signals;
};
