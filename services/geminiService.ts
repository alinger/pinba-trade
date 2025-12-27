
import { GoogleGenAI, Type } from "@google/genai";
import { Candle, SignalType } from "../types";

export const confirmSignalWithAI = async (
  symbol: string,
  signalType: SignalType,
  contextCandles: Candle[],
  targetCandle: Candle,
  stochRsiValue?: number
): Promise<{ confirmation: string; isConfirmed: boolean; score: number }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const contextStr = contextCandles
    .map(c => `[O:${c.open.toFixed(2)}, H:${c.high.toFixed(2)}, L:${c.low.toFixed(2)}, C:${c.close.toFixed(2)}, V:${c.volume.toFixed(0)}]`)
    .join(', ');

  const prompt = `
    Analyze this ${symbol} reversal setup.
    
    Signal Type: ${signalType}
    StochRSI: ${stochRsiValue?.toFixed(2) || 'N/A'}
    
    MARKET LOGIC GUIDELINES:
    - 'INSTITUTIONAL_SPRING/UPTHRUST': Check for massive volume absorption and structural hunt outside Bollinger Bands.
    - 'TWEEZERS_TOP/BOTTOM': Matching highs or lows across two candles. Does this represent a clear structural wall of rejection?
    - 'SUDDEN_REVERSAL_UP/DOWN': This is a high-momentum "V-Shape" recovery. Did the trend break sharply? Is there a significant volume surge in the reversal candle?
    - 'BULLISH/BEARISH_ENGULFING': Does the current candle completely dominate the previous one at a key pivot level?
    - 'DOJI': Is it occurring at a structural extreme with RSI divergence?
    
    Context (Last 60 bars): ${contextStr}
    Signal Bar Details: O:${targetCandle.open}, H:${targetCandle.high}, L:${targetCandle.low}, C:${targetCandle.close}, V:${targetCandle.volume.toFixed(0)}
    
    Return JSON:
    {
      "isConfirmed": boolean,
      "reason": "Professional structural analysis and confirmation/rejection rationale.",
      "score": number (0-100)
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isConfirmed: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
            score: { type: Type.INTEGER }
          },
          required: ["isConfirmed", "reason", "score"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      isConfirmed: result.isConfirmed || false,
      confirmation: result.reason || "Analysis inconclusive.",
      score: result.score || 0
    };
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return {
      isConfirmed: false,
      confirmation: "AI model disconnected. Technical setup looks high-probability.",
      score: 50
    };
  }
};
