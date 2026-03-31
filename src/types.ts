export type AssetType = 'Stock' | 'ETF' | 'Mutual Fund' | 'Crypto';

export interface MetricDefinition {
  key: keyof AssetMetrics;
  label: string;
  description: string;
}

export interface AssetMetrics {
  pe: number;
  pb: number;
  roe: number;
  dividendYield: number;
  marketCap: number;
  expenseRatio?: number;
}

export interface PerformancePoint {
  date: string;
  close: number;
  ma50?: number;
  ma100?: number;
  ma200?: number;
}

export interface SP500Row {
  symbol: string;
  price: number;
  week52High: number;
  week52Low: number;
  ma50: number;
  ma100: number;
  ma200: number;
  analyst: string;
  metrics: AssetMetrics;
  analystRating: { buy: number; hold: number; sell: number; consensus: string };
}

export interface AssetData {
  symbol: string;
  name: string;
  type: AssetType;
  price: number;
  change: number;
  week52High: number;
  week52Low: number;
  ma50: number;
  ma100: number;
  ma200: number;
  metrics: AssetMetrics;
  analystRating: { buy: number; hold: number; sell: number; consensus: string };
  insiderTrades: Array<{ date: string; insider: string; type: 'Buy' | 'Sell'; shares: number; value: number }>;
  performance: Record<'1m' | '3m' | 'ytd' | '1y' | '5y' | 'lifetime', number>;
  history: PerformancePoint[];
}
