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
  price: 186.23,
  change: 1.37,
  week52High: 198.23,
  week52Low: 130.08,
  ma50: 188.45,
  ma100: 175.12,
  ma200: 164.50,
  metrics: {
    pe: 27.4,
    pb: 27.3,
    roe: 47.5,
    dividendYield: 0.5,
    marketCap: 2.95e12,
    expenseRatio: 0.0
  },
  analystRating: {
    buy: 28,
    hold: 9,
    sell: 2,
    consensus: 'Buy'
  },
  insiderTrades: [
    { date: '2026-03-18', insider: 'Tim Cook', type: 'Buy', shares: 10000, value: 1800000 },
    { date: '2026-02-10', insider: 'CFO', type: 'Sell', shares: 8000, value: 1480000 }
  ],
  performance: {
    '1m': 4.2,
    '3m': 8.9,
    '1y': 19.7,
    '5y': 150.8,
    lifetime: 1000.6
  },
  history: [
    { date: '2025-12-31', close: 165 },
    { date: '2026-01-31', close: 170 },
    { date: '2026-02-28', close: 178 },
    { date: '2026-03-31', close: 186.23 }
  ]
};

export const sp500Screen: SP500Row[] = [
  { symbol: 'AAPL', price: 186.23, week52High: 198.23, week52Low: 130.08, ma50: 188.45, ma100: 175.12, ma200: 164.5, analyst: 'Buy' },
  { symbol: 'MSFT', price: 418.75, week52High: 464.29, week52Low: 305.22, ma50: 420.19, ma100: 401.1, ma200: 370.8, analyst: 'Hold' },
  { symbol: 'TSLA', price: 225.33, week52High: 299.00, week52Low: 124.22, ma50: 245.12, ma100: 231.4, ma200: 207.1, analyst: 'Buy' }
];
