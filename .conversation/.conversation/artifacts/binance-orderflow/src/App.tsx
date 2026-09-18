import { useMemo, useState, type ReactNode } from 'react';
import { Route, Router as WouterRouter, Switch } from 'wouter';
import { Activity, BarChart3, BookOpen, ChevronDown, CircleHelp, Grid2X2, LayoutPanelLeft, Pause, Play, RotateCcw, Search, SlidersHorizontal, Star, Sun, Wifi, WifiOff, X } from 'lucide-react';
import { useBinanceMarket, useUsdtSymbols, type Candle, type DepthLevel, type MarketStatus, type Trade } from '@/hooks/use-binance-market';

const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h'];
const fmt = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const compact = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : value >= 1e9 ? `${(value / 1e9).toFixed(2)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(2)}K` : value.toFixed(2);

function Tip({ children }: { children: string }) {
  return <span className="tip" title={children}><CircleHelp size={12} /></span>;
}

function Panel({ title, hint, children, className = '' }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div className="panel-title">{title}{hint && <Tip>{hint}</Tip>}</div>{children && <span className="panel-rule" />}</div>{children}</section>;
}

function StatusPill({ status, onReconnect }: { status: MarketStatus; onReconnect: () => void }) {
  const label = status === 'connected' ? 'LIVE' : status === 'connecting' ? 'CONNECTING' : status === 'paused' ? 'PAUSED' : status === 'error' ? 'ERROR' : 'DISCONNECTED';
  return <button className={`status-pill ${status}`} onClick={onReconnect} data-testid="button-reconnect" title="Reconnect public market streams"><span className="status-dot" />{label}<span className="status-divider" /><RotateCcw size={12} /></button>;
}

function SymbolPicker({ symbol, symbols, favorites, onSelect, onFavorite }: { symbol: string; symbols: ReturnType<typeof useUsdtSymbols>['symbols']; favorites: string[]; onSelect: (symbol: string) => void; onFavorite: (symbol: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => symbols.filter((item) => item.symbol.includes(query.toUpperCase())).slice(0, 14), [symbols, query]);
  const topVolume = symbols.slice(0, 4);
  const favoriteSymbols = favorites.map((item) => symbols.find((candidate) => candidate.symbol === item)).filter((item): item is (typeof symbols)[number] => Boolean(item)).slice(0, 4);
  const shortcut = (item: string) => <button key={item} className={item === symbol ? 'active' : ''} onClick={() => { onSelect(item); setOpen(false); }} data-testid={`button-symbol-${item}`}>{item.replace('USDT', '')}</button>;
  return <div className="symbol-picker"><button className="symbol-button" onClick={() => setOpen((value) => !value)} data-testid="button-symbol-picker"><span className="symbol-mark">B</span><span><strong>{symbol}</strong><small>USDT Perpetual</small></span><ChevronDown size={15} /></button>{open && <div className="symbol-popover"><div className="search-wrap"><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search USDT perpetuals" data-testid="input-symbol-search" /><button onClick={() => setOpen(false)} data-testid="button-close-symbol-picker"><X size={13} /></button></div>{favoriteSymbols.length > 0 && <div className="shortcut-block"><span>FAVORITES</span><div className="shortcut-row">{favoriteSymbols.map((item) => shortcut(item.symbol))}</div></div>}<div className="shortcut-block"><span>TOP VOLUME</span><div className="shortcut-row">{(topVolume.length ? topVolume : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']).map((item) => shortcut(typeof item === 'string' ? item : item.symbol))}</div></div><div className="symbol-list">{filtered.length ? filtered.map((item) => <div className="symbol-row" key={item.symbol}><button onClick={() => { onSelect(item.symbol); setOpen(false); }} data-testid={`button-select-symbol-${item.symbol}`}><strong>{item.baseAsset}</strong><span>/ USDT</span></button><button className={`star ${favorites.includes(item.symbol) ? 'selected' : ''}`} onClick={() => onFavorite(item.symbol)} data-testid={`button-favorite-${item.symbol}`}><Star size={13} fill={favorites.includes(item.symbol) ? 'currentColor' : 'none'} /></button></div>) : <div className="empty-small">{symbols.length ? 'No perpetual matches' : 'Loading Binance symbols…'}</div>}</div></div>}</div>;
}

function TopBar({ symbol, setSymbol, interval, setInterval, favorites, onFavorite, symbols, status, onReconnect, paused, onPause, compactMode, onCompact }: { symbol: string; setSymbol: (value: string) => void; interval: string; setInterval: (value: string) => void; favorites: string[]; onFavorite: (value: string) => void; symbols: ReturnType<typeof useUsdtSymbols>['symbols']; status: MarketStatus; onReconnect: () => void; paused: boolean; onPause: () => void; compactMode: boolean; onCompact: () => void }) {
  return <><header className="topbar"><div className="brand"><div className="brand-glyph"><span /><span /><span /></div><div><strong>ORDERFLOW</strong><small>BINANCE / USDT-M</small></div></div><div className="top-divider" /><SymbolPicker {...{ symbol, symbols, favorites, onSelect: setSymbol, onFavorite }} /><div className="control-group timeframes">{timeframes.map((item) => <button key={item} className={interval === item ? 'active' : ''} onClick={() => setInterval(item)} data-testid={`button-timeframe-${item}`}>{item}</button>)}</div><div className="top-actions"><button className="icon-button" onClick={onCompact} title="Toggle compact layout" data-testid="button-layout-toggle">{compactMode ? <LayoutPanelLeft size={15} /> : <Grid2X2 size={15} />}</button><button className="icon-button" title="Interface settings" data-testid="button-settings"><SlidersHorizontal size={15} /></button><button className={`feed-button ${paused ? 'is-paused' : ''}`} onClick={onPause} data-testid="button-pause-feed">{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? 'Resume' : 'Pause feed'}</button><StatusPill status={status} onReconnect={onReconnect} /></div></header><div className="ticker-strip"><div className="ticker-label"><Activity size={13} /> MARKET PULSE</div><div className="ticker-copy">Aggressive flow, liquidity & execution pressure <span>•</span> public Binance market data</div><div className="ticker-right"><span className="live-bar" /> stream interval 100ms <span className="ticker-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span></div></div></>;
}

function Overview({ symbol, price, change, quoteVolume, bids, asks, candles, status, onReconnect }: { symbol: string; price: number | null; change: number | null; quoteVolume: number | null; bids: DepthLevel[]; asks: DepthLevel[]; candles: Candle[]; status: MarketStatus; onReconnect: () => void }) {
  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
  const last = candles[candles.length - 1];
  const range = last ? last.high - last.low : null;
  const totalBuy = candles.slice(-20).reduce((sum, item) => sum + item.buyVolume, 0);
  const totalSell = candles.slice(-20).reduce((sum, item) => sum + item.sellVolume, 0);
  const bias = totalBuy + totalSell ? ((totalBuy - totalSell) / (totalBuy + totalSell)) * 100 : null;
  return <div className="overview"><div className="price-block"><span className="eyebrow">{symbol} · LAST TRADE</span><div className="last-price" data-testid="text-last-price">{fmt(price, price && price > 1000 ? 2 : 4)}</div><div className={`change ${change != null && change >= 0 ? 'positive' : 'negative'}`}>{change == null ? '—' : `${change >= 0 ? '+' : ''}${fmt(change)}%`} <span>24h change</span></div></div><div className="metric"><span>24H VOLUME <Tip>Quote volume traded on Binance Futures over the last 24 hours.</Tip></span><strong>{compact(quoteVolume)} <em>USDT</em></strong><small>rolling session</small></div><div className="metric"><span>BEST BID <Tip>Highest visible resting buy price from the live depth stream.</Tip></span><strong className="green">{fmt(bestBid, 2)}</strong><small>top of book</small></div><div className="metric"><span>BEST ASK <Tip>Lowest visible resting sell price from the live depth stream.</Tip></span><strong className="red">{fmt(bestAsk, 2)}</strong><small>top of book</small></div><div className="metric"><span>SPREAD <Tip>The distance between the best ask and best bid.</Tip></span><strong>{spread == null ? '—' : spread.toFixed(2)}</strong><small>{price ? `${((spread! / price) * 100).toFixed(3)}% of price` : 'waiting'}</small></div><div className="metric"><span>FLOW BIAS <Tip>Buy volume minus sell volume divided by total volume across the last 20 loaded candles.</Tip></span><strong className={bias == null ? '' : bias >= 0 ? 'green' : 'red'}>{bias == null ? '—' : `${bias >= 0 ? '+' : ''}${bias.toFixed(1)}%`}</strong><small>last 20 candles</small></div><div className="metric status-metric"><span>FEED STATUS</span><strong className={`status-text ${status}`}>{status}</strong><button onClick={onReconnect} data-testid="button-overview-reconnect">Reconnect stream</button></div><div className="range-note">{range ? <><BarChart3 size={14} /> Current candle range <b>{fmt(range, 2)}</b></> : 'Waiting for candle data'}</div></div>;
}

function CandleChart({ candles, compactMode }: { candles: Candle[]; compactMode: boolean }) {
  const width = 900; const height = compactMode ? 290 : 360; const pad = { l: 8, r: 52, t: 18, b: 24 };
  const visible = candles.slice(-70);
  if (!visible.length) return <div className="chart-empty"><div className="skeleton-line wide" /><div className="skeleton-line" /><p>Loading live candles from Binance Futures…</p></div>;
  const min = Math.min(...visible.map((c) => c.low)); const max = Math.max(...visible.map((c) => c.high)); const span = max - min || 1; const xStep = (width - pad.l - pad.r) / visible.length; const y = (value: number) => pad.t + ((max - value) / span) * (height - pad.t - pad.b); const candleWidth = Math.max(3, xStep * 0.56);
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="candle-svg" role="img" aria-label="Live BTCUSDT candlestick chart">{[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1={pad.l} x2={width - pad.r} y1={pad.t + ratio * (height - pad.t - pad.b)} y2={pad.t + ratio * (height - pad.t - pad.b)} className="chart-grid" /><text x={width - pad.r + 8} y={pad.t + ratio * (height - pad.t - pad.b) + 4} className="axis-label">{fmt(max - ratio * span, 0)}</text></g>)}{visible.map((candle, index) => { const x = pad.l + index * xStep + xStep / 2; const bullish = candle.close >= candle.open; const color = bullish ? 'var(--green)' : 'var(--red)'; return <g key={candle.time} className="candle"><line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1" /><rect x={x - candleWidth / 2} y={Math.min(y(candle.open), y(candle.close))} width={candleWidth} height={Math.max(1.5, Math.abs(y(candle.open) - y(candle.close)))} fill={color} opacity=".9" /></g>; })}</svg><div className="chart-legend"><span><i className="legend-green" /> bullish candle</span><span><i className="legend-red" /> bearish candle</span><span><Tip>Each candle is built from Binance kline stream data. Flow values below are matched to aggregated trades during that candle.</Tip> DATA: LIVE</span></div></div>;
}

type FlowKind = 'pressure' | 'direction';
type FlowCandle = Candle & { flowOpen: number; flowHigh: number; flowLow: number; flowClose: number; score: number };

function buildFlowCandles(candles: Candle[], kind: FlowKind): FlowCandle[] {
  let running = 0;
  return candles.slice(-70).map((candle) => {
    const score = kind === 'pressure'
      ? candle.delta
      : Math.max(-1, Math.min(1, candle.directionBias || (candle.close >= candle.open ? 1 : -1)));
    const flowOpen = running;
    running += score;
    const flowClose = running;
    const wick = kind === 'pressure'
      ? Math.max(Math.abs(score) * 0.16, (candle.buyVolume + candle.sellVolume) * 0.002)
      : Math.max(0.22, Math.abs(score) * 0.35);
    return {
      ...candle,
      flowOpen,
      flowClose,
      flowHigh: Math.max(flowOpen, flowClose) + wick,
      flowLow: Math.min(flowOpen, flowClose) - wick,
      score,
    };
  });
}

function FlowReadout({ candles, kind }: { candles: Candle[]; kind: FlowKind }) {
  const items = candles.slice(-20);
  const value = kind === 'pressure'
    ? items.reduce((sum, item) => sum + item.delta, 0)
    : items.reduce((sum, item) => sum + (item.directionBias || (item.close >= item.open ? 1 : -1)), 0);
  const positive = value >= 0;
  const label = kind === 'pressure'
    ? positive ? 'BUYERS DOMINANT' : 'SELLERS DOMINANT'
    : positive ? 'BUYERS ATTACKING' : 'SELLERS ATTACKING';
  const detail = kind === 'pressure'
    ? `${positive ? '+' : '−'}${compact(Math.abs(value))} base volume delta`
    : `${positive ? '+' : '−'}${Math.abs(value).toFixed(1)} direction balance`;
  return <div className={`flow-readout ${positive ? 'buy-read' : 'sell-read'}`}><span className="flow-readout-dot" /><div><strong>{label}</strong><small>{detail}</small></div><span className="flow-readout-help">{kind === 'pressure' ? 'Who is dominant?' : 'Who is attacking?'}</span></div>;
}

function FlowCandleChart({ candles, kind, compactMode, hoveredTime, onHover }: { candles: Candle[]; kind: FlowKind; compactMode: boolean; hoveredTime: number | null; onHover: (time: number | null) => void }) {
  const width = 900;
  const height = compactMode ? 220 : 250;
  const pad = { l: 8, r: 50, t: 16, b: 22 };
  const items = buildFlowCandles(candles, kind);
  if (!items.length) return <div className="flow-chart-empty"><div className="skeleton-line wide" /><p>Waiting for live trade flow…</p></div>;
  const min = Math.min(...items.map((item) => item.flowLow));
  const max = Math.max(...items.map((item) => item.flowHigh));
  const span = max - min || 1;
  const xStep = (width - pad.l - pad.r) / items.length;
  const y = (value: number) => pad.t + ((max - value) / span) * (height - pad.t - pad.b);
  const candleWidth = Math.max(4, xStep * 0.58);
  const baseline = y(0);
  return <div className="flow-chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="flow-candle-svg" role="img" aria-label={kind === 'pressure' ? 'Cumulative price pressure candle chart' : 'Cumulative sub-bar direction balance candle chart'} onMouseLeave={() => onHover(null)}>{[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1={pad.l} x2={width - pad.r} y1={pad.t + ratio * (height - pad.t - pad.b)} y2={pad.t + ratio * (height - pad.t - pad.b)} className="flow-grid" /><text x={width - pad.r + 7} y={pad.t + ratio * (height - pad.t - pad.b) + 3} className="axis-label">{kind === 'pressure' ? compact(max - ratio * span) : (max - ratio * span).toFixed(1)}</text></g>)}<line x1={pad.l} x2={width - pad.r} y1={baseline} y2={baseline} className="flow-zero" />{items.map((item, index) => { const x = pad.l + index * xStep + xStep / 2; const bullish = item.flowClose >= item.flowOpen; const color = bullish ? 'var(--green)' : 'var(--red)'; const large = item.largeBuyVolume > 0 || item.largeSellVolume > 0; const selected = item.time === hoveredTime; return <g key={item.time} className={`flow-candle${selected ? ' selected' : ''}`} aria-label={`${new Date(item.time).toLocaleTimeString()} · ${bullish ? 'buyers' : 'sellers'} · ${kind === 'pressure' ? `delta ${fmt(item.score, 3)}` : `balance ${item.score.toFixed(2)}`}`}><rect className="flow-hit-area" data-testid={`flow-hit-${kind}-${item.time}`} x={pad.l + index * xStep} y={pad.t} width={xStep} height={height - pad.t - pad.b} onMouseEnter={() => onHover(item.time)} /><line x1={x} x2={x} y1={y(item.flowHigh)} y2={y(item.flowLow)} stroke={color} strokeWidth="1.2" /><rect x={x - candleWidth / 2} y={Math.min(y(item.flowOpen), y(item.flowClose))} width={candleWidth} height={Math.max(2, Math.abs(y(item.flowOpen) - y(item.flowClose)))} fill={color} opacity=".92" />{large && <circle cx={x} cy={Math.max(7, y(item.flowHigh) - 5)} r="3" fill="var(--amber)" stroke="#11161c" strokeWidth="1.5" />}</g>; })}{hoveredTime != null && items.map((item, index) => item.time === hoveredTime ? <line key={`crosshair-${item.time}`} className="flow-crosshair" x1={pad.l + index * xStep + xStep / 2} x2={pad.l + index * xStep + xStep / 2} y1={pad.t} y2={height - pad.b} /> : null)}</svg><div className="flow-chart-foot"><span><i className="legend-green" /> buyers</span><span><i className="legend-red" /> sellers</span><span><i className="legend-amber" /> large-flow proxy</span><span className="flow-chart-note">Each candle = selected timeframe bar</span></div></div>;
}

function FlowDetailCard({ candles, hoveredTime }: { candles: Candle[]; hoveredTime: number | null }) {
  const pressureItems = useMemo(() => buildFlowCandles(candles, 'pressure'), [candles]);
  const directionItems = useMemo(() => buildFlowCandles(candles, 'direction'), [candles]);
  const candle = hoveredTime == null ? undefined : candles.find((item) => item.time === hoveredTime);
  const pressure = hoveredTime == null ? undefined : pressureItems.find((item) => item.time === hoveredTime);
  const direction = hoveredTime == null ? undefined : directionItems.find((item) => item.time === hoveredTime);
  const large = candle ? candle.largeBuyVolume > 0 || candle.largeSellVolume > 0 : false;
  const directionScore = direction?.score ?? candle?.directionBias ?? null;
  return <div className={`flow-detail-card${candle ? ' has-selection' : ''}`} aria-live="polite" data-testid="flow-detail-card"><div className="flow-detail-heading"><span>SELECTED FLOW BAR</span>{candle ? <time>{new Date(candle.time).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time> : <em>Hover a candle to inspect</em>}</div>{candle ? <div className="flow-detail-grid"><div><span>BUY VOLUME</span><strong className="green">{compact(candle.buyVolume)}</strong></div><div><span>SELL VOLUME</span><strong className="red">{compact(candle.sellVolume)}</strong></div><div><span>DELTA</span><strong className={candle.delta >= 0 ? 'green' : 'red'}>{candle.delta >= 0 ? '+' : '−'}{compact(Math.abs(candle.delta))}</strong></div><div><span>CUM. PRESSURE</span><strong className={pressure && pressure.flowClose >= 0 ? 'green' : 'red'}>{pressure ? `${pressure.flowClose >= 0 ? '+' : '−'}${compact(Math.abs(pressure.flowClose))}` : '—'}</strong></div><div><span>DIRECTION BALANCE</span><strong className={directionScore != null && directionScore >= 0 ? 'green' : 'red'}>{directionScore == null ? '—' : `${directionScore >= 0 ? '+' : '−'}${Math.abs(directionScore).toFixed(2)}`}</strong></div><div><span>LARGE-FLOW PROXY</span><strong className={large ? 'amber' : 'muted'}>{large ? 'YES' : 'NO'}</strong></div></div> : <div className="flow-detail-placeholder">Move across either candle panel to synchronize the crosshair and reveal buy/sell execution detail.</div>}</div>;
}

function Heatmap({ bids, asks, price }: { bids: DepthLevel[]; asks: DepthLevel[]; price: number | null }) {
  const levels = [...asks.slice(0, 18).reverse(), ...bids.slice(0, 18)]; const maxQty = Math.max(1, ...levels.map((item) => item.qty)); const [hover, setHover] = useState<DepthLevel | null>(null);
  return <div className="heatmap-wrap">{hover && <div className="heatmap-hover"><strong>{hover.side === 'bid' ? 'Bid liquidity' : 'Ask liquidity'}</strong><span>{fmt(hover.price, 2)} · {compact(hover.qty)} contracts</span></div>}<div className="heatmap-grid">{levels.length ? levels.map((item, index) => <button key={`${item.side}-${item.price}-${index}`} className={`heat-row ${item.side}`} onMouseEnter={() => setHover(item)} onMouseLeave={() => setHover(null)} data-testid={`heatmap-level-${item.side}-${index}`}><span className="heat-price">{fmt(item.price, 2)}</span><span className="heat-track"><i style={{ width: `${Math.max(5, item.qty / maxQty * 100)}%` }} /></span><span className="heat-qty">{compact(item.qty)}</span></button>) : <div className="empty-state"><BookOpen size={20} /><span>Depth levels will appear when the stream connects.</span></div>}</div>{price && <div className="price-marker" style={{ top: `${(asks.length / Math.max(1, levels.length)) * 100}%` }}><span /> {fmt(price, 2)}</div>}<div className="heat-legend"><span><i className="ask-swatch" /> ask liquidity</span><span><i className="bid-swatch" /> bid liquidity</span><span><Tip>Bars show relative resting quantity across the visible order book. This is not executed volume.</Tip> hover a row for detail</span></div></div>;
}

function Orderbook({ bids, asks }: { bids: DepthLevel[]; asks: DepthLevel[] }) {
  const bidTotal = bids.slice(0, 15).reduce((sum, item) => sum + item.qty, 0); const askTotal = asks.slice(0, 15).reduce((sum, item) => sum + item.qty, 0); const total = bidTotal + askTotal; const ratio = total ? bidTotal / total * 100 : null;
  return <Panel title="ORDERBOOK IMBALANCE" hint="Visible depth is grouped from the live depth@100ms stream. Imbalance compares the top 15 bid and ask levels."><div className="imbalance-head"><strong>{ratio == null ? '—' : `${ratio.toFixed(1)}%`}</strong><span>bid-side share</span><b className={ratio != null && ratio > 50 ? 'green' : 'red'}>{ratio == null ? '—' : ratio > 50 ? 'BUY WALL' : 'SELL WALL'}</b></div><div className="imbalance-track"><i style={{ width: `${ratio ?? 50}%` }} /></div><div className="imbalance-labels"><span>Bids <b>{compact(bidTotal)}</b></span><span>Asks <b>{compact(askTotal)}</b></span></div></Panel>;
}

function Tape({ trades }: { trades: Trade[] }) {
  return <Panel title="RECENT TRADE TAPE" hint="Each row is one aggregate trade from Binance. Buy means the taker lifted the ask; sell means the taker hit the bid."><div className="tape-head"><span>TIME</span><span>SIDE</span><span>PRICE</span><span>SIZE</span></div><div className="tape">{trades.length ? trades.slice(0, 22).map((trade) => <div className="tape-row" key={trade.id}><span>{new Date(trade.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><b className={trade.side === 'buy' ? 'green' : 'red'}>{trade.side.toUpperCase()}</b><span>{fmt(trade.price, 2)}</span><strong>{trade.qty.toFixed(4)}</strong></div>) : <div className="empty-state compact-empty"><Activity size={18} /><span>Trade tape is waiting for live aggTrade messages.</span></div>}</div></Panel>;
}

function HeavyFlow({ trades }: { trades: Trade[] }) {
  const largeTrades = trades.filter((trade) => trade.isLarge).slice(0, 8);
  return <Panel title="LARGE-FLOW RADAR" hint="Public Binance streams do not identify institutions. These markers flag unusually large aggressive prints as an institutional-size proxy, not proof of institutional ownership."><div className="large-flow-note">INSTITUTIONAL-SIZE PROXY <Tip>Unusually large taker trades relative to the current stream baseline. This cannot confirm who placed the order.</Tip></div><div className="large-flow-list">{largeTrades.length ? largeTrades.map((trade) => <div className="large-flow-row" key={`large-${trade.id}`}><span className={`large-flow-badge ${trade.side}`}>{trade.side === 'buy' ? 'BUY' : 'SELL'}</span><strong>{compact(trade.notional)} USDT</strong><span>{fmt(trade.price, 2)}</span><time>{new Date(trade.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div>) : <div className="empty-small">Unusually large prints will appear here as they arrive.</div>}</div></Panel>;
}

function AppShell() {
  const [symbol, setSymbol] = useState('BTCUSDT'); const [interval, setInterval] = useState('5m'); const [hoveredTime, setHoveredTime] = useState<number | null>(null); const [paused, setPaused] = useState(false); const [compactMode, setCompactMode] = useState(false); const [favorites, setFavorites] = useState<string[]>(['BTCUSDT', 'ETHUSDT']);
  const { symbols } = useUsdtSymbols(); const { candles, bids, asks, trades, price, change, quoteVolume, status, reconnect } = useBinanceMarket(symbol, interval, paused);
  const toggleFavorite = (value: string) => setFavorites((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  const changeInterval = (value: string) => { setHoveredTime(null); setInterval(value); };
  const bestBid = bids[0]?.price; const bestAsk = asks[0]?.price;
  return <main className={compactMode ? 'terminal compact' : 'terminal'}><TopBar {...{ symbol, setSymbol, interval, setInterval: changeInterval, favorites, onFavorite: toggleFavorite, symbols, status, onReconnect: reconnect, paused, onPause: () => setPaused((value) => !value), compactMode, onCompact: () => setCompactMode((value) => !value) }} /><div className="workspace"><Overview {...{ symbol, price, change, quoteVolume, bids, asks, candles, status, onReconnect: reconnect }} /><div className="main-grid"><div className="left-column flow-panel-stack"><FlowDetailCard candles={candles} hoveredTime={hoveredTime} /><Panel title="CUMULATIVE CANDLE / PRICE PRESSURE" hint="The running aggressive-volume balance. Green means buyers are dominant; red means sellers are dominant."><div className="flow-module-head"><span className="instrument-label">{symbol} <small>· {interval}</small></span><span className="live-tag"><i /> LIVE</span></div><div className="flow-module-subtitle">OHLC structural pressure flow · buyer initiation vs seller rejection and range activity</div><FlowCandleChart candles={candles} kind="pressure" compactMode={compactMode} hoveredTime={hoveredTime} onHover={setHoveredTime} /><FlowReadout candles={candles} kind="pressure" /></Panel><Panel title="CUMULATIVE CANDLE-DIRECTION BALANCE" hint="The running direction of sub-bar aggression. Green means buyers are attacking the current market; red means sellers are attacking."><div className="flow-module-head"><span className="instrument-label">{symbol} <small>· {interval}</small></span><span className="live-tag"><i /> LIVE</span></div><div className="flow-module-subtitle">One candle = selected bar · direction balance shows who is currently attacking</div><FlowCandleChart candles={candles} kind="direction" compactMode={compactMode} hoveredTime={hoveredTime} onHover={setHoveredTime} /><FlowReadout candles={candles} kind="direction" /></Panel><div className="lower-grid"><Panel title="SESSION READ" hint="A compact read of the current loaded candle set."><div className="session-read"><div><span>Loaded candles</span><b>{candles.length || '—'}</b></div><div><span>Range high</span><b>{candles.length ? fmt(Math.max(...candles.map((item) => item.high)), 2) : '—'}</b></div><div><span>Range low</span><b>{candles.length ? fmt(Math.min(...candles.map((item) => item.low)), 2) : '—'}</b></div><div><span>Top of book</span><b>{bestBid && bestAsk ? `${fmt(bestBid, 1)} / ${fmt(bestAsk, 1)}` : '—'}</b></div></div></Panel><HeavyFlow trades={trades} /></div></div><aside className="right-column"><Panel title="LIQUIDITY HEATMAP" hint="A real-time visual of resting bid and ask quantity from the Binance depth stream. Use hover for row details."><Heatmap {...{ bids, asks, price }} /></Panel><Orderbook {...{ bids, asks }} /><Tape trades={trades} /></aside></div></div><footer className="disclaimer"><span><Sun size={13} /> Public market data only</span><span>Analytics, not financial advice. Binance streams can disconnect or arrive delayed. No execution, account, or private endpoints are used.</span><span className="footer-brand">ORDERFLOW TERMINAL / v0.1</span></footer></main>;
}

export default function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Switch><Route path="/" component={AppShell} /></Switch></WouterRouter>;
}
