# Binance Orderflow Terminal

A live Binance USDT-M Futures market analytics terminal for reading price action, cumulative pressure, candle direction balance, and order-book liquidity.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/binance-orderflow run dev` — run the live orderflow terminal
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/binance-orderflow/src/App.tsx` — terminal shell and product controls
- `artifacts/binance-orderflow/src/hooks/use-binance-market.ts` — Binance public REST/WebSocket market-data client
- `artifacts/binance-orderflow/src/index.css` — terminal theme and responsive layout
- `artifacts/binance-orderflow/.replit-artifact/artifact.toml` — web artifact routing

## Architecture decisions

- Market data comes directly from Binance Futures public REST and WebSocket streams; no account credentials are required for this analytics surface.
- The browser maintains symbol/timeframe subscriptions and reconnects when the stream drops, with connection state shown in the UI.
- Orderflow metrics are derived from live aggregate trades and candles: buy/sell volume imbalance drives cumulative pressure and direction-balance views.
- The heatmap is a live depth snapshot visualization, not an execution or order-placement interface.

## Product

- Live USDT perpetual symbol search, favorites, and top-volume shortcuts
- 1m through 4h timeframe controls
- Live candlesticks, cumulative price pressure, candle-direction balance, recent trades, and session context
- Depth-based bid/ask liquidity heatmap with hover details and orderbook imbalance
- Pause/resume, reconnect, and compact/expanded layout controls
- Visible market-data disclaimer; no private account or order execution functionality

## User preferences

- User requested a polished dark trading-terminal experience inspired by the attached reference image.
- User requested live Binance Futures data, 1m–4h timeframes, cumulative pressure/delta, direction balance, and liquidity heatmap.

## Gotchas

- The frontend Vite config requires `PORT` and `BASE_PATH` when running build commands manually; the managed workflow supplies them automatically.
- Do not place Binance API credentials in frontend code. Public market streams cover this dashboard; account-specific features would need a separate secure server-side integration.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
