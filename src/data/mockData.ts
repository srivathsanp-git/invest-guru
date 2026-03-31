import { AssetData, SP500Row } from '../types';
import { MetricDefinition } from '../types';

export const metricDefinitions: MetricDefinition[] = [
  { key: 'pe', label: 'P/E', description: 'Price to Earnings ratio: price / earnings per share' },
  { key: 'pb', label: 'P/B', description: 'Price to Book ratio: price / book value per share' },
  { key: 'roe', label: 'ROE', description: 'Return on Equity: net income / shareholder equity' },
  { key: 'dividendYield', label: 'Dividend Yield', description: 'Annual dividend / price' },
  { key: 'expenseRatio', label: 'Expense Ratio', description: 'Annual fund operating expenses as a percentage' }
];

export const sampleAsset: AssetData = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  type: 'Stock',
  price: 250.45,
  change: 1.37,
  week52High: 280.23,
  week52Low: 180.08,
  ma50: 255.45,
  ma100: 240.12,
  ma200: 220.50,
  metrics: {
    pe: 28.4,
    pb: 30.3,
    roe: 48.5,
    dividendYield: 0.6,
    marketCap: 3.85e12,
    expenseRatio: 0.0
  },
  analystRating: {
    buy: 30,
    hold: 8,
    sell: 1,
    consensus: 'Buy'
  },
  insiderTrades: [
    { date: '2026-03-18', insider: 'Tim Cook', type: 'Buy', shares: 10000, value: 2500000 },
    { date: '2026-02-10', insider: 'CFO', type: 'Sell', shares: 8000, value: 2000000 }
  ],
  performance: {
    '1m': 5.2,
    '3m': 10.9,
    'ytd': 15.1,
    '1y': 22.7,
    '5y': 180.8,
    lifetime: 1200.6
  },
  history: [
    { date: '2025-12-31', close: 220 },
    { date: '2026-01-31', close: 235 },
    { date: '2026-02-28', close: 245 },
    { date: '2026-03-31', close: 250.45 }
  ]
};

export const sp500Screen: SP500Row[] = [
  {
    symbol: 'AAPL',
    price: 250.45,
    week52High: 280.23,
    week52Low: 180.08,
    ma50: 255.45,
    ma100: 240.12,
    ma200: 220.50,
    metrics: { pe: 28.4, pb: 30.3, roe: 48.5, dividendYield: 0.6, marketCap: 3.85e12, expenseRatio: 0.0 },
    analystRating: { buy: 30, hold: 8, sell: 1, consensus: 'Buy' }
  },
  {
    symbol: 'MSFT',
    price: 450.75,
    week52High: 500.29,
    week52Low: 350.22,
    ma50: 455.19,
    ma100: 435.10,
    ma200: 400.80,
    metrics: { pe: 35.2, pb: 14.5, roe: 45.1, dividendYield: 0.8, marketCap: 3.35e12, expenseRatio: 0.0 },
    analystRating: { buy: 27, hold: 12, sell: 2, consensus: 'Buy' }
  },
  {
    symbol: 'TSLA',
    price: 320.33,
    week52High: 400.00,
    week52Low: 180.22,
    ma50: 330.12,
    ma100: 310.40,
    ma200: 280.10,
    metrics: { pe: 75.1, pb: 15.2, roe: 14.8, dividendYield: 0.0, marketCap: 1.0e12, expenseRatio: 0.0 },
    analystRating: { buy: 24, hold: 12, sell: 4, consensus: 'Hold' }
  }
];
