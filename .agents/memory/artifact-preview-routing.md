---
name: Artifact preview routing
description: Replit artifact path behavior when multiple web apps are registered in one workspace.
---

Every registered web artifact must use a unique preview path, with only one artifact serving `/`. If two web artifacts claim `/`, the local dev servers may both work directly while the proxied preview returns a routing failure.

**Why:** The proxy routes by artifact path, not only by local port, so duplicate root registrations are ambiguous even when each Vite server is healthy.

**How to apply:** Before presenting a web artifact, inspect registered artifact paths and move any legacy or secondary web artifact to a unique prefix through a validated temporary artifact TOML.