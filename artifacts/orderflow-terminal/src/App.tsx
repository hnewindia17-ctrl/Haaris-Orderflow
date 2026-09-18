import { useMemo, useState, type ReactNode } from 'react';
import { Route, Router as WouterRouter, Switch } from 'wouter';
import { Activity, ArrowDownUp, BarChart3, BookOpen, ChevronDown, CircleHelp, Crosshair, Grid2X2, LayoutPanelLeft, Pause, Play, RotateCcw, Search, SlidersHorizontal, Star, Sun, Target, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useBinanceMarket, useMarketPulse, useUsdtSymbols, type Candle, type DepthLevel, type Liquidation, type MarketStatus, type SymbolInfo, type Trade } from '@/hooks/use-binance-market';
import { buildVolumeProfile, buildVwapBands, detectDivergences, detectFlowEvents, stackedImbalance, type Divergence, type FlowEvent } from '@/utils/orderflow';

const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h'];
const fmt = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const compact = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : value >= 1e9 ? `${(value / 1e9).toFixed(2)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(2)}K` : value.toFixed(2);

function Tip({ children }: { children: string }) {
  return <span className="tip" title={children}><CircleHelp size={12} /></span>;
}

function Panel({ title, hint, children, className = '', id }: { title: string; hint?: string; children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`panel ${className}`}><div className="panel-head"><div className="panel-title">{title}{hint && <Tip>{hint}</Tip>}</div>{children && <span className="panel-rule" />}</div>{children}</section>;
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

type ScreenSort = 'volume' | 'spike' | 'gainers' | 'losers' | 'pressure';

function VolumeScreener({ symbols, selected, onSelect }: { symbols: SymbolInfo[]; selected: string; onSelect: (symbol: string) => void }) {
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<ScreenSort>('volume');
  const ranked = useMemo(() => {
    const next = [...symbols];
    if (sort === 'gainers') return next.sort((a, b) => b.change - a.change).slice(0, 8);
    if (sort === 'losers') return next.sort((a, b) => a.change - b.change).slice(0, 8);
    if (sort === 'pressure') return next.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8);
    if (sort === 'spike') return next.sort((a, b) => b.volumeSpike - a.volumeSpike).slice(0, 8);
    return next.sort((a, b) => b.volume - a.volume).slice(0, 8);
  }, [sort, symbols]);

  return <section className={`screener ${open ? 'is-open' : ''}`}><div className="screener-bar"><div className="screener-title"><ArrowDownUp size={13} /><span>MARKET SCREENER</span><small>{symbols.length || '—'} perpetuals tracked</small></div><div className="screener-tabs">{(['volume', 'spike', 'gainers', 'losers', 'pressure'] as ScreenSort[]).map((item) => <button key={item} className={sort === item ? 'active' : ''} onClick={() => { setSort(item); setOpen(true); }}>{item === 'volume' ? 'VOLUME' : item === 'spike' ? 'SPIKE' : item === 'gainers' ? 'GAINERS' : item === 'losers' ? 'LOSERS' : 'PRESSURE'}</button>)}</div><button className="screener-toggle" onClick={() => setOpen((value) => !value)}>{open ? 'CLOSE' : 'OPEN'} <ChevronDown size={12} className={open ? 'rotated' : ''} /></button></div>{open && <div className="screener-grid">{ranked.map((item, index) => <button key={item.symbol} className={`screener-row ${selected === item.symbol ? 'selected' : ''}`} onClick={() => onSelect(item.symbol)}><span className="screener-rank">{String(index + 1).padStart(2, '0')}</span><strong>{item.baseAsset}</strong><span className="screener-symbol">/USDT</span><span className="screener-price">{fmt(item.lastPrice, item.lastPrice > 1000 ? 2 : 4)}</span><span className={`screener-change ${item.change >= 0 ? 'green' : 'red'}`}>{sort === 'spike' ? `${item.volumeSpike.toFixed(1)}×` : `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`}</span><span className="screener-volume">{compact(item.volume)}</span>{item.change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}</button>)}</div>}</section>;
}

function TopBar({ symbol, setSymbol, interval, setInterval, favorites, onFavorite, symbols, status, onReconnect, paused, onPause, compactMode, onCompact }: { symbol: string; setSymbol: (value: string) => void; interval: string; setInterval: (value: string) => void; favorites: string[]; onFavorite: (value: string) => void; symbols: ReturnType<typeof useUsdtSymbols>['symbols']; status: MarketStatus; onReconnect: () => void; paused: boolean; onPause: () => void; compactMode: boolean; onCompact: () => void }) {
  return <><header className="topbar"><div className="brand"><div className="brand-glyph"><span /><span /><span /></div><div><strong>ORDERFLOW</strong><small>BINANCE / USDT-M</small></div></div><div className="top-divider" /><SymbolPicker {...{ symbol, symbols, favorites, onSelect: setSymbol, onFavorite }} /><div className="control-group timeframes">{timeframes.map((item) => <button key={item} className={interval === item ? 'active' : ''} onClick={() => setInterval(item)} data-testid={`button-timeframe-${item}`}>{item}</button>)}</div><div className="top-actions"><button className="icon-button" onClick={onCompact} title="Toggle compact layout" data-testid="button-layout-toggle">{compactMode ? <LayoutPanelLeft size={15} /> : <Grid2X2 size={15} />}</button><button className="icon-button" title="Interface settings" data-testid="button-settings"><SlidersHorizontal size={15} /></button><button className={`feed-button ${paused ? 'is-paused' : ''}`} onClick={onPause} data-testid="button-pause-feed">{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? 'Resume' : 'Pause feed'}</button><StatusPill status={status} onReconnect={onReconnect} /></div></header><div className="ticker-strip"><div className="ticker-label"><Activity size={13} /> MARKET PULSE</div><div className="ticker-copy">Aggressive flow, liquidity & execution pressure <span>•</span> public Binance market data</div><div className="ticker-right"><span className="live-bar" /> stream interval 100ms <span className="ticker-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span></div></div></>;
}

function ModuleRail() {
  const modules = [
    { key: 'price-action', number: '01', title: 'Primary Price Action', detail: 'OHLC / VWAP / walls' },
    { key: 'flow-pressure', number: '02', title: 'Cumulative Price Pressure', detail: 'OHLC flow / delta' },
    { key: 'flow-direction', number: '03', title: 'Candle Direction Balance', detail: 'buyer vs seller attack' },
    { key: 'liquidity-heatmap', number: '04', title: 'Liquidity Heatmap', detail: 'resting order depth' },
    { key: 'recent-tape', number: '05', title: 'Trade Tape', detail: 'aggressive executions' },
  ];
  const focusModule = (key: string) => document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return <nav className="module-rail" aria-label="Terminal modules"><div className="module-rail-label">MODULES</div>{modules.map((module, index) => <button key={module.key} className={`module-item ${index < 3 ? 'primary' : ''}`} onClick={() => focusModule(module.key)} data-testid={`button-module-${module.key}`}><span className="module-number">{module.number}</span><span className="module-copy"><strong>{module.title}</strong><small>{module.detail}</small></span><i className="module-live">LIVE</i></button>)}</nav>;
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

function MarketPulseBar({ openInterest, fundingRate, markPrice, nextFundingTime, imbalance }: ReturnType<typeof useMarketPulse> & { imbalance: { bidStack: number; askStack: number; active: boolean } }) {
  const funding = fundingRate == null ? '—' : `${fundingRate >= 0 ? '+' : ''}${(fundingRate * 100).toFixed(4)}%`;
  const fundingTone = fundingRate == null ? '' : fundingRate >= 0 ? 'red' : 'green';
  const countdown = nextFundingTime ? `${Math.max(0, Math.round((nextFundingTime - Date.now()) / 3_600_000 * 10) / 10)}h` : '—';
  const imbalanceLabel = imbalance.active ? (imbalance.bidStack >= imbalance.askStack ? 'BUY STACK' : 'SELL STACK') : 'BALANCED';
  return <div className="pulse-bar"><div className="pulse-label"><Crosshair size={13} /><span>LIVE DERIVATIVES PULSE</span></div><div className="pulse-metric"><span>OPEN INTEREST</span><strong>{compact(openInterest)}</strong><small>contracts</small></div><div className="pulse-metric"><span>FUNDING RATE</span><strong className={fundingTone}>{funding}</strong><small>next settlement {countdown}</small></div><div className="pulse-metric"><span>MARK PRICE</span><strong>{fmt(markPrice, markPrice && markPrice > 1000 ? 2 : 4)}</strong><small>premium index</small></div><div className="pulse-metric"><span>STACKED IMBALANCE</span><strong className={imbalance.active ? imbalance.bidStack >= imbalance.askStack ? 'green' : 'red' : ''}>{imbalanceLabel}</strong><small>{Math.max(imbalance.bidStack, imbalance.askStack)} levels ≥ 300%</small></div><div className="pulse-status"><i /> Binance Futures public metrics refresh every 15s</div></div>;
}

function DivergenceBanner({ divergences }: { divergences: Divergence[] }) {
  const latest = divergences[divergences.length - 1];
  if (!latest) return null;
  return <div className={`divergence-banner ${latest.type}`}><span className="divergence-pulse" /><strong>{latest.type === 'bullish' ? 'BULLISH DIVERGENCE' : 'BEARISH DIVERGENCE'}</strong><span>Price vs {latest.study === 'pressure' ? 'cumulative pressure' : 'direction balance'}</span><time>{new Date(latest.toTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>;
}

type RiskLevels = { entry: number | null; stop: number | null; target: number | null };

function RiskCalculator({ price, levels, onChange }: { price: number | null; levels: RiskLevels; onChange: (levels: RiskLevels) => void }) {
  const entry = levels.entry == null ? '' : String(levels.entry);
  const stop = levels.stop == null ? '' : String(levels.stop);
  const target = levels.target == null ? '' : String(levels.target);
  const entryValue = levels.entry ?? 0;
  const stopValue = levels.stop ?? 0;
  const targetValue = levels.target ?? 0;
  const risk = Math.abs(entryValue - stopValue);
  const reward = Math.abs(targetValue - entryValue);
  const ratio = risk > 0 && reward > 0 ? reward / risk : null;
  const update = (key: keyof RiskLevels, value: string) => onChange({ ...levels, [key]: value === '' ? null : Number(value) });
  return <Panel title="RISK / REWARD CALCULATOR" hint="Set entry, stop-loss and target levels. The three levels become draggable overlays on the primary price chart."><div className="risk-tool"><div className="risk-input"><label>ENTRY<input value={entry} onChange={(event) => update('entry', event.target.value)} inputMode="decimal" placeholder={price ? fmt(price, 2) : 'Price'} /></label><label>STOP LOSS<input value={stop} onChange={(event) => update('stop', event.target.value)} inputMode="decimal" placeholder="81,000" /></label><label>TAKE PROFIT<input value={target} onChange={(event) => update('target', event.target.value)} inputMode="decimal" placeholder="82,000" /></label></div><div className="risk-result"><Target size={16} /><div><span>PLANNED R:R</span><strong>{ratio == null ? '—' : `1 : ${ratio.toFixed(2)}`}</strong></div><small>{ratio != null ? ratio >= 2 ? 'strong setup' : 'below 1:2' : 'enter all three levels'}</small></div></div></Panel>;
}

function ChartNavigation({ candles, visibleCount, onVisibleCount, windowEnd, onWindowEnd }: { candles: Candle[]; visibleCount: number; onVisibleCount: (value: number) => void; windowEnd: number; onWindowEnd: (value: number) => void }) {
  const maxEnd = candles.length;
  const canBack = windowEnd > visibleCount;
  const canForward = windowEnd < maxEnd;
  return <div className="chart-navigation"><span><Crosshair size={12} /> SYNCED HISTORY <b>{Math.min(visibleCount, candles.length)} / {candles.length || '—'}</b></span><div><button disabled={!canBack} onClick={() => onWindowEnd(Math.max(visibleCount, windowEnd - visibleCount))}>← older</button><button onClick={() => onVisibleCount(Math.max(30, visibleCount - 20))}>−</button><button onClick={() => onVisibleCount(Math.min(1000, visibleCount + 20))}>+</button><button disabled={!canForward} onClick={() => onWindowEnd(Math.min(maxEnd, windowEnd + visibleCount))}>newer →</button><button onClick={() => onWindowEnd(maxEnd)}>LATEST</button></div></div>;
}

function CandleChart({ candles, compactMode, bids, asks, divergences, events, hoveredTime, onHover, riskLevels, onRiskChange, visibleStart, visibleEnd }: { candles: Candle[]; compactMode: boolean; bids: DepthLevel[]; asks: DepthLevel[]; divergences: Divergence[]; events: FlowEvent[]; hoveredTime: number | null; onHover: (time: number | null) => void; riskLevels: RiskLevels; onRiskChange: (levels: RiskLevels) => void; visibleStart: number; visibleEnd: number }) {
  const width = 900; const height = compactMode ? 300 : 385; const pad = { l: 8, r: 52, t: 18, b: 36 };
  const visible = candles.slice(visibleStart, visibleEnd);
  if (!visible.length) return <div className="chart-empty"><div className="skeleton-line wide" /><div className="skeleton-line" /><p>Loading live candles from Binance Futures…</p></div>;
  const min = Math.min(...visible.map((c) => c.low)); const max = Math.max(...visible.map((c) => c.high)); const span = max - min || 1; const xStep = (width - pad.l - pad.r) / visible.length; const y = (value: number) => pad.t + ((max - value) / span) * (height - pad.t - pad.b); const candleWidth = Math.max(3, xStep * 0.56);
  const profile = buildVolumeProfile(visible);
  const vwap = buildVwapBands(visible);
  const maxProfileVolume = Math.max(1, ...profile.map((node) => node.volume));
  const walls = [...bids.slice(0, 16), ...asks.slice(0, 16)].sort((a, b) => b.qty - a.qty).slice(0, 3);
  const eventMap = new Map(events.map((event) => [event.time, event]));
  const xForTime = (time: number) => {
    const index = visible.findIndex((candle) => candle.time === time);
    return index < 0 ? null : pad.l + index * xStep + xStep / 2;
  };
  const path = (key: keyof typeof vwap[number]) => vwap.map((point, index) => `${index ? 'L' : 'M'} ${pad.l + index * xStep + xStep / 2} ${y(point[key])}`).join(' ');
  const riskLine = (key: keyof RiskLevels, label: string, color: string) => {
    const value = riskLevels[key];
    if (value == null || value < min || value > max) return null;
    return <g className="risk-overlay" onPointerDown={(event) => { (event.currentTarget as SVGElement).setPointerCapture(event.pointerId); const move = (moveEvent: PointerEvent) => { const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); const next = max - ((moveEvent.clientY - rect.top) / rect.height) * span; onRiskChange({ ...riskLevels, [key]: Math.max(min, Math.min(max, next)) }); }; const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); }}><line x1={pad.l} x2={width - pad.r} y1={y(value)} y2={y(value)} stroke={color} strokeWidth="1.5" strokeDasharray="5 3" /><text x={pad.l + 5} y={y(value) - 4} className="risk-label" fill={color}>{label} {fmt(value, 2)}</text></g>;
  };
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="candle-svg" role="img" aria-label="Live primary price action candlestick chart" onMouseLeave={() => onHover(null)}>{[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1={pad.l} x2={width - pad.r} y1={pad.t + ratio * (height - pad.t - pad.b)} y2={pad.t + ratio * (height - pad.t - pad.b)} className="chart-grid" /><text x={width - pad.r + 8} y={pad.t + ratio * (height - pad.t - pad.b) + 4} className="axis-label">{fmt(max - ratio * span, 0)}</text></g>)}{profile.map((node, index) => { const nodeY = y(node.price); const nodeHeight = Math.max(3, (height - pad.t - pad.b) / profile.length * .72); const nodeWidth = node.volume / maxProfileVolume * 76; return <rect key={`profile-${index}`} x={width - pad.r - nodeWidth} y={nodeY - nodeHeight / 2} width={nodeWidth} height={nodeHeight} className={node.isPoc ? 'profile-node poc' : 'profile-node'} />; })}<path d={path('upper2')} className="study-band band-outer" /><path d={path('upper1')} className="study-band" /><path d={path('vwap')} className="study-vwap" /><path d={path('lower1')} className="study-band" /><path d={path('lower2')} className="study-band band-outer" />{walls.map((wall, index) => { if (wall.price < min || wall.price > max) return null; return <g key={`wall-${wall.side}-${wall.price}-${index}`}><line x1={pad.l} x2={width - pad.r} y1={y(wall.price)} y2={y(wall.price)} className={`liquidity-wall ${wall.side}`} /><text x={pad.l + 6} y={y(wall.price) - 4} className="wall-label">{wall.side === 'bid' ? 'BID' : 'ASK'} WALL · {compact(wall.qty)}</text></g>; })}{divergences.map((divergence, index) => { const x1 = xForTime(divergence.fromTime); const x2 = xForTime(divergence.toTime); if (x1 == null || x2 == null) return null; return <line key={`price-divergence-${divergence.study}-${index}`} x1={x1} x2={x2} y1={y(divergence.priceFrom)} y2={y(divergence.priceTo)} className={`divergence-line ${divergence.type}`} />; })}{riskLine('entry', 'ENTRY', 'var(--cyan)')}{riskLine('stop', 'STOP', 'var(--red)')}{riskLine('target', 'TARGET', 'var(--green)')}{visible.map((candle, index) => { const x = pad.l + index * xStep + xStep / 2; const bullish = candle.close >= candle.open; const color = bullish ? 'var(--green)' : 'var(--red)'; const event = eventMap.get(candle.time); return <g key={candle.time} className="candle" onMouseEnter={() => onHover(candle.time)}><rect className="candle-hit-area" x={pad.l + index * xStep} y={pad.t} width={xStep} height={height - pad.t - pad.b} />{event?.kind === 'absorption' && <circle className="absorption-mark" cx={x} cy={y(event.price)} r="6" />}{event?.kind.startsWith('sweep') && <text className="sweep-label" x={x} y={event.kind === 'sweep-high' ? y(event.price) - 8 : y(event.price) + 14}>SWEEP</text>}<line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1" /><rect x={x - candleWidth / 2} y={Math.min(y(candle.open), y(candle.close))} width={candleWidth} height={Math.max(1.5, Math.abs(y(candle.open) - y(candle.close)))} fill={color} opacity=".9" /></g>; })}{hoveredTime != null && visible.map((candle, index) => candle.time === hoveredTime ? <line key={`primary-crosshair-${candle.time}`} className="flow-crosshair" x1={pad.l + index * xStep + xStep / 2} x2={pad.l + index * xStep + xStep / 2} y1={pad.t} y2={height - pad.b} /> : null)}{visible.map((candle, index) => <text key={`time-${candle.time}`} className="time-label" x={pad.l + index * xStep + xStep / 2} y={height - 9} textAnchor="middle">{index % Math.max(1, Math.ceil(visible.length / 6)) === 0 ? new Date(candle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</text>)}</svg><div className="chart-legend"><span><i className="legend-green" /> bullish candle</span><span><i className="legend-red" /> bearish candle</span><span><i className="legend-amber" /> POC / volume profile</span><span><i className="legend-cyan" /> VWAP ±1/2σ</span><span><Tip>Primary candles are live Binance klines; walls use the visible depth book.</Tip> DATA: LIVE</span></div></div>;
}

type FlowKind = 'pressure' | 'direction';
type FlowCandle = Candle & { flowOpen: number; flowHigh: number; flowLow: number; flowClose: number; score: number };

function buildFlowCandles(candles: Candle[], kind: FlowKind): FlowCandle[] {
  let running = 0;
  return candles.map((candle) => {
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

function FlowCandleChart({ candles, kind, compactMode, hoveredTime, onHover, divergences, visibleStart, visibleEnd }: { candles: Candle[]; kind: FlowKind; compactMode: boolean; hoveredTime: number | null; onHover: (time: number | null) => void; divergences: Divergence[]; visibleStart: number; visibleEnd: number }) {
  const width = 900;
  const height = compactMode ? 300 : 385;
  const pad = { l: 8, r: 50, t: 16, b: 36 };
  const items = buildFlowCandles(candles.slice(visibleStart, visibleEnd), kind);
  if (!items.length) return <div className="flow-chart-empty"><div className="skeleton-line wide" /><p>Waiting for live trade flow…</p></div>;
  const min = Math.min(...items.map((item) => item.flowLow));
  const max = Math.max(...items.map((item) => item.flowHigh));
  const span = max - min || 1;
  const xStep = (width - pad.l - pad.r) / items.length;
  const y = (value: number) => pad.t + ((max - value) / span) * (height - pad.t - pad.b);
   const candleWidth = Math.max(5, xStep * 0.72);
  const baseline = y(0);
  const xForTime = (time: number) => {
    const index = items.findIndex((item) => item.time === time);
    return index < 0 ? null : pad.l + index * xStep + xStep / 2;
  };
  const flowDivergences = divergences.filter((divergence) => divergence.study === kind);
  const timeLabelEvery = Math.max(1, Math.ceil(items.length / 6));
  return <div className="flow-chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="flow-candle-svg" role="img" aria-label={kind === 'pressure' ? 'Cumulative price pressure candle chart' : 'Cumulative sub-bar direction balance candle chart'} onMouseLeave={() => onHover(null)}>{[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1={pad.l} x2={width - pad.r} y1={pad.t + ratio * (height - pad.t - pad.b)} y2={pad.t + ratio * (height - pad.t - pad.b)} className="flow-grid" /><text x={width - pad.r + 7} y={pad.t + ratio * (height - pad.t - pad.b) + 3} className="axis-label">{kind === 'pressure' ? compact(max - ratio * span) : (max - ratio * span).toFixed(1)}</text></g>)}<line x1={pad.l} x2={width - pad.r} y1={baseline} y2={baseline} className="flow-zero" />{flowDivergences.map((divergence, index) => { const x1 = xForTime(divergence.fromTime); const x2 = xForTime(divergence.toTime); if (x1 == null || x2 == null) return null; return <line key={`flow-divergence-${index}`} x1={x1} x2={x2} y1={y(divergence.studyFrom)} y2={y(divergence.studyTo)} className={`divergence-line ${divergence.type}`} />; })}{items.map((item, index) => { const x = pad.l + index * xStep + xStep / 2; const bullish = item.flowClose >= item.flowOpen; const color = bullish ? 'var(--green)' : 'var(--red)'; const large = item.largeBuyVolume > 0 || item.largeSellVolume > 0; const selected = item.time === hoveredTime; return <g key={item.time} className={`flow-candle${selected ? ' selected' : ''}`} aria-label={`${new Date(item.time).toLocaleTimeString()} · ${bullish ? 'buyers' : 'sellers'} · ${kind === 'pressure' ? `delta ${fmt(item.score, 3)}` : `balance ${item.score.toFixed(2)}`}`}><rect className="flow-hit-area" data-testid={`flow-hit-${kind}-${item.time}`} x={pad.l + index * xStep} y={pad.t} width={xStep} height={height - pad.t - pad.b} onMouseEnter={() => onHover(item.time)} /><line x1={x} x2={x} y1={y(item.flowHigh)} y2={y(item.flowLow)} stroke={color} strokeWidth="1.2" /><rect x={x - candleWidth / 2} y={Math.min(y(item.flowOpen), y(item.flowClose))} width={candleWidth} height={Math.max(2, Math.abs(y(item.flowOpen) - y(item.flowClose)))} fill={color} opacity=".92" />{large && <circle cx={x} cy={Math.max(7, y(item.flowHigh) - 5)} r="3" fill="var(--amber)" stroke="#11161c" strokeWidth="1.5" />}</g>; })}{hoveredTime != null && items.map((item, index) => item.time === hoveredTime ? <line key={`crosshair-${item.time}`} className="flow-crosshair" x1={pad.l + index * xStep + xStep / 2} x2={pad.l + index * xStep + xStep / 2} y1={pad.t} y2={height - pad.b} /> : null)}{items.map((item, index) => <text key={`flow-time-${item.time}`} className="time-label" x={pad.l + index * xStep + xStep / 2} y={height - 9} textAnchor="middle">{index % timeLabelEvery === 0 ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</text>)}</svg><div className="flow-chart-foot"><span><i className="legend-green" /> buyers</span><span><i className="legend-red" /> sellers</span><span><i className="legend-amber" /> large-flow proxy</span><span className="flow-chart-note">Each candle = selected timeframe bar</span></div></div>;
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

function HeavyFlow({ trades, liquidations }: { trades: Trade[]; liquidations: Liquidation[] }) {
  const largeTrades = trades.filter((trade) => trade.isLarge).slice(0, 8);
  return <Panel title="LARGE-FLOW / LIQUIDATION RADAR" hint="Large aggressive prints are a size proxy. Liquidations come from Binance's public forceOrder stream. Neither identifies an institution."><div className="large-flow-note">INSTITUTIONAL-SIZE PROXY <Tip>Unusually large taker trades relative to the current stream baseline.</Tip><span className="radar-count">{liquidations.length} liquidations</span></div><div className="large-flow-list">{largeTrades.length || liquidations.length ? [...largeTrades.map((trade) => <div className="large-flow-row" key={`large-${trade.id}`}><span className={`large-flow-badge ${trade.side}`}>{trade.side === 'buy' ? 'BUY' : 'SELL'}</span><strong>{compact(trade.notional)} USDT</strong><span>{fmt(trade.price, 2)}</span><time>{new Date(trade.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div>), ...liquidations.slice(0, 4).map((order) => <div className="large-flow-row liquidation-row" key={`liquidation-${order.id}`}><span className="large-flow-badge liquidation">LIQ</span><strong>{compact(order.notional)} USDT</strong><span>{fmt(order.price, 2)}</span><time>{new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div>)] : <div className="empty-small">Large prints and liquidations will appear here as they arrive.</div>}</div></Panel>;
}

function AppShell() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('5m');
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(['BTCUSDT', 'ETHUSDT']);
  const [visibleCount, setVisibleCount] = useState(70);
  const [windowEnd, setWindowEnd] = useState(0);
  const [riskLevels, setRiskLevels] = useState<RiskLevels>({ entry: null, stop: null, target: null });
  const { symbols } = useUsdtSymbols();
  const { candles, bids, asks, trades, liquidations, price, change, quoteVolume, status, reconnect } = useBinanceMarket(symbol, interval, paused);
  const pulse = useMarketPulse(symbol);
  const pressureDivergences = useMemo(() => detectDivergences(candles, 'pressure'), [candles]);
  const directionDivergences = useMemo(() => detectDivergences(candles, 'direction'), [candles]);
  const divergences = useMemo(() => [...pressureDivergences, ...directionDivergences].sort((a, b) => b.toTime - a.toTime).slice(-4), [directionDivergences, pressureDivergences]);
  const events = useMemo(() => detectFlowEvents(candles), [candles]);
  const imbalance = useMemo(() => stackedImbalance(bids, asks), [asks, bids]);
  const effectiveEnd = windowEnd === 0 ? candles.length : Math.min(candles.length, Math.max(visibleCount, windowEnd));
  const effectiveStart = Math.max(0, effectiveEnd - visibleCount);
  const toggleFavorite = (value: string) => setFavorites((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  const changeInterval = (value: string) => { setHoveredTime(null); setWindowEnd(0); setInterval(value); };
  const selectSymbol = (value: string) => { setHoveredTime(null); setWindowEnd(0); setSymbol(value); };
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;

  return <main className={compactMode ? 'terminal compact' : 'terminal'}>
     <TopBar {...{ symbol, setSymbol: selectSymbol, interval, setInterval: changeInterval, favorites, onFavorite: toggleFavorite, symbols, status, onReconnect: reconnect, paused, onPause: () => setPaused((value) => !value), compactMode, onCompact: () => setCompactMode((value) => !value) }} />
    <div className="workspace">
      <Overview {...{ symbol, price, change, quoteVolume, bids, asks, candles, status, onReconnect: reconnect }} />
       <VolumeScreener symbols={symbols} selected={symbol} onSelect={selectSymbol} />
       <MarketPulseBar {...pulse} imbalance={imbalance} />
      <DivergenceBanner divergences={divergences} />
      <div className="terminal-body">
        <ModuleRail />
        <div className="main-grid">
          <div className="left-column flow-panel-stack">
            <FlowDetailCard candles={candles} hoveredTime={hoveredTime} />
            <ChartNavigation candles={candles} visibleCount={visibleCount} onVisibleCount={(value) => { setVisibleCount(value); setWindowEnd(0); }} windowEnd={effectiveEnd} onWindowEnd={setWindowEnd} />
            <Panel id="price-action" title="PRIMARY PRICE ACTION / MARKET STRUCTURE" hint="Live OHLC price action with volume profile, point of control and visible orderbook liquidity walls.">
              <div className="flow-module-head"><span className="instrument-label">{symbol} <small>· {interval}</small></span><span className="chart-inline-meta"><span className="legend-green" /> BULL <span className="legend-red" /> BEAR</span><span className="live-tag"><i /> LIVE</span></div>
              <div className="flow-module-subtitle">OHLC price action · volume profile / POC · DOM liquidity walls</div>
               <CandleChart candles={candles} compactMode={compactMode} bids={bids} asks={asks} divergences={divergences} events={events} hoveredTime={hoveredTime} onHover={setHoveredTime} riskLevels={riskLevels} onRiskChange={setRiskLevels} visibleStart={effectiveStart} visibleEnd={effectiveEnd} />
              <div className="chart-study-strip"><span><i className="study-line vwap-line" /> SESSION VWAP</span><span><i className="study-line wall-line" /> LIQUIDITY WALLS</span><span><i className="study-line poc-line" /> POC / PROFILE</span><span className="chart-study-note">Divergence lines update with each live bar</span></div>
            </Panel>
            <Panel id="flow-pressure" title="CUMULATIVE CANDLE / PRICE PRESSURE" hint="The running aggressive-volume balance. Green means buyers are dominant; red means sellers are dominant. Divergence lines compare price lows/highs to this flow series.">
              <div className="flow-module-head"><span className="instrument-label">{symbol} <small>· {interval}</small></span><span className="live-tag"><i /> LIVE</span></div>
              <div className="flow-module-subtitle">OHLC structural pressure flow · buyer initiation vs seller rejection and range activity</div>
               <FlowCandleChart candles={candles} kind="pressure" compactMode={compactMode} hoveredTime={hoveredTime} onHover={setHoveredTime} divergences={divergences} visibleStart={effectiveStart} visibleEnd={effectiveEnd} />
              <FlowReadout candles={candles} kind="pressure" />
            </Panel>
            <Panel id="flow-direction" title="CUMULATIVE CANDLE-DIRECTION BALANCE" hint="The running direction of sub-bar aggression. Green means buyers are attacking the current market; red means sellers are attacking.">
              <div className="flow-module-head"><span className="instrument-label">{symbol} <small>· {interval}</small></span><span className="live-tag"><i /> LIVE</span></div>
              <div className="flow-module-subtitle">One candle = selected bar · direction balance shows who is currently attacking</div>
               <FlowCandleChart candles={candles} kind="direction" compactMode={compactMode} hoveredTime={hoveredTime} onHover={setHoveredTime} divergences={divergences} visibleStart={effectiveStart} visibleEnd={effectiveEnd} />
              <FlowReadout candles={candles} kind="direction" />
            </Panel>
            <div className="lower-grid">
              <Panel title="SESSION READ" hint="A compact read of the current loaded candle set.">
                <div className="session-read"><div><span>Loaded candles</span><b>{candles.length || '—'}</b></div><div><span>Range high</span><b>{candles.length ? fmt(Math.max(...candles.map((item) => item.high)), 2) : '—'}</b></div><div><span>Range low</span><b>{candles.length ? fmt(Math.min(...candles.map((item) => item.low)), 2) : '—'}</b></div><div><span>Top of book</span><b>{bestBid && bestAsk ? `${fmt(bestBid, 1)} / ${fmt(bestAsk, 1)}` : '—'}</b></div></div>
              </Panel>
               <HeavyFlow trades={trades} liquidations={liquidations} />
               <RiskCalculator price={price} levels={riskLevels} onChange={setRiskLevels} />
            </div>
          </div>
          <aside className="right-column">
            <Panel id="liquidity-heatmap" title="LIQUIDITY HEATMAP" hint="A real-time visual of resting bid and ask quantity from the Binance depth stream. Use hover for row details."><Heatmap {...{ bids, asks, price }} /></Panel>
            <Orderbook {...{ bids, asks }} />
            <div id="recent-tape"><Tape trades={trades} /></div>
          </aside>
        </div>
      </div>
    </div>
    <footer className="disclaimer"><span><Sun size={13} /> Public market data only</span><span>Analytics, not financial advice. Binance streams can disconnect or arrive delayed. No execution, account, or private endpoints are used.</span><span className="footer-brand">ORDERFLOW TERMINAL / v0.1</span></footer>
  </main>;
}

export default function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Switch><Route path="/" component={AppShell} /></Switch></WouterRouter>;
}
