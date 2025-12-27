
import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Candle, TradingSignal, SignalType } from '../types';

interface CandleChartProps {
  candles: Candle[];
  signals: TradingSignal[];
}

const CandleChart: React.FC<CandleChartProps> = ({ candles, signals }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Resize handler
  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Initialize or update chart
    if (!chartRef.current || candles.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const dates = candles.map(c => echarts.format.formatTime('yyyy-MM-dd hh:mm', c.time));
    const data = candles.map(c => [c.open, c.close, c.low, c.high]);

    // Bollinger Band Calculation
    const BB_PERIOD = 20;
    const BB_STD_DEV = 2.0;
    const upperBB: (number | null)[] = [];
    const middleBB: (number | null)[] = [];
    const lowerBB: (number | null)[] = [];

    for (let i = 0; i < candles.length; i++) {
      if (i < BB_PERIOD - 1) {
        upperBB.push(null);
        middleBB.push(null);
        lowerBB.push(null);
        continue;
      }
      const slice = candles.slice(i - BB_PERIOD + 1, i + 1);
      const prices = slice.map(c => c.close);
      const sma = prices.reduce((a, b) => a + b) / BB_PERIOD;
      const variance = prices.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / BB_PERIOD;
      const stdDev = Math.sqrt(variance);
      middleBB.push(sma);
      upperBB.push(sma + BB_STD_DEV * stdDev);
      lowerBB.push(sma - BB_STD_DEV * stdDev);
    }

    const isBullish = (type: SignalType, stochRsi?: number) => {
      if (type === SignalType.DOJI) return (stochRsi || 50) <= 50;
      return [
        SignalType.INSTITUTIONAL_SPRING,
        SignalType.TWEEZERS_BOTTOM,
        SignalType.SUDDEN_REVERSAL_UP,
        SignalType.HAMMER, 
        SignalType.BULLISH_ENGULFING, 
        SignalType.BOLLINGER_LOWER_REJECTION
      ].includes(type);
    };

    const markPoints = signals.map(sig => {
      const idx = candles.findIndex(c => c.time === sig.timestamp);
      if (idx === -1) return null;
      
      const bullish = isBullish(sig.type, sig.stochRsi);
      const score = sig.score || 50;
      const isHigh = score >= 80;
      const isAI = sig.isConfirmed;
      const color = bullish ? '#2ebd85' : '#f6465d';

      return {
        name: sig.type,
        coord: [dates[idx], bullish ? candles[idx].low : candles[idx].high],
        value: `${sig.type.split('_')[0]}\n${Math.round(score)}%`,
        symbol: bullish ? 'path://M0,10 L5,0 L10,10 Z' : 'path://M0,0 L5,10 L10,0 Z',
        symbolSize: isHigh ? 24 : 14,
        symbolOffset: [0, bullish ? 25 : -25],
        itemStyle: {
          color: color,
          shadowBlur: isHigh ? 15 : 0,
          shadowColor: color,
          opacity: 0.4 + (score / 100) * 0.6,
          borderColor: isAI ? '#fbbf24' : 'transparent',
          borderWidth: isAI ? 2 : 0
        },
        label: {
          show: isHigh,
          position: bullish ? 'bottom' : 'top',
          color: isHigh ? '#fff' : color,
          fontSize: 9,
          fontWeight: 'bold',
          formatter: (params: any) => params.value
        }
      };
    }).filter(p => p !== null);

    const option = {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: '#1e2329',
        borderColor: '#474d57',
        textStyle: { color: '#eaecef', fontSize: 11 },
        formatter: (params: any) => {
          const c = params.find((p: any) => p.seriesName === 'Candlestick');
          if (!c) return '';
          const [o, cl, l, h] = c.data.slice(1);
          const color = cl >= o ? '#2ebd85' : '#f6465d';
          return `
            <div style="font-weight:900; margin-bottom:4px; border-bottom:1px solid #474d57; padding-bottom:4px">${c.name}</div>
            <div style="display:flex; justify-content:space-between; gap:12px">
              <span>OPEN:</span><span style="font-family:monospace">${o.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px">
              <span>HIGH:</span><span style="font-family:monospace">${h.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px">
              <span>LOW:</span><span style="font-family:monospace">${l.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; font-weight:bold; color:${color}">
              <span>CLOSE:</span><span style="font-family:monospace">${cl.toFixed(2)}</span>
            </div>
          `;
        }
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { backgroundColor: '#474d57' }
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '12%',
        top: '5%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#1e2329' } },
        splitLine: { show: false },
        axisLabel: { color: '#474d57', fontSize: 10 }
      },
      yAxis: {
        scale: true,
        position: 'right',
        axisLine: { lineStyle: { color: '#1e2329' } },
        splitLine: { lineStyle: { color: '#1e2329' } },
        axisLabel: { color: '#474d57', fontSize: 10 }
      },
      dataZoom: [
        {
          type: 'inside',
          start: 70,
          end: 100
        },
        {
          show: true,
          type: 'slider',
          top: '92%',
          start: 70,
          end: 100,
          backgroundColor: '#1e2329',
          fillerColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'transparent',
          handleStyle: { color: '#474d57' },
          textStyle: { color: '#474d57' }
        }
      ],
      series: [
        {
          name: 'Candlestick',
          type: 'candlestick',
          data: data,
          itemStyle: {
            color: '#2ebd85',
            color0: '#f6465d',
            borderColor: '#2ebd85',
            borderColor0: '#f6465d'
          },
          markPoint: {
            data: markPoints
          }
        },
        {
          name: 'Upper BB',
          type: 'line',
          data: upperBB,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(59, 130, 246, 0.3)' }
        },
        {
          name: 'Middle BB',
          type: 'line',
          data: middleBB,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(100, 116, 139, 0.2)', type: 'dashed' }
        },
        {
          name: 'Lower BB',
          type: 'line',
          data: lowerBB,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(59, 130, 246, 0.3)' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.05)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' }
            ])
          }
        }
      ]
    };

    chartInstance.current.setOption(option);
  }, [candles, signals]);

  return (
    <div 
      className="bg-[#0b0e11] rounded-2xl border border-gray-800 shadow-inner overflow-hidden relative" 
      style={{ width: '100%', height: '450px' }}
    >
      {candles.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b0e11]/80 backdrop-blur-sm text-gray-500 uppercase tracking-widest text-[10px] font-black">
          Streaming Structural Data...
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default CandleChart;
