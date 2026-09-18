import type { Candle } from '@/hooks/use-binance-market';

export type DivergenceKind = 'pressure' | 'direction';
export type DivergenceType = 'bullish' | 'bearish';

export type Divergence = {
  type: DivergenceType;
  study: DivergenceKind;
  fromTime: number;
  toTime: number;
  priceFrom: number;
  priceTo: number;
  studyFrom: number;
  studyTo: number;
};

export type VolumeProfileNode = {
  price: number;
  volume: number;
  isPoc: boolean;
};

export type VwapPoint = {
  time: number;
  vwap: number;
  upper1: number;
  upper2: number;
  lower1: number;
  lower2: number;
};

export type FlowEvent = {
  time: number;
  kind: 'absorption' | 'sweep-high' | 'sweep-low';
  price: number;
  detail: string;
};

export type SwingLiquidity = {
  side: 'bid' | 'ask';
  swingType: 'high' | 'low';
  swingTime: number;
  swingPrice: number;
  zonePrice: number;
  totalQty: number;
  totalNotional: number;
  levelCount: number;
  distancePct: number;
};

function studyValue(candle: Candle, study: DivergenceKind) {
  return study === 'pressure'
    ? candle.delta
    : candle.directionBias || (candle.close >= candle.open ? 1 : -1);
}

function cumulativeStudy(candles: Candle[], study: DivergenceKind) {
  let running = 0;
  return candles.map((candle) => {
    running += studyValue(candle, study);
    return running;
  });
}

function isPivotLow(values: number[], index: number) {
  return values[index] <= values[index - 1] && values[index] <= values[index + 1];
}

function isPivotHigh(values: number[], index: number) {
  return values[index] >= values[index - 1] && values[index] >= values[index + 1];
}

export function detectDivergences(candles: Candle[], study: DivergenceKind): Divergence[] {
  if (candles.length < 8) return [];

  const recent = candles.slice(-80);
  const pricesLow = recent.map((candle) => candle.low);
  const pricesHigh = recent.map((candle) => candle.high);
  const flow = cumulativeStudy(recent, study);
  const results: Divergence[] = [];
  const lows = recent.map((_, index) => index).filter((index) => index > 0 && index < recent.length - 1 && isPivotLow(pricesLow, index));
  const highs = recent.map((_, index) => index).filter((index) => index > 0 && index < recent.length - 1 && isPivotHigh(pricesHigh, index));

  for (let index = 1; index < lows.length; index += 1) {
    const from = lows[index - 1];
    const to = lows[index];
    if (pricesLow[to] < pricesLow[from] && flow[to] > flow[from]) {
      results.push({ type: 'bullish', study, fromTime: recent[from].time, toTime: recent[to].time, priceFrom: pricesLow[from], priceTo: pricesLow[to], studyFrom: flow[from], studyTo: flow[to] });
    }
  }

  for (let index = 1; index < highs.length; index += 1) {
    const from = highs[index - 1];
    const to = highs[index];
    if (pricesHigh[to] > pricesHigh[from] && flow[to] < flow[from]) {
      results.push({ type: 'bearish', study, fromTime: recent[from].time, toTime: recent[to].time, priceFrom: pricesHigh[from], priceTo: pricesHigh[to], studyFrom: flow[from], studyTo: flow[to] });
    }
  }

  return results.slice(-4);
}

export function buildVolumeProfile(candles: Candle[], binCount = 14): VolumeProfileNode[] {
  if (!candles.length) return [];
  const min = Math.min(...candles.map((candle) => candle.low));
  const max = Math.max(...candles.map((candle) => candle.high));
  const span = max - min || 1;
  const nodes = Array.from({ length: binCount }, (_, index) => ({
    price: min + ((index + 0.5) / binCount) * span,
    volume: 0,
    isPoc: false,
  }));

  candles.forEach((candle) => {
    const index = Math.max(0, Math.min(binCount - 1, Math.floor(((candle.close - min) / span) * binCount)));
    nodes[index].volume += candle.volume;
  });

  const poc = Math.max(...nodes.map((node) => node.volume));
  return nodes.map((node) => ({ ...node, isPoc: node.volume === poc }));
}

export function buildSwingLiquidity(
  candles: Candle[],
  bids: { price: number; qty: number }[],
  asks: { price: number; qty: number }[],
): SwingLiquidity[] {
  if (candles.length < 5 || (!bids.length && !asks.length)) return [];

  const recent = candles.slice(-160);
  const averageRange = recent.reduce((sum, candle) => sum + candle.high - candle.low, 0) / recent.length;
  const averagePrice = recent.reduce((sum, candle) => sum + candle.close, 0) / recent.length;
  const priceBand = Math.max(averageRange * 0.55, averagePrice * 0.0008);
  const candidates: Array<{ candle: Candle; swingType: 'high' | 'low'; levels: { price: number; qty: number }[] }> = [];

  for (let index = 2; index < recent.length - 2; index += 1) {
    const candle = recent[index];
    const neighborhood = recent.slice(index - 2, index + 3);
    const isHigh = candle.high >= Math.max(...neighborhood.map((item) => item.high));
    const isLow = candle.low <= Math.min(...neighborhood.map((item) => item.low));
    if (isHigh) candidates.push({ candle, swingType: 'high', levels: asks });
    if (isLow) candidates.push({ candle, swingType: 'low', levels: bids });
  }

  const zones = candidates.map(({ candle, swingType, levels }) => {
    const matched = levels.filter((level) => Math.abs(level.price - (swingType === 'high' ? candle.high : candle.low)) <= priceBand);
    if (!matched.length) return null;
    const totalQty = matched.reduce((sum, level) => sum + level.qty, 0);
    const totalNotional = matched.reduce((sum, level) => sum + level.price * level.qty, 0);
    const zonePrice = totalQty ? totalNotional / totalQty : matched[0].price;
    return {
      side: swingType === 'high' ? 'ask' as const : 'bid' as const,
      swingType,
      swingTime: candle.time,
      swingPrice: swingType === 'high' ? candle.high : candle.low,
      zonePrice,
      totalQty,
      totalNotional,
      levelCount: matched.length,
      distancePct: Math.abs(zonePrice - (swingType === 'high' ? candle.high : candle.low)) / Math.max(candle.close, 1) * 100,
    };
  }).filter((zone): zone is SwingLiquidity => Boolean(zone))
    .sort((a, b) => b.totalNotional - a.totalNotional);

  const selected: SwingLiquidity[] = [];
  for (const zone of zones) {
    if (selected.some((item) => item.side === zone.side)) continue;
    selected.push(zone);
    if (selected.length === 2) break;
  }
  return selected.sort((a, b) => a.zonePrice - b.zonePrice);
}

export function buildVwapBands(candles: Candle[]): VwapPoint[] {
  let cumulativeVolume = 0;
  let cumulativePriceVolume = 0;
  const typicalPrices = candles.map((candle) => (candle.high + candle.low + candle.close) / 3);

  return candles.map((candle, index) => {
    const typical = typicalPrices[index];
    cumulativeVolume += candle.volume;
    cumulativePriceVolume += typical * candle.volume;
    const vwap = cumulativeVolume ? cumulativePriceVolume / cumulativeVolume : typical;
    const variance = candles.slice(0, index + 1).reduce((sum, item, itemIndex) => {
      const distance = typicalPrices[itemIndex] - vwap;
      return sum + distance * distance * item.volume;
    }, 0) / Math.max(cumulativeVolume, 1);
    const deviation = Math.sqrt(Math.max(variance, 0));
    return { time: candle.time, vwap, upper1: vwap + deviation, upper2: vwap + deviation * 2, lower1: vwap - deviation, lower2: vwap - deviation * 2 };
  });
}

export function detectFlowEvents(candles: Candle[]): FlowEvent[] {
  if (candles.length < 8) return [];
  const volumes = candles.map((candle) => candle.volume);
  const averageVolume = volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length;
  const volumeDeviation = Math.sqrt(volumes.reduce((sum, volume) => sum + (volume - averageVolume) ** 2, 0) / volumes.length);
  const rangeAverage = candles.reduce((sum, candle) => sum + candle.high - candle.low, 0) / candles.length;
  const events: FlowEvent[] = [];

  candles.forEach((candle, index) => {
    const prior = candles[index - 1];
    if (!prior) return;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const highSweep = candle.high > prior.high && candle.close < prior.high && upperWick > (candle.high - candle.low) * 0.35;
    const lowSweep = candle.low < prior.low && candle.close > prior.low && lowerWick > (candle.high - candle.low) * 0.35;
    if (highSweep) events.push({ time: candle.time, kind: 'sweep-high', price: candle.high, detail: 'Wick swept prior swing high and closed back inside' });
    if (lowSweep) events.push({ time: candle.time, kind: 'sweep-low', price: candle.low, detail: 'Wick swept prior swing low and closed back inside' });

    const aggressive = volumeDeviation > 0 && candle.volume > averageVolume + volumeDeviation * 2.5;
    const littleMovement = candle.high - candle.low <= Math.max(rangeAverage * 0.7, 1e-8);
    const strongDelta = Math.abs(candle.delta) > Math.max(candle.volume * 0.35, 1e-8);
    if (aggressive && littleMovement && strongDelta) {
      events.push({ time: candle.time, kind: 'absorption', price: candle.close, detail: 'Aggressive delta with limited price movement' });
    }
  });
  return events.slice(-18);
}

export function stackedImbalance(bids: { price: number; qty: number }[], asks: { price: number; qty: number }[]) {
  const bidStack = bids.slice(0, 12).filter((level, index) => {
    const ask = asks[index];
    return ask && level.qty / Math.max(ask.qty, 1e-8) >= 3;
  }).length;
  const askStack = asks.slice(0, 12).filter((level, index) => {
    const bid = bids[index];
    return bid && level.qty / Math.max(bid.qty, 1e-8) >= 3;
  }).length;
  return { bidStack, askStack, active: Math.max(bidStack, askStack) >= 3 };
}