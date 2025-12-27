
import { Candle } from '../types';

export const fetchKlines = async (symbol: string = 'BTCUSDT', interval: string = '5m', limit: number = 100): Promise<Candle[]> => {
  try {
    const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    const data = await response.json();
    
    return data.map((d: any) => ({
      time: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch (error) {
    console.error('Error fetching Binance data:', error);
    return [];
  }
};

export const fetchTicker = async (symbol: string = 'BTCUSDT'): Promise<number> => {
  try {
    const response = await fetch(`https://fapi.binance.com/fapi/v2/ticker/price?symbol=${symbol}`);
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('Error fetching ticker:', error);
    return 0;
  }
};
