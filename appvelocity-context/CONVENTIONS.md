# Code Conventions & Standards

## TypeScript

- **Strict Mode:** Always enabled (`strict: true` in tsconfig)
- **ESM Only:** Use `.js` extensions in imports (`./utils/logger.js`)
- **Type Annotations:** Explicit return types on exported functions
- **No `any`:** Use `unknown` and narrow with type guards

## Naming

- **Files:** kebab-case (`figma-client.ts`)
- **Classes:** PascalCase (`FigmaClient`, `IRBuilder`)
- **Functions:** camelCase (`parseVariables`, `createLogger`)
- **Constants:** SCREAMING_SNAKE_CASE (`FIGMA_URL_RE`)
- **Interfaces:** PascalCase with `I` prefix optional (`FigmaFile` or `IFigmaFile`)

## Code Style

- **Line Length:** 100 characters max
- **Indentation:** 2 spaces
- **Quotes:** Single quotes (`'string'`)
- **Semicolons:** Required
- **Trailing Commas:** Always in multi-line

## Testing

- **Framework:** Vitest
- **Naming:** `*.test.ts` (e.g., `client.test.ts`)
- **Structure:** `describe` → `it` blocks
- **Coverage Target:** 85%+ lines, functions, branches
- **Mocking:** Use `vi.mock()`, axios-mock-adapter for HTTP

## Logging

- **Library:** Winston
- **Format:** JSON in prod, colorized in dev
- **Levels:** error > warn > info > debug
- **Context:** Use module-scoped loggers (`createLogger('FigmaClient')`)

## Error Handling

- **Custom Errors:** Extend `Error` with specific classes (`FigmaApiError`)
- **Recoverable Flag:** Include `recoverable: boolean` in `AgentError`
- **Stack Traces:** Always preserve (`Error.captureStackTrace`)

## Git Commits

- **Format:** `type(scope): message`
- **Types:** feat, fix, docs, test, refactor, chore
- **Examples:**
  - `feat(workflow): add PlannerAgent with LLM integration`
  - `fix(client): handle 429 rate limit correctly`
  - `test(parsers): add tests for parseAutoLayout edge cases`
