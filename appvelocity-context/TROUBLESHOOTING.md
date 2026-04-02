# Troubleshooting Guide

## Common Issues

### pnpm install fails
- **Symptom:** `ERR_PNPM_PEER_DEP_ISSUES`
- **Fix:** Run `pnpm install --force`

### TypeScript "Cannot find module"
- **Symptom:** `TS2307: Cannot find module '@appvelocity/shared-core'`
- **Fix:** Run `pnpm build --filter=@appvelocity/shared-core` first

### Tests fail with "Cannot find module"
- **Symptom:** Import errors in Vitest
- **Fix:** Add `"moduleNameMapper"` to vitest.config.ts or build dependencies first

### Figma API 403 error
- **Symptom:** `FigmaAuthError: Figma authentication failed`
- **Fix:** Check `FIGMA_ACCESS_TOKEN` in .env is correct

### Figma API 429 error
- **Symptom:** `FigmaRateLimitError: Rate limit exceeded`
- **Fix:** Reduce `FIGMA_RATE_LIMIT_PER_MINUTE` in .env

### Web dashboard won't start
- **Symptom:** `Error: EADDRINUSE: address already in use`
- **Fix:** Kill process on port 3000: `lsof -ti:3000 | xargs kill -9`

### Turbo cache issues
- **Symptom:** Builds produce stale output
- **Fix:** `pnpm turbo run build --force` (bypass cache)

### ESM import errors
- **Symptom:** `ERR_MODULE_NOT_FOUND` or `Cannot use import statement outside a module`
- **Fix:** Ensure `.js` extensions in imports, `"type": "module"` in package.json
