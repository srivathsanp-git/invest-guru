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

export async function getAssetData(symbol: string): Promise<AssetData> {
  if (!FINNHUB_API_KEY) {
    return normalizeAsset(sampleAsset, symbol);
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
        analyst: 'Unknown'
      } as SP500Row;
    });

    const data = await Promise.all(tasks);
    return data;
  } catch (err) {
    console.warn('SP500 screen fetch failed', err);
    return sp500Screen;
  }
}
