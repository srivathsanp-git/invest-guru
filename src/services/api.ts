import { AssetData, SP500Row } from '../types';
import { sampleAsset, sp500Screen } from '../data/mockData';

const FMP_API_KEY = import.meta.env.VITE_FMP_API_KEY;
const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

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
  console.log('getAssetData called with symbol:', symbol);
  console.log('FMP_API_KEY available:', !!FMP_API_KEY);
  
  if (!FMP_API_KEY) {
    console.log('No API key, generating mock data for:', symbol);
    return createMockAsset(symbol);
  }

  try {
    console.log('Fetching live data from FMP API for:', symbol);
    const [profile, quote, ratios, history] = await Promise.all([
      safeFetch<any[]>(`${FMP_BASE}/profile/${symbol}?apikey=${FMP_API_KEY}`),
      safeFetch<any[]>(`${FMP_BASE}/quote/${symbol}?apikey=${FMP_API_KEY}`),
      safeFetch<any[]>(`${FMP_BASE}/ratios/${symbol}?apikey=${FMP_API_KEY}`),
      safeFetch<any>(`${FMP_BASE}/historical-price-full/${symbol}?timeseries=250&apikey=${FMP_API_KEY}`)
    ]);

    const prof = profile[0];
    const quot = quote[0];
    const rat = ratios[0];
    const hist = history.historical.slice(0, 250).reverse().map((h: any) => ({ date: h.date, close: h.close }));

    // Calculate MAs
    const closes = hist.map((p: any) => p.close);
    const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50 : quot.price;
    const ma100 = closes.length >= 100 ? closes.slice(-100).reduce((a: number, b: number) => a + b, 0) / 100 : quot.price;
    const ma200 = closes.length >= 200 ? closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200 : quot.price;

    const result: AssetData = {
      symbol,
      name: prof.companyName,
      type: 'Stock',
      price: quot.price,
      change: quot.change,
      week52High: quot.yearHigh,
      week52Low: quot.yearLow,
      ma50,
      ma100,
      ma200,
      metrics: {
        pe: rat?.priceEarningsRatio || 0,
        pb: rat?.priceToBookRatio || 0,
        roe: rat?.returnOnEquity || 0,
        dividendYield: rat?.dividendYield || 0,
        marketCap: quot.marketCap || 0,
        expenseRatio: 0
      },
      analystRating: {
        buy: 0,
        hold: 0,
        sell: 0,
        consensus: 'N/A'
      },
      insiderTrades: [],
      performance: {
        '1m': calcReturn(hist.slice(-30), 0.083),
        '3m': calcReturn(hist.slice(-90), 0.25),
        'ytd': calcReturn(hist.filter((p: any) => p.date >= '2026-01-01'), 0.2),
        '1y': calcReturn(hist.slice(-250), 1),
        '5y': calcReturn(hist, 5),
        lifetime: calcReturn(hist, 10)
      },
      history: hist.map((p: any, i: number) => ({
        ...p,
        ma50: i >= 49 ? closes.slice(Math.max(0, i-49), i+1).reduce((a: number, b: number) => a + b, 0) / Math.min(50, i+1) : undefined,
        ma100: i >= 99 ? closes.slice(Math.max(0, i-99), i+1).reduce((a: number, b: number) => a + b, 0) / Math.min(100, i+1) : undefined,
        ma200: i >= 199 ? closes.slice(Math.max(0, i-199), i+1).reduce((a: number, b: number) => a + b, 0) / Math.min(200, i+1) : undefined
      }))
    };
    return result;
  } catch (error) {
    console.warn('FMP fetch failed, falling back to generated mock asset', error);
    return createMockAsset(symbol);
  }
}

export async function getSP500Screener(): Promise<SP500Row[]> {
  if (!FMP_API_KEY) {
    return sp500Screen;
  }

  try {
    const constituents = await safeFetch<any[]>(`${FMP_BASE}/sp500_constituent?apikey=${FMP_API_KEY}`);
    const symbols = constituents.slice(0, 25).map(c => c.symbol);
    const quotes = await Promise.all(symbols.map(sym => safeFetch<any[]>(`${FMP_BASE}/quote/${sym}?apikey=${FMP_API_KEY}`).then(q => q[0] || {})));
    const ratios = await Promise.all(symbols.map(sym => safeFetch<any[]>(`${FMP_BASE}/ratios/${sym}?apikey=${FMP_API_KEY}`).then(r => r[0] || {})));

    return quotes.map((q, i) => {
      const r = ratios[i];
      return {
        symbol: q.symbol || symbols[i],
        price: q.price || 0,
        week52High: q.yearHigh || 0,
        week52Low: q.yearLow || 0,
        ma50: q.price ? q.price * 0.95 : 0,
        ma100: q.price ? q.price * 0.9 : 0,
        ma200: q.price ? q.price * 0.85 : 0,
        metrics: {
          pe: r?.priceEarningsRatio || 0,
          pb: r?.priceToBookRatio || 0,
          roe: r?.returnOnEquity || 0,
          dividendYield: r?.dividendYield || 0,
          marketCap: q.marketCap || 0,
          expenseRatio: 0
        },
        analystRating: {
          buy: 0,
          hold: 0,
          sell: 0,
          consensus: 'N/A'
        }
      };
    });
  } catch (err) {
    console.warn('S&P screen fetch failed', err);
    return sp500Screen;
  }
}
