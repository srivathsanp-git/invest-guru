import { AssetData, SP500Row } from '../types';
import { sampleAsset, sp500Screen } from '../data/mockData';
import { sp500Symbols } from '../data/sp500Symbols';

const FINNHUB_API_KEY = (import.meta as any).env?.VITE_FINNHUB_API_KEY;
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

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
  if (!FINNHUB_API_KEY) {
    return createMockAsset(symbol);
  }

  try {
    const quoteUrl = `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const candleUrl = `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${Math.floor(Date.now() / 1000) - 5 * 365 * 24 * 3600}&to=${Math.floor(Date.now() / 1000)}&token=${FINNHUB_API_KEY}`;
    const metricUrl = `${FINNHUB_BASE}/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`;
    const ratingUrl = `${FINNHUB_BASE}/stock/recommendation?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const insiderUrl = `${FINNHUB_BASE}/stock/insider-transactions?symbol=${symbol}&token=${FINNHUB_API_KEY}`;

    const [quote, candles, metrics, recommendations, insiders] = await Promise.all([
      safeFetch<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }>(quoteUrl),
      safeFetch<{ s: string; c: number[]; h: number[]; l: number[]; o: number[]; v: number[]; t: number[] }>(candleUrl),
      safeFetch<any>(metricUrl),
      safeFetch<Array<{ buy: number; hold: number; sell: number; period: string }>>(ratingUrl),
      safeFetch<{ data: Array<{ reportDate: string; entityName: string; securityName: string; transactionType: string; transactionShares: number; transactionPrice: number; transactionValue: number }> }>(insiderUrl)
    ]);

    const history = candles.s === 'ok' ? candles.t.map((unix, i) => ({ date: new Date(unix * 1000).toISOString().slice(0, 10), close: candles.c[i] })) : sampleAsset.history;

    const pos = metrics?.metric || {};
    const latestRating = recommendations?.[0];

    const analystRating = {
      buy: latestRating?.buy ?? sampleAsset.analystRating.buy,
      hold: latestRating?.hold ?? sampleAsset.analystRating.hold,
      sell: latestRating?.sell ?? sampleAsset.analystRating.sell,
      consensus: latestRating
        ? latestRating.buy > latestRating.hold && latestRating.buy > latestRating.sell
          ? 'Buy'
          : latestRating.hold > latestRating.sell
            ? 'Hold'
            : 'Sell'
        : sampleAsset.analystRating.consensus
    };

    const insiderTrades = (insiders?.data?.slice(0, 10).map((item) => ({
      date: item.reportDate,
      insider: item.entityName || item.securityName || 'Unknown',
      type: item.transactionType === 'S' || item.transactionType === 'Sell' ? 'Sell' : 'Buy',
      shares: item.transactionShares ?? 0,
      value: item.transactionValue ?? 0
    })) as Array<{ date: string; insider: string; type: 'Buy' | 'Sell'; shares: number; value: number }>) ?? sampleAsset.insiderTrades;

    const sma = (data: number[], period: number): Array<number | undefined> =>
      data.map((_, idx, arr) => {
        if (idx < period - 1) return undefined;
        const slice = arr.slice(idx - period + 1, idx + 1);
        return slice.reduce((a, b) => a + b, 0) / period;
      });

    const closes = history.map((p) => p.close);
    const ma50History = sma(closes, 50);
    const ma100History = sma(closes, 100);
    const ma200History = sma(closes, 200);

    const historyWithMa = history.map((p, i) => ({
      ...p,
      ma50: ma50History[i],
      ma100: ma100History[i],
      ma200: ma200History[i]
    }));

    const result: AssetData = {
      symbol,
      name: symbol,
      type: sampleAsset.type,
      price: quote.c,
      change: quote.dp,
      week52High: pos['52WeekHigh'] ?? sampleAsset.week52High,
      week52Low: pos['52WeekLow'] ?? sampleAsset.week52Low,
      ma50: pos['day50MovingAverage'] ?? sampleAsset.ma50,
      ma100: pos['day100MovingAverage'] ?? sampleAsset.ma100,
      ma200: pos['day200MovingAverage'] ?? sampleAsset.ma200,
      metrics: {
        pe: pos['ttmPE'] ?? sampleAsset.metrics.pe,
        pb: pos['pbRatio'] ?? sampleAsset.metrics.pb,
        roe: pos['roe'] ?? sampleAsset.metrics.roe,
        dividendYield: pos['dividendYield'] ?? sampleAsset.metrics.dividendYield,
        marketCap: pos['marketCapitalization'] ?? sampleAsset.metrics.marketCap,
        expenseRatio: sampleAsset.metrics.expenseRatio
      },
      analystRating,
      insiderTrades,
      performance: {
        '1m': calcReturn(history, 0.083),
        '3m': calcReturn(history, 0.25),
        'ytd': calcReturn(history, 0.2),
        '1y': calcReturn(history, 1),
        '5y': calcReturn(history, 5),
        lifetime: calcReturn(history, 10)
      },
      history: historyWithMa
    };

    return result;
  } catch (error) {
    console.warn('API asset load failed, falling back to sample asset', error);
    return normalizeAsset(sampleAsset, symbol);
  }
}

export async function getSP500Screener(): Promise<SP500Row[]> {
  if (!FINNHUB_API_KEY) {
    return sp500Screen;
  }

  try {
    const symbols = sp500Symbols.slice(0, 25);
    const tasks = symbols.map(async (sym) => {
      const quote = await safeFetch<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }>(`${FINNHUB_BASE}/quote?symbol=${sym}&token=${FINNHUB_API_KEY}`);
      const metric = await safeFetch<any>(`${FINNHUB_BASE}/stock/metric?symbol=${sym}&metric=all&token=${FINNHUB_API_KEY}`);
      const pos = metric?.metric || {};
      return {
        symbol: sym,
        price: quote.c,
        week52High: pos['52WeekHigh'] ?? 0,
        week52Low: pos['52WeekLow'] ?? 0,
        ma50: pos['day50MovingAverage'] ?? 0,
        ma100: pos['day100MovingAverage'] ?? 0,
        ma200: pos['day200MovingAverage'] ?? 0,
        metrics: {
          pe: pos['ttmPE'] ?? 0,
          pb: pos['pbRatio'] ?? 0,
          roe: pos['roe'] ?? 0,
          dividendYield: pos['dividendYield'] ?? 0,
          marketCap: pos['marketCapitalization'] ?? 0,
          expenseRatio: 0
        },
        analystRating: {
          buy: 0,
          hold: 0,
          sell: 0,
          consensus: 'Unknown'
        }
      } as SP500Row;
    });

    const data = await Promise.all(tasks);
    return data;
  } catch (err) {
    console.warn('SP500 screen fetch failed', err);
    return sp500Screen;
  }
}
