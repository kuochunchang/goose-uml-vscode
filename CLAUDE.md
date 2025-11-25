# Goose Code Review

## Project Overview

**Goose Code Review** is a local AI-assisted code review tool with a web-based interface. It's a CLI tool that starts a local server and opens a browser interface for analyzing code with AI-powered insights and UML visualization.

- **Type**: npm-published CLI tool with monorepo structure
- **Purpose**: Local code review and analysis with AI assistance (read-only, no code editing)
- **Tech Stack**: TypeScript, Node.js, Express, Vue 3, Vuetify, Monaco Editor
- **AI Integration**: OpenAI API for code analysis and review
- **UML Generation**: Mermaid.js for visualizing class diagrams and flowcharts

## Architecture

### Monorepo Structure (npm workspaces)

```
code-review-goose/
├── packages/
│   ├── cli/          # CLI entry point (published to npm)
│   ├── server/       # Express.js backend
│   └── web/          # Vue 3 frontend
│
└── docs/
    ├── REFACTORING_PLAN.md       # 🆕 Planned architecture refactoring
    └── DEVELOPMENT.md            # Development guide
```

### Key Components

- **CLI Package**: Launches server, auto-opens browser, handles port detection
- **Server Package**: REST API for file operations, AI analysis, UML generation, config management
- **Web Package**: SPA with Monaco Editor, Mermaid diagrams, Vuetify UI components
- **VsCode Extension**: Future extension for VS Code integration

## Common Commands

### Development

```bash
npm run dev                  # Run CLI in dev mode with tsx
npm run build               # Build all packages (server → web → cli)
npm run clean               # Clean all build artifacts
```

### Testing

```bash
npm run test                # Run all unit tests (Vitest)
npm run test:e2e            # Run Playwright E2E tests
npm run test:e2e:ui         # Run E2E tests with Playwright UI
npm run test:e2e:debug      # Debug E2E tests
npm test:coverage           # Generate test coverage report
```

### Linting & Formatting

```bash
npm run lint                # ESLint check
npm run format              # Prettier format all files
```

### Package-specific

```bash
cd packages/cli && npm run dev              # Run CLI in dev mode
cd packages/server && npm run dev           # Server with hot reload
cd packages/web && npm run dev              # Vite dev server with HMR
```

## Code Style & Conventions

### TypeScript

- **Strict mode enabled** - No implicit any, strict null checks
- Use ES modules (`import/export`), not CommonJS (`require`)
- Destructure imports when possible: `import { foo } from 'bar'`
- Prefer explicit types over `any`, use `unknown` when type is truly unknown
- Use modern ES2022+ features (target: ES2022)

### File Naming

- Use kebab-case for files: `ai-service.ts`, `file-analysis.spec.ts`
- Use PascalCase for classes and components: `AIService`, `FileViewer.vue`
- Use camelCase for variables and functions: `generateUML`, `fileContent`

### Vue 3 Guidelines

- **Composition API only** (no Options API)
- Use TypeScript with `<script setup lang="ts">`
- Import types with `import type { ... }`
- Use Pinia for state management
- Follow Vuetify 3 component conventions

### Comments & Documentation

- **Always use English** for all comments and documentation
- Add JSDoc comments for public APIs and exported functions
- Explain "why" not "what" in comments
- Document complex algorithms or non-obvious logic

## Project-Specific Patterns

## Testing Strategy

### Unit Tests (Vitest)

- Server: Mock file system (`fs-extra`), OpenAI API
- Test files: `__tests__/*.test.ts` or `*.spec.ts`
- Coverage: Generate with `npm run test:coverage`

### E2E Tests (Playwright)

**Framework**: Playwright - A modern, reliable end-to-end testing framework for web applications.

**Location**: `packages/web/e2e/`

**Configuration**: `playwright.config.ts` at the root of the project

#### Playwright Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with Playwright UI (visual test runner)
npm run test:e2e:ui

# Debug E2E tests interactively
npm run test:e2e:debug

# Run a single test file
npm run test:e2e -- simple-load.spec.ts

# Run tests with specific options
npm run test:e2e -- --repeat-each=3  # Repeat each test 3 times (for flaky test detection)
npm run test:e2e -- --headed          # Run tests in headed mode (visible browser)
npm run test:e2e -- --project=chromium # Run only on Chromium browser
```

#### Playwright Test Structure

E2E tests should follow this structure:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate to the page, set up test data
    await page.goto("http://localhost:3000");
  });

  test("should do something", async ({ page }) => {
    // Arrange: Set up test conditions

    // Act: Perform user actions
    await page.click("button#submit");

    // Assert: Verify expected outcomes
    await expect(page.locator(".result")).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup if necessary
  });
});
```

#### Playwright Test Checklist

Before committing E2E tests, verify:

- ✅ Tests run successfully with `npm run test:e2e`
- ✅ Tests are deterministic (not flaky) - run multiple times to verify
- ✅ Tests use proper selectors (user-facing attributes, not brittle CSS classes)
- ✅ Tests validate complete user workflows end-to-end
- ✅ Tests cover both success and error scenarios
- ✅ Tests are well-documented with clear test descriptions
- ✅ Tests run in reasonable time (avoid unnecessarily long tests)
- ✅ Tests don't leave side effects (clean up after themselves)

### Testing Best Practices

- Prefer running single tests during development for performance
- Always run full test suite before committing
- Check E2E tests if changing API endpoints or frontend behavior
- Use `npm run test:coverage` to ensure adequate coverage

## Build & Deploy

### Build Order (IMPORTANT)

Must build in this specific order due to dependencies:

1. `npm run build -w @code-review-goose/server` (builds server)
2. `npm run build -w @code-review-goose/web` (builds web UI)
3. `npm run build -w @kuochunchang/goose-code-review` (builds CLI, copies server-dist & web-dist)

Or simply: `npm run build` (handles order automatically)

### Publishing

**Published npm Packages** (Post-Refactoring):

**Application Packages**: 5. `@kuochunchang/goose-code-review` - CLI tool (includes server and web)

- Includes: `dist/`, `server-dist/`, `web-dist/`
- Binary commands: `goose` and `goose-code-review`

**Future Packages**:

- `@code-review-goose/analysis-adapter-vscode` - VS Code adapter
- VS Code Extension - Published to VS Code Marketplace (not npm)

**Version Management**:

- Uses **Changesets** for independent versioning
- Each package can have its own version number
- `npx changeset` to create a changeset
- `npx changeset version` to bump versions
- `npx changeset publish` to publish all updated packages

**Publishing Workflow**:

```bash
# 1. Make changes to packages
# 2. Create changeset
npx changeset

# 3. Version and publish (usually in CI/CD)
npx changeset version
npx changeset publish
```

### Port Detection

- CLI auto-detects available ports starting from 3000
- Server uses `detect-port` to avoid conflicts
- Frontend dev mode uses Vite default (5173)

### Browser Auto-Open

- CLI automatically opens default browser unless `--no-open` flag
- Use `--port` or `-p` to specify custom port

## Workflow Guidelines

### ⚠️ CRITICAL: Pre-Development Checklist

**BEFORE starting ANY new feature or modification, you MUST follow these steps:**

1. **Verify you are NOT on main branch**
   - Run: `git branch --show-current`
   - If on `main`, DO NOT proceed - create a feature branch first

2. **Check working directory is clean**
   - Run: `git status`
   - Ensure no uncommitted changes exist
   - If dirty, commit or stash changes before proceeding

3. **Create appropriate feature branch**
   - Branch naming convention: `feature/description`, `fix/description`, `docs/description`
   - Run: `git checkout -b feature/your-feature-name`
   - Use descriptive names that reflect the work being done

4. **Only then begin development work**

**If any check fails:**

- ❌ STOP immediately
- ⚠️ Alert the user about the issue
- 📋 Provide clear instructions on how to resolve
- ✅ Wait for confirmation before proceeding

**Example workflow:**

```bash
# Check current branch
git branch --show-current  # Should NOT be 'main'

# Check working directory
git status  # Should be clean

# Create feature branch
git checkout -b feature/add-new-analysis-type

# Now you can proceed with development
```

### Making Changes

1. **Explore first**: Read relevant files before coding
2. **Plan**: Think through the approach, especially for complex features
3. **Code**: Implement with proper TypeScript types
4. **Test**: Run relevant tests (`npm test`, `npm run test:e2e`)
5. **Verify**: Check build (`npm run build`), lint (`npm run lint`), typecheck (automatically done in build)
6. **Commit**: Use conventional commit format

### ⚠️ CRITICAL: Testing Requirements

**YOU MUST follow these rules before pushing any code:**

- ✅ **New features MUST have complete test coverage**
  - Unit tests for all new service functions
  - E2E tests for all user-facing features
  - Test both success and error scenarios
  - **MANDATORY**: Achieve minimum 80% code coverage for new code
- ✅ **Modified features MUST have updated tests**
  - Update existing tests to reflect changes
  - Add new test cases for new behavior
  - Ensure no regression in existing functionality
  - **MANDATORY**: Strengthen tests to maintain or exceed 80% coverage
- ✅ **UI/UX changes REQUIRE E2E tests**
  - ANY modification to Vue components, views, or user interactions MUST include E2E tests
  - Test user workflows end-to-end, not just component rendering
  - Verify UI changes work correctly in actual browser environment
  - Cover edge cases and error states in the UI
- ✅ **Coverage verification is MANDATORY after every change**
  - Run `npm run test:coverage` after implementing ANY feature or fix
  - Check both overall coverage and individual file/function coverage
  - If ANY function has less than 80% coverage, add more tests immediately
  - If overall project coverage drops below 80%, strengthen tests before committing
- ✅ **All tests AND lint checks MUST pass before pushing**
  - Run `npm test` - all unit tests must pass
  - Run `npm run test:e2e` - all E2E tests must pass
  - Run `npm run lint` - ZERO linting errors allowed
  - Run `npm run build` - build must succeed without errors
- ❌ **DO NOT push code if ANY test OR lint check fails**
- ❌ **DO NOT skip writing tests to save time**
- ❌ **DO NOT commit code without running the full test suite**
- ❌ **DO NOT ignore linting errors - fix them before committing**
- ❌ **DO NOT push code with coverage below 80% - NO EXCEPTIONS**

**Pre-commit checklist (run in this order):**

1. `npm run lint` - Fix all ESLint and Prettier errors
2. `npm test` - Ensure all unit tests pass
3. `npm run test:coverage` - **MANDATORY**: Check coverage report
   - Verify overall coverage ≥ 80%
   - Verify each modified/new file has ≥ 80% coverage
   - If below 80%, write additional tests immediately
4. `npm run build` - Verify build succeeds
5. `npm run test:e2e` - Run E2E tests for user-facing changes
6. Review coverage report one final time
7. Only then commit and push

**Test coverage expectations (STRICT ENFORCEMENT):**

- **Overall project coverage**: Minimum 80% - NO EXCEPTIONS
- **Individual functions**: Each function must have ≥ 80% coverage
- **Services**: Minimum 80% coverage for ALL business logic
- **API routes**: Test ALL endpoints (success + error cases) - 100% coverage expected
- **Vue components**: Test user interactions and state changes - minimum 80% coverage
- **E2E tests**: Cover ALL critical user workflows end-to-end
- **New/modified files**: Must meet or exceed 80% coverage before committing

**Coverage enforcement rules:**

- If any function falls below 80% coverage → Write more test cases
- If overall coverage falls below 80% → Strengthen tests across the board
- If UI components lack E2E tests → Add E2E tests immediately
- Coverage reports must be checked after EVERY code change
- Pull requests with <80% coverage will be REJECTED

### Server Key Dependencies

- `express` - Web framework
- `openai` - OpenAI API client
- `@code-review-goose/analysis-core` - Core UML analysis engine
- `@code-review-goose/analysis-adapter-node` - Node.js file system adapter
- `detect-port` - Port availability checking

### Web Key Dependencies

- `vue` (3.x) - Framework
- `vuetify` (3.x) - Material Design UI library
- `monaco-editor` - VS Code editor component
- `mermaid` - UML diagram rendering
- `marked` - Markdown rendering
- `axios` - HTTP client
- `pinia` - State management
- `splitpanes` - Resizable split panes

### CLI Key Dependencies

- `commander` - CLI framework
- `detect-port` - Port availability checking
- `open` - Cross-platform browser opening
- `chalk` - Terminal colors

## Troubleshooting Tips

### Build issues

- Clean and reinstall: `npm run clean && npm install && npm run build`
- Check build order if individual package builds fail
- Ensure TypeScript compilation succeeds before debugging further

### Runtime issues

- Port conflicts: CLI handles automatically, but check if port is explicitly specified
- API key errors: Verify `.code-review/config.json` exists with valid OpenAI key
- File not found: Check ignore patterns and file size limits

### Test failures

**Unit test failures (Vitest)**:

- Mock issues: Ensure all external dependencies are properly mocked
- Import errors: Check module resolution and TypeScript configuration
- Coverage drops: Run `npm run test:coverage` to identify uncovered code

**E2E test failures (Playwright)**:

- **Server startup**: E2E tests automatically start their own server - no manual server needed
- **Timeout issues**:
  - Increase timeout in `playwright.config.ts` for slow operations
  - Use `test.setTimeout(60000)` for specific tests needing more time
  - Check if CI environment needs different timeout values
- **Flaky tests**:
  - Run with `--repeat-each=3` to identify intermittent failures
  - Check for race conditions in async operations
  - Ensure proper wait conditions before assertions
  - Avoid hard-coded waits (`waitForTimeout`) - use `waitForSelector` instead
- **Selector failures**:
  - Use Playwright Inspector: `npm run test:e2e:debug`
  - Check if selectors are too brittle (CSS classes changed)
  - Prefer `data-testid` attributes for test stability
  - Use `page.pause()` to inspect the page during test execution
- **Network errors**:
  - Check if API mocking is set up correctly
  - Verify backend routes are accessible
  - Use `page.route()` to mock external API calls if needed
- **Screenshot mismatches** (visual testing):
  - Update baseline screenshots: `npm run test:e2e -- --update-snapshots`
  - Check if UI changes are intentional
  - Different OS may produce slightly different screenshots
- **Debugging tips**:
  - Visual debugging: `npm run test:e2e:ui`
  - Verbose logging: `DEBUG=pw:api npm run test:e2e`
  - Pause execution: Add `await page.pause()` in test code
  - View trace files: `npx playwright show-trace trace.zip`
  - Run headed mode: `npm run test:e2e -- --headed`

### External Documentation

- **GitHub repo**: https://github.com/kuochunchang/code-review-goose
- **OpenAI API docs**: https://platform.openai.com/docs
- **Mermaid syntax**: https://mermaid.js.org/
- **Vuetify docs**: https://vuetifyjs.com/
- **Monaco Editor API**: https://microsoft.github.io/monaco-editor/
- **Playwright docs**: https://playwright.dev/
- **Playwright best practices**: https://playwright.dev/docs/best-practices
- **npm workspaces**: https://docs.npmjs.com/cli/v8/using-npm/workspaces
- **TypeScript Project References**: https://www.typescriptlang.org/docs/handbook/project-references.html
- **Changesets**: https://github.com/changesets/changesets
