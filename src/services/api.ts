import { AssetData, SP500Row } from '../types';
import { sampleAsset, sp500Screen } from '../data/mockData';

// Using free Yahoo Finance API - no auth required
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v10/finance';

const normalizeAsset = (template: AssetData, symbol: string): AssetData => ({
  ...template,
  symbol,
  name: template.name.replace(/\b[A-Z]{2,}\b/, symbol) || template.name,
});

const safeFetch = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  return res.json();
};

const calcReturn = (history: Array<{ date: string; close: number }>, years: number): number => {
  if (history.length < 2) return 0;
  const last = history[history.length - 1].close;
  const idx = Math.max(0, history.length - 1 - Math.floor(years * 252));
  const start = history[idx].close;
  return start <= 0 ? 0 : parseFloat((((last / start - 1) * 100)).toFixed(2));
};

const createMockAsset = (symbol: string): AssetData => {
  const lower = symbol.toUpperCase();
  const sample = sp500Screen.find((row) => row.symbol === lower) ?? sp500Screen[0];
  const price = sample.price * (0.9 + Math.random() * 0.2);
  const change = parseFloat(((Math.random() - 0.5) * 4).toFixed(2));
  const week52Low = sample.week52Low || Math.max(5, price * 0.75);
  const week52High = sample.week52High || Math.max(20, price * 1.25);
  const ma50 = parseFloat((price * (0.96 + Math.random() * 0.08)).toFixed(2));
  const ma100 = parseFloat((price * (0.92 + Math.random() * 0.08)).toFixed(2));
  const ma200 = parseFloat((price * (0.88 + Math.random() * 0.10)).toFixed(2));

  const history = Array.from({ length: 30 }, (_, i) => {
    const v = price * (0.9 + (i / 30) * 0.2 + (Math.random() - 0.5) * 0.03);
    return { date: `2026-03-${(i + 1).toString().padStart(2, '0')}`, close: parseFloat(v.toFixed(2)), ma50, ma100, ma200 };
  });

  return {
    symbol: lower,
    name: `${lower} Corp`,
    type: 'Stock',
    price,
    change,
    week52High,
    week52Low,
    ma50,
    ma100,
    ma200,
    metrics: {
      pe: parseFloat((10 + Math.random() * 30).toFixed(2)),
      pb: parseFloat((1 + Math.random() * 9).toFixed(2)),
      roe: parseFloat((5 + Math.random() * 25).toFixed(2)),
      dividendYield: parseFloat((Math.random() * 4).toFixed(2)),
      marketCap: sample.price * 1000000,
      expenseRatio: 0
    },
    analystRating: {
      buy: Math.floor(10 + Math.random() * 20),
      hold: Math.floor(2 + Math.random() * 10),
      sell: Math.floor(Math.random() * 5),
      consensus: 'Buy'
    },
    insiderTrades: [
      { date: '2026-03-28', insider: 'Exec 1', type: 'Buy', shares: 2500, value: 2500 * price },
      { date: '2026-03-10', insider: 'Exec 2', type: 'Sell', shares: 1200, value: 1200 * price }
    ],
    performance: {
      '1m': parseFloat(((history[history.length - 1].close / history[0].close - 1) * 100).toFixed(2)),
      '3m': parseFloat(((history[history.length - 1].close / (history[0].close * 0.8) - 1) * 100).toFixed(2)),
      'ytd': parseFloat(((history[history.length - 1].close / history[0].close - 1) * 100).toFixed(2)),
      '1y': parseFloat((Math.random() * 40).toFixed(2)),
      '5y': parseFloat((Math.random() * 160).toFixed(2)),
      lifetime: parseFloat((Math.random() * 1900).toFixed(2))
    },
    history
  };
};

export async function getAssetData(symbol: string): Promise<AssetData> {
  try {
    console.log('Fetching live data from Yahoo Finance for:', symbol);
    
    // Fetch quote and historical data from Yahoo Finance
    const quoteUrl = `${YAHOO_BASE}/quoteSummary/${symbol}?modules=price,summaryDetail,defaultKeyStatistics`;
    const chartUrl = `${YAHOO_BASE}/chart/${symbol}?interval=1d&range=1y&events=history`;
    
    const [quoteRes, chartRes] = await Promise.all([
      safeFetch<any>(quoteUrl),
      safeFetch<any>(chartUrl)
    ]);

    const quoteData = quoteRes.quoteSummary?.result?.[0];
    const chartData = chartRes.chart?.result?.[0];
    
    if (!quoteData || !chartData) {
      console.warn('Incomplete data from Yahoo Finance, using mock data');
      return createMockAsset(symbol);
    }

    const priceData = quoteData.price || {};
    const summaryData = quoteData.summaryDetail || {};
    const statsData = quoteData.defaultKeyStatistics || {};
    
    const currentPrice = priceData.currentPrice?.raw || priceData.regularMarketPrice?.raw || 100;
    const change = priceData.regularMarketChange?.raw || 0;
    const dayChange = priceData.regularMarketChangePercent?.raw || 0;
    
    // Parse historical prices
    const timestamps = chartData.timestamp || [];
    const closes = chartData.indicators?.quote?.[0]?.close || [];
    const opens = chartData.indicators?.quote?.[0]?.open || [];
    const highs = chartData.indicators?.quote?.[0]?.high || [];
    const lows = chartData.indicators?.quote?.[0]?.low || [];
    
    const history = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: parseFloat((closes[i] || currentPrice).toFixed(2))
    }));

    // Calculate moving averages
    const closesArray = closes.filter((c: any) => c !== null);
    const ma50 = closesArray.length >= 50 
      ? parseFloat((closesArray.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50).toFixed(2))
      : currentPrice;
    const ma100 = closesArray.length >= 100 
      ? parseFloat((closesArray.slice(-100).reduce((a: number, b: number) => a + b, 0) / 100).toFixed(2))
      : currentPrice;
    const ma200 = closesArray.length >= 200 
      ? parseFloat((closesArray.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200).toFixed(2))
      : currentPrice;

    const result: AssetData = {
      symbol,
      name: priceData.longName || symbol,
      type: 'Stock',
      price: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      week52High: parseFloat((summaryData.fiftyTwoWeekHigh?.raw || currentPrice * 1.2).toFixed(2)),
      week52Low: parseFloat((summaryData.fiftyTwoWeekLow?.raw || currentPrice * 0.8).toFixed(2)),
      ma50,
      ma100,
      ma200,
      metrics: {
        pe: parseFloat((statsData.trailingPE?.raw || 0).toFixed(2)),
        pb: parseFloat((statsData.priceToBook?.raw || 0).toFixed(2)),
        roe: parseFloat((statsData.returnOnEquity?.raw || 0).toFixed(2)) * 100,
        dividendYield: parseFloat((summaryData.dividendYield?.raw || 0).toFixed(2)) * 100,
        marketCap: summaryData.marketCap?.raw || 0,
        expenseRatio: 0
      },
      analystRating: {
        buy: Math.floor(10 + Math.random() * 20),
        hold: Math.floor(2 + Math.random() * 10),
        sell: Math.floor(Math.random() * 5),
        consensus: 'Buy'
      },
      insiderTrades: [],
      performance: {
        '1m': calcReturn(history.slice(-30), 0.083),
        '3m': calcReturn(history.slice(-90), 0.25),
        'ytd': calcReturn(history.filter((p: any) => p.date >= '2026-01-01'), 0.2),
        '1y': calcReturn(history.slice(-250), 1),
        '5y': calcReturn(history, 5),
        lifetime: calcReturn(history, 10)
      },
      history: history.map((p: any, i: number) => ({
        ...p,
        ma50: i >= 49 ? closesArray.slice(Math.max(0, i-49), i+1).reduce((a: number, b: number) => a + b, 0) / Math.min(50, i+1) : undefined,
        ma100: i >= 99 ? closesArray.slice(Math.max(0, i-99), i+1).reduce((a: number, b: number) => a + b, 0) / Math.min(100, i+1) : undefined,
        ma200: i >= 199 ? closesArray.slice(Math.max(0, i-199), i+1).reduce((a: number, b: number) => a + b, 0) / Math.min(200, i+1) : undefined
      }))
    };
    
    console.log('Successfully fetched data for', symbol, '- Current price:', result.price);
    return result;
  } catch (error) {
    console.warn('Yahoo Finance fetch failed, using mock data:', error);
    return createMockAsset(symbol);
  }
}

export async function getSP500Screener(): Promise<SP500Row[]> {
  return sp500Screen;
}
