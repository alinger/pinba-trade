import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchKlines, fetchTicker } from './services/binanceService';
import { scanForSignals } from './services/strategyService';
import { confirmSignalWithAI } from './services/geminiService';
import { MarketState, SignalType, TradingSignal, Candle } from './types';
import CandleChart from './components/CandleChart';

const App: React.FC = () => {
  const [state, setState] = useState<MarketState>({
    symbol: 'BTCUSDT',
    interval: '5m',
    lastPrice: 0,
    candles: [],
    signals: [],
    isScanning: false,
  });

  const [analyzingSignalId, setAnalyzingSignalId] = useState<number | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<SignalType>>(new Set(Object.values(SignalType).filter(t => t !== SignalType.NONE)));
  
  // Use ReturnType<typeof setInterval> to avoid NodeJS.Timeout namespace errors in browser environments
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const symbols = ['BTC', 'ETH', 'SOL', 'AAVE', 'BCH', 'LINK'];
  const intervals = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

  const updateMarketData = useCallback(async (currentSymbol?: string, currentInterval?: string) => {
    const activeSymbol = currentSymbol || state.symbol;
    const activeInterval = currentInterval || state.interval;
    
    const candles = await fetchKlines(activeSymbol, activeInterval, 500);
    const lastPrice = await fetchTicker(activeSymbol);
    
    if (candles.length > 0) {
      const detectedSignals = scanForSignals(candles);
      
      setState(prev => ({
        ...prev,
        symbol: activeSymbol,
        interval: activeInterval,
        candles,
        lastPrice,
        signals: detectedSignals.map(newSig => {
          const existing = prev.signals.find(s => s.timestamp === newSig.timestamp);
          return existing ? existing : newSig;
        }).sort((a, b) => b.timestamp - a.timestamp)
      }));
    }
  }, [state.symbol, state.interval]);

  useEffect(() => {
    updateMarketData();
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = setInterval(() => updateMarketData(), 20000); 
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [updateMarketData]);

  const handleSymbolChange = (newSymbol: string) => {
    const fullSymbol = `${newSymbol}USDT`;
    setState(prev => ({ ...prev, symbol: fullSymbol, signals: [] }));
    updateMarketData(fullSymbol, state.interval);
  };

  const handleIntervalChange = (newInterval: string) => {
    setState(prev => ({ ...prev, interval: newInterval, signals: [] }));
    updateMarketData(state.symbol, newInterval);
  };

  const handleAIConfirm = async (signal: TradingSignal) => {
    if (signal.aiConfirmation) return;
    setAnalyzingSignalId(signal.timestamp);
    const index = state.candles.findIndex(c => c.time === signal.timestamp);
    if (index < 60) {
      setAnalyzingSignalId(null);
      return;
    }
    const context = state.candles.slice(Math.max(0, index - 60), index + 2);
    const result = await confirmSignalWithAI(state.symbol, signal.type, context, signal.candle, signal.stochRsi);
    setState(prev => ({
      ...prev,
      signals: prev.signals.map(s => 
        s.timestamp === signal.timestamp 
          ? { ...s, aiConfirmation: result.confirmation, isConfirmed: result.isConfirmed, score: result.score } 
          : s
      )
    }));
    setAnalyzingSignalId(null);
  };

  const toggleFilter = (type: SignalType) => {
    const next = new Set(visibleTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setVisibleTypes(next);
  };

  const getSignalLabel = (type: SignalType) => {
    switch(type) {
      case SignalType.INSTITUTIONAL_SPRING: return "Washout (极端洗盘) ⚡";
      case SignalType.INSTITUTIONAL_UPTHRUST: return "Upthrust (极端诱多) ⚡";
      case SignalType.TWEEZERS_TOP: return "Tweezers Top (镊子顶) ⚔️";
      case SignalType.TWEEZERS_BOTTOM: return "Tweezers Bottom (镊子底) ⚔️";
      case SignalType.SUDDEN_REVERSAL_UP: return "Sudden Reversal Up (突然看涨) 🚀";
      case SignalType.SUDDEN_REVERSAL_DOWN: return "Sudden Reversal Down (突然看跌) 🩸";
      case SignalType.BULLISH_ENGULFING: return "Bullish Engulfing (看涨吞没) 📈";
      case SignalType.BEARISH_ENGULFING: return "Bearish Engulfing (看跌吞没) 📉";
      case SignalType.DOJI: return "Doji Star (十字星) ✨";
      case SignalType.HAMMER: return "Hammer Setup";
      case SignalType.SHOOTING_STAR: return "Shooting Star Setup";
      default: return "Market Reversal";
    }
  };

  const isBullish = (type: SignalType, stochRsi?: number) => {
    if (type === SignalType.DOJI) return (stochRsi || 50) <= 50;
    return [
      SignalType.INSTITUTIONAL_SPRING,
      SignalType.TWEEZERS_BOTTOM,
      SignalType.SUDDEN_REVERSAL_UP,
      SignalType.BULLISH_ENGULFING,
      SignalType.HAMMER, 
      SignalType.BOLLINGER_LOWER_REJECTION
    ].includes(type);
  };

  const filteredSignals = state.signals.filter(s => visibleTypes.has(s.type));

  const filterableTypes = [
    SignalType.INSTITUTIONAL_SPRING,
    SignalType.INSTITUTIONAL_UPTHRUST,
    SignalType.TWEEZERS_BOTTOM,
    SignalType.TWEEZERS_TOP,
    SignalType.SUDDEN_REVERSAL_UP,
    SignalType.SUDDEN_REVERSAL_DOWN,
    SignalType.BULLISH_ENGULFING,
    SignalType.BEARISH_ENGULFING,
    SignalType.DOJI,
    SignalType.HAMMER,
    SignalType.SHOOTING_STAR
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#0b0e11]">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6 border-b border-gray-800 pb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <i className="fas fa-bolt text-yellow-500 text-4xl animate-pulse"></i>
            Washout Radar Pro
            <span className="text-[10px] font-black bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full border border-yellow-500/20 tracking-[0.2em] uppercase">
              Elite Strategy v24.4
            </span>
          </h1>
          <p className="text-gray-500 mt-2 uppercase text-[10px] tracking-[0.4em] font-black italic">Washouts • ECharts Engine • Doji • AI Structural Audit</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="flex bg-[#1e2329] p-1.5 rounded-2xl border border-gray-800 shadow-lg">
            {symbols.map((sym) => (
              <button
                key={sym}
                onClick={() => handleSymbolChange(sym)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  state.symbol.startsWith(sym) 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          <div className="flex bg-[#1e2329] p-1.5 rounded-2xl border border-gray-800 shadow-lg">
            {intervals.map((int) => (
              <button
                key={int}
                onClick={() => handleIntervalChange(int)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  state.interval === int 
                    ? 'bg-yellow-500 text-black shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {int}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6 bg-[#1e2329]/80 backdrop-blur-md p-4 rounded-3xl border border-gray-800 shadow-2xl ml-auto xl:ml-0">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">{state.symbol} LIVE</p>
              <p className={`text-2xl font-mono font-bold tracking-tighter ${state.lastPrice > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                ${state.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </p>
            </div>
            <button onClick={() => updateMarketData()} className="bg-gray-800 hover:bg-yellow-600 p-3.5 rounded-2xl transition-all shadow-lg border border-gray-700">
              <i className="fas fa-sync-alt text-gray-300"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Filter Section */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mr-2">Filters:</span>
        {filterableTypes.map(type => (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
              visibleTypes.has(type)
                ? isBullish(type) ? 'bg-green-500/10 border-green-500/40 text-green-400' : 'bg-red-500/10 border-red-500/40 text-red-400'
                : 'bg-transparent border-gray-800 text-gray-600'
            }`}
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
        <button 
          onClick={() => setVisibleTypes(new Set(filterableTypes))}
          className="text-[9px] font-black text-gray-400 underline uppercase tracking-widest ml-auto"
        >
          Reset All
        </button>
      </div>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#1e2329] rounded-3xl p-6 border border-gray-800 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-black flex items-center gap-3 text-yellow-400 uppercase tracking-widest">
                <i className="fas fa-microchip"></i>
                ECharts Interactive Map ({state.symbol} - {state.interval})
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Live Engine Active</span>
              </div>
            </div>
            <CandleChart candles={state.candles} signals={filteredSignals} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-[#1e2329] p-6 rounded-3xl border border-gray-800">
                <h3 className="text-yellow-400 text-xs font-black uppercase tracking-widest mb-4">Structural Barriers</h3>
                <p className="text-[10px] text-gray-500 leading-relaxed font-bold uppercase mb-4">ECharts integration provides seamless zooming into institutional washout points.</p>
                <ul className="text-[9px] text-gray-400 space-y-2 uppercase font-black">
                   <li><i className="fas fa-bolt text-yellow-500/50 mr-2"></i> High Detail Zoom</li>
                   <li><i className="fas fa-grip-lines text-yellow-500/50 mr-2"></i> Tweezer Rejection</li>
                </ul>
             </div>
             <div className="bg-[#1e2329] p-6 rounded-3xl border border-gray-800">
                <h3 className="text-green-400 text-xs font-black uppercase tracking-widest mb-4">Core Reversals</h3>
                <p className="text-[10px] text-gray-500 leading-relaxed font-bold uppercase mb-4">Precision markers indicate the exact pivot candle for alpha entry.</p>
                <ul className="text-[9px] text-gray-400 space-y-2 uppercase font-black">
                   <li><i className="fas fa-expand-arrows-alt text-green-500/50 mr-2"></i> Engulfing Coverage</li>
                   <li><i className="fas fa-star text-green-500/50 mr-2"></i> Doji Extremes</li>
                </ul>
             </div>
             <div className="bg-[#1e2329] p-6 rounded-3xl border border-gray-800">
                <h3 className="text-blue-400 text-xs font-black uppercase tracking-widest mb-4">AI Verification</h3>
                <p className="text-[10px] text-gray-500 leading-relaxed font-bold uppercase mb-4">Gemini provides an audit layer to verify volume and structural health.</p>
                <ul className="text-[9px] text-gray-400 space-y-2 uppercase font-black">
                   <li><i className="fas fa-robot text-blue-500/50 mr-2"></i> Neural Validation</li>
                   <li><i className="fas fa-shield-alt text-blue-500/50 mr-2"></i> Pattern Audit</li>
                </ul>
             </div>
          </div>
        </div>

        <div className="bg-[#1e2329] rounded-3xl border border-gray-800 shadow-2xl flex flex-col h-full min-h-[700px]">
          <div className="p-8 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-widest">
              <i className="fas fa-satellite-dish text-yellow-400 text-sm"></i>
              Signal Stream
            </h2>
            <span className="text-[9px] font-black text-gray-500 bg-black/40 px-2 py-1 rounded-md uppercase">
              {filteredSignals.length} Active
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {filteredSignals.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                <i className="fas fa-search-dollar text-6xl mb-6"></i>
                <p className="text-[10px] uppercase font-black tracking-widest text-center">No matching setups found...</p>
              </div>
            ) : (
              filteredSignals.map((signal) => (
                <div 
                  key={signal.timestamp} 
                  className={`p-6 rounded-3xl border-2 transition-all hover:bg-white/5 group ${
                    isBullish(signal.type, signal.stochRsi) ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
                  } ${signal.type.includes('INSTITUTIONAL') || signal.type.includes('REVERSAL') || signal.type.includes('TWEEZERS') ? 'ring-2 ring-yellow-500/30' : ''}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      isBullish(signal.type, signal.stochRsi) ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                    }`}>
                      {getSignalLabel(signal.type)}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono font-bold bg-black/50 px-2 py-1 rounded-lg">
                      {new Date(signal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <p className="text-2xl font-mono font-bold text-white tracking-tighter">
                        ${signal.candle.close.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                      <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Entry Pivot</p>
                    </div>
                    {signal.score > 0 && (
                       <div className="text-right">
                         <span className="text-[9px] text-gray-500 uppercase font-bold">Signal Power</span>
                         <p className={`text-xl font-black ${signal.score >= 80 ? 'text-yellow-400' : signal.score >= 60 ? 'text-blue-400' : 'text-red-400'}`}>
                           {signal.score}%
                         </p>
                       </div>
                    )}
                  </div>

                  {!signal.aiConfirmation ? (
                    <button 
                      onClick={() => handleAIConfirm(signal)}
                      disabled={analyzingSignalId === signal.timestamp}
                      className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3 hover:bg-yellow-500 hover:text-black active:scale-95"
                    >
                      {analyzingSignalId === signal.timestamp ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          AUDITING STRUCTURE...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-brain"></i>
                          GEMINI AI VERIFICATION
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-gray-800/50">
                       <div className="flex items-center gap-2 mb-3">
                         <i className={`fas ${signal.isConfirmed ? 'fa-check-circle text-green-400' : 'fa-times-circle text-red-400'} text-[10px]`}></i>
                         <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${signal.isConfirmed ? 'text-green-400' : 'text-red-400'}`}>
                           AI VERDICT: {signal.isConfirmed ? 'CONFIRMED' : 'REJECTED'}
                         </span>
                       </div>
                       <div className="bg-black/60 p-4 rounded-2xl border border-gray-800 font-medium italic text-[11px] text-gray-400 leading-relaxed shadow-inner">
                         "{signal.aiConfirmation}"
                       </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;