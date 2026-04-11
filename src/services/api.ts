import { AssetData, SP500Row } from '../types';
import { sampleAsset, sp500Screen } from '../data/mockData';
import { sp500Symbols } from '../data/sp500Symbols';

const ALPHAVANTAGE_API_KEY = import.meta.env.VITE_ALPHAVANTAGE_API_KEY;
const ALPHAVANTAGE_BASE = 'https://www.alphavantage.co/query';

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
  if (!ALPHAVANTAGE_API_KEY) {
    console.warn('No Alpha Vantage API key configured, using mock data for', symbol);
    return createMockAsset(symbol);
  }

  try {
    const overviewUrl = `${ALPHAVANTAGE_BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHAVANTAGE_API_KEY}`;
    const dailyUrl = `${ALPHAVANTAGE_BASE}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${ALPHAVANTAGE_API_KEY}`;

    const [overviewRes, dailyRes] = await Promise.all([
      safeFetch<any>(overviewUrl),
      safeFetch<any>(dailyUrl)
    ]);

    if (overviewRes.Note || overviewRes['Error Message'] || dailyRes.Note || dailyRes['Error Message']) {
      throw new Error(overviewRes.Note || overviewRes['Error Message'] || dailyRes.Note || dailyRes['Error Message']);
    }

    const timeSeries = dailyRes['Time Series (Daily)'];
    if (!timeSeries) {
      throw new Error('Alpha Vantage returned no daily series for ' + symbol);
    }

    const historyDates = Object.keys(timeSeries).sort((a, b) => a.localeCompare(b));
    const history = historyDates.map((date) => ({
      date,
      close: parseFloat(timeSeries[date]['4. close'])
    }));

    const latest = history[history.length - 1];
    const previous = history[history.length - 2] || latest;
    const currentPrice = latest.close;
    const change = parseFloat((((currentPrice - previous.close) / previous.close) * 100).toFixed(2));

    const recent = history.slice(-252);
    const week52High = parseFloat(Math.max(...recent.map((item) => item.close)).toFixed(2));
    const week52Low = parseFloat(Math.min(...recent.map((item) => item.close)).toFixed(2));

    const closes = history.map((item) => item.close);
    const ma50 = closes.length >= 50 ? parseFloat((closes.slice(-50).reduce((a, b) => a + b, 0) / 50).toFixed(2)) : currentPrice;
    const ma100 = closes.length >= 100 ? parseFloat((closes.slice(-100).reduce((a, b) => a + b, 0) / 100).toFixed(2)) : currentPrice;
    const ma200 = closes.length >= 200 ? parseFloat((closes.slice(-200).reduce((a, b) => a + b, 0) / 200).toFixed(2)) : currentPrice;

    const name = overviewRes.Name || `${symbol} Inc.`;
    const pe = parseFloat(overviewRes.PERatio || '0');
    const pb = parseFloat(overviewRes.PriceToBookRatio || '0');
    const roe = parseFloat(overviewRes.ReturnOnEquityTTM || '0');
    const dividendYield = parseFloat(overviewRes.DividendYield || '0');
    const marketCap = parseFloat(overviewRes.MarketCapitalization || '0');

    const result: AssetData = {
      symbol,
      name,
      type: 'Stock',
      price: currentPrice,
      change,
      week52High,
      week52Low,
      ma50,
      ma100,
      ma200,
      metrics: {
        pe,
        pb,
        roe,
        dividendYield,
        marketCap,
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
        '1m': calcReturn(history.slice(-22), 0.083),
        '3m': calcReturn(history.slice(-66), 0.25),
        'ytd': calcReturn(history.filter((p: any) => p.date >= '2026-01-01'), 0.2),
        '1y': calcReturn(history.slice(-252), 1),
        '5y': calcReturn(history.slice(-1250), 5),
        lifetime: calcReturn(history, 10)
      },
      history: history.map((p: any, i: number) => ({
        ...p,
        ma50: i >= 49 ? closes.slice(Math.max(0, i - 49), i + 1).reduce((a, b) => a + b, 0) / Math.min(50, i + 1) : undefined,
        ma100: i >= 99 ? closes.slice(Math.max(0, i - 99), i + 1).reduce((a, b) => a + b, 0) / Math.min(100, i + 1) : undefined,
        ma200: i >= 199 ? closes.slice(Math.max(0, i - 199), i + 1).reduce((a, b) => a + b, 0) / Math.min(200, i + 1) : undefined
      }))
    };

    return result;
  } catch (error) {
    console.warn('Alpha Vantage fetch failed, falling back to mock data', error);
    return createMockAsset(symbol);
  }
}

export async function getSP500Screener(): Promise<SP500Row[]> {
  if (!ALPHAVANTAGE_API_KEY) return sp500Screen;

  const symbols = sp500Symbols.slice(0, 5);
  const rows: SP500Row[] = [];

  for (const symbol of symbols) {
    try {
      const dailyUrl = `${ALPHAVANTAGE_BASE}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=compact&apikey=${ALPHAVANTAGE_API_KEY}`;
      const dailyRes = await safeFetch<any>(dailyUrl);
      if (dailyRes.Note || dailyRes['Error Message']) {
        throw new Error(dailyRes.Note || dailyRes['Error Message'] || 'Alpha Vantage error');
      }

      const timeSeries = dailyRes['Time Series (Daily)'];
      if (!timeSeries) throw new Error('No daily data for ' + symbol);

      const dates = Object.keys(timeSeries).sort((a, b) => a.localeCompare(b));
      const history = dates.map((date) => ({
        date,
        close: parseFloat(timeSeries[date]['4. close'])
      }));

      const recent = history.slice(-252);
      const closes = recent.map((item) => item.close);
      const currentPrice = closes[closes.length - 1] ?? 0;
      const week52High = parseFloat(Math.max(...closes).toFixed(2));
      const week52Low = parseFloat(Math.min(...closes).toFixed(2));
      const ma50 = closes.length >= 50 ? parseFloat((closes.slice(-50).reduce((a, b) => a + b, 0) / 50).toFixed(2)) : currentPrice;
      const ma100 = closes.length >= 100 ? parseFloat((closes.slice(-100).reduce((a, b) => a + b, 0) / 100).toFixed(2)) : currentPrice;
      const ma200 = closes.length >= 200 ? parseFloat((closes.slice(-200).reduce((a, b) => a + b, 0) / 200).toFixed(2)) : currentPrice;
      const sampleRow = sp500Screen.find((row) => row.symbol === symbol) ?? sp500Screen[0];

      rows.push({
        symbol,
        price: currentPrice,
        week52High,
        week52Low,
        ma50,
        ma100,
        ma200,
        metrics: sampleRow.metrics,
        analystRating: sampleRow.analystRating
      });
    } catch (error) {
      console.warn('S&P screener Alpha Vantage fetch failed for', symbol, error);
      const sampleRow = sp500Screen.find((row) => row.symbol === symbol);
      if (sampleRow) rows.push(sampleRow);
    }
  }

  return rows.length ? rows : sp500Screen;
}
