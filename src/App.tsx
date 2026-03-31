import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { sampleAsset, metricDefinitions } from './data/mockData';
import { AssetData, MetricDefinition, SP500Row } from './types';
import { getAssetData, getSP500Screener } from './services/api';

const timeframes = ['1m', '3m', '1y', '5y', 'lifetime'] as const;
type TimeframeKey = typeof timeframes[number];

const metricTooltip = (metric: MetricDefinition) => `${metric.label}: ${metric.description}`;

const rankComparison = (asset: AssetData, sp500Return5y = 40, sp500ReturnLifetime = 400) => {
  const asset5y = asset.performance['5y'];
  const assetLifetime = asset.performance.lifetime;
  return {
    fiveYear: asset5y - sp500Return5y,
    lifetime: assetLifetime - sp500ReturnLifetime
  };
};

const App = () => {
  const [asset, setAsset] = useState<AssetData>(sampleAsset);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeKey>('1y');
  const [screener, setScreener] = useState<SP500Row[]>([]);
  const [show52w, setShow52w] = useState(true);
  const [symbol, setSymbol] = useState('AAPL');
  const [query, setQuery] = useState('AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['AAPL', 'MSFT'];
    const stored = window.localStorage.getItem('investGuruWatchlist');
    return stored ? JSON.parse(stored) : ['AAPL', 'MSFT'];
  });

  useEffect(() => {
    window.localStorage.setItem('investGuruWatchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [assetData, sp500Data] = await Promise.all([getAssetData(symbol), getSP500Screener()]);
        setAsset(assetData);
        setScreener(sp500Data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol]);

  const screened = useMemo(() => {
    return screener.filter((s) => {
      const near52High = s.price >= s.week52High * 0.95;
      const below52Low = s.price <= s.week52Low * 1.05;
      const belowMA50 = s.price < s.ma50;
      return show52w ? near52High || below52Low : belowMA50;
    });
  }, [screener, show52w]);

  const comp = rankComparison(asset);

  const alerts = useMemo(() => {
    const items = [] as string[];
    if (asset.price < asset.ma50) items.push('Price below 50-day MA');
    if (asset.price < asset.ma100) items.push('Price below 100-day MA');
    if (asset.price < asset.ma200) items.push('Price below 200-day MA');
    if (asset.price <= asset.week52Low * 1.03) items.push('Near 52-week low');
    if (asset.price >= asset.week52High * 0.97) items.push('Near 52-week high');
    return items;
  }, [asset]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const nextSymbol = query.trim().toUpperCase();
    if (nextSymbol) setSymbol(nextSymbol);
  };

  return (
    <div className="page">
      <header className="hero">
        <h1>Invest Guru</h1>
        <p>Multi-asset performance + S&P comparison dashboard</p>
      </header>

      <section className="card">
        <form onSubmit={onSearch} className="search-form" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker symbol (e.g., AAPL, SPY, BTCUSD)"
            aria-label="Ticker symbol"
            style={{ flex: 1, padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}
          />
          <button type="submit" style={{ padding: '0.55rem 0.9rem', borderRadius: '0.5rem', border: 'none', background: '#0ea5e9', color: '#ffffff' }}>
            Load
          </button>
        </form>
        {loading && <p>Loading data for {symbol}…</p>}
        {error && <p style={{ color: '#f87171' }}>Error: {error}</p>}
      </section>

      <main>
        <section className="card grid-2">
          <div className="card-block">
            <h2>{asset.symbol} — {asset.name}</h2>
            <div className="price">
              <span>${asset.price.toFixed(2)}</span>
              <span className={asset.change >= 0 ? 'positive' : 'negative'}>{asset.change.toFixed(2)}%</span>
            </div>
            <div className="mini-grid">
              <div>52W Range</div><strong>{asset.week52Low} - {asset.week52High}</strong>
              <div>MA50</div><strong>{asset.ma50}</strong>
              <div>MA100</div><strong>{asset.ma100}</strong>
              <div>MA200</div><strong>{asset.ma200}</strong>
            </div>
            <button
              onClick={() => setWatchlist((prev) => {
                if (prev.includes(asset.symbol)) {
                  return prev.filter((item) => item !== asset.symbol);
                }
                return [...prev, asset.symbol];
              })}
              style={{ marginTop: '0.8rem', borderRadius: '0.35rem', border: '1px solid #334155', padding: '0.45rem 0.75rem', background: watchlist.includes(asset.symbol) ? '#dc2626' : '#16a34a', color: '#ffffff', cursor: 'pointer' }}
            >
              {watchlist.includes(asset.symbol) ? 'Remove from watchlist' : 'Add to watchlist'}
            </button>
          </div>

          <div className="card-block">
            <h3>Performance tracker</h3>
            <div className="buttons">
              {timeframes.map((item) => (
                <button key={item} className={item === selectedTimeframe ? 'active' : ''} onClick={() => setSelectedTimeframe(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="performance-values">
              {timeframes.map((item) => (
                <div key={item} className={item === selectedTimeframe ? 'active' : ''}>
                  <span>{item}</span>
                  <strong>{asset.performance[item]}%</strong>
                </div>
              ))}
            </div>
            <p className="comparison">
              S&P 500 5y avg: 40%. {asset.symbol}: {asset.performance['5y']}%. Diff: {comp.fiveYear.toFixed(1)} p.p.
            </p>
            <p className="comparison">
              S&P 500 lifetime avg: 400%. {asset.symbol} lifetime {asset.performance.lifetime}%. Diff: {comp.lifetime.toFixed(1)} p.p.
            </p>
            {alerts.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.65rem', borderRadius: '0.6rem', background: '#1e293b' }}>
                <strong>Alerts:</strong>
                <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                  {alerts.map((alert) => (
                    <li key={alert} style={{ color: '#facc15', fontSize: '0.9rem' }}>{alert}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <h3>Price history & moving averages</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={asset.history} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="close" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ma50" stroke="#facc15" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="ma100" stroke="#a78bfa" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="ma200" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <h3>Financial metrics</h3>
          <div className="metrics-grid">
            {metricDefinitions.map((metric) => (
              <div key={metric.key} className="metric">
                <div className="metric-header">
                  <strong>{metric.label}</strong>
                  <span className="info" title={metricTooltip(metric)}>ℹ</span>
                </div>
                <div>{(asset.metrics[metric.key] ?? 'N/A').toString()}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>Analyst sentiment</h3>
          <p>{asset.analystRating.consensus} (Buy {asset.analystRating.buy}, Hold {asset.analystRating.hold}, Sell {asset.analystRating.sell})</p>
        </section>

        <section className="card">
          <h3>Insider trades</h3>
          <table>
            <thead>
              <tr><th>Date</th><th>Insider</th><th>Type</th><th>Shares</th><th>Value</th></tr>
            </thead>
            <tbody>
              {asset.insiderTrades.map((trade) => (
                <tr key={`${trade.date}-${trade.insider}`}>
                  <td>{trade.date}</td>
                  <td>{trade.insider}</td>
                  <td>{trade.type}</td>
                  <td>{trade.shares.toLocaleString()}</td>
                  <td>${trade.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h3>Watchlist</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem' }}>
            {watchlist.map((item) => (
              <button
                key={item}
                onClick={() => setSymbol(item)}
                style={{ padding: '0.45rem 0.65rem', borderRadius: '0.42rem', border: '1px solid #334155', background: item === asset.symbol ? '#0ea5e9' : '#1e293b', color: '#e2e8f0' }}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="list-header">
            <h3>S&P 500 Conditional Screener</h3>
            <label>
              <input type="checkbox" checked={show52w} onChange={(e) => setShow52w(e.target.checked)} />
              52w high/low filter
            </label>
          </div>
          <table className="screener">
            <thead>
              <tr>
                <th>Symbol</th><th>Price</th><th>52w High</th><th>52w Low</th><th>MA50</th><th>MA100</th><th>MA200</th><th>Analyst</th>
              </tr>
            </thead>
            <tbody>
              {screened.map((row) => (
                <tr key={row.symbol} className={row.price < row.ma50 ? 'negative-row' : 'positive-row'}>
                  <td>{row.symbol}</td><td>{row.price}</td><td>{row.week52High}</td><td>{row.week52Low}</td><td>{row.ma50}</td><td>{row.ma100}</td><td>{row.ma200}</td><td>{row.analyst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      <footer className="footer">Built for mobile and desktop, with responsive graph and metric tooltips.</footer>
    </div>
  );
};

export default App;
