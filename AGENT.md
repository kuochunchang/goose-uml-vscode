# Goose Code Review

## Project Overview

**Goose Code Review** is a VS Code extension for AI-assisted code review and analysis. It provides UML diagram generation, Git change analysis, and SonarQube integration directly within VS Code.

- **Type**: VS Code Extension with monorepo structure
- **Purpose**: Code review, UML visualization, and Git analysis within VS Code
- **Tech Stack**: TypeScript, VS Code Extension API, Tree-sitter parsers
- **AI Integration**: OpenAI and Google Gemini for code analysis
- **UML Generation**: Mermaid.js for visualizing class diagrams, sequence diagrams, and flowcharts
- **Git Integration**: Simple-git for Git operations, Octokit for GitHub PR analysis
- **SonarQube**: Integration with SonarQube for code quality analysis

## Architecture

### Monorepo Structure (npm workspaces)

```
code-review-goose/
├── packages/
│   ├── analysis-types/              # Type definitions
│   ├── analysis-utils/              # Shared utilities
│   ├── analysis-core/               # Platform-agnostic analysis engine
│   ├── analysis-adapter-node/       # Node.js file system adapter
│   ├── analysis-adapter-vscode/     # VS Code file system adapter
│   ├── analysis-parser-common/      # Common parser utilities
│   ├── analysis-parser-typescript/  # TypeScript/JavaScript parser
│   ├── analysis-parser-java/        # Java parser
│   ├── analysis-parser-python/      # Python parser
│   ├── git-analyzer/                # Git change analysis & SonarQube
│   └── vscode-extension/            # VS Code Extension (main app)
│
└── docs/
    ├── ARCHITECTURE.md              # Architecture documentation
    └── DEVELOPMENT.md               # Development guide
```

### Key Components

- **VS Code Extension**: Main application with UML panels, Git analysis views, and SonarQube integration
- **Analysis Core**: Platform-agnostic UML and code analysis engine
- **Language Parsers**: Tree-sitter based parsers for TypeScript, JavaScript, Java, and Python
- **Git Analyzer**: Git change analysis, branch comparison, and PR analysis with SonarQube integration
- **File Providers**: Adapters for Node.js and VS Code file systems

## Common Commands

### Development

```bash
npm run build               # Build all packages
npm run build:packages      # Build only core packages (types, utils, core, parsers, git-analyzer, vscode-extension)
npm run clean               # Clean all build artifacts
```

### Testing

```bash
npm run test                # Run all unit tests (Vitest)
npm run test:coverage       # Generate test coverage report
```

### Linting & Formatting

```bash
npm run lint                # ESLint check
npm run format              # Prettier format all files
```

### VS Code Extension Development

```bash
cd packages/vscode-extension
npm run build               # Build extension
npm run watch               # Watch mode for development
npm run package             # Package extension as .vsix
```

To test the extension:
1. Press F5 in VS Code to launch Extension Development Host
2. Or run `npm run watch` and reload the extension window

## Code Style & Conventions

### TypeScript

- **Strict mode enabled** - No implicit any, strict null checks
- Use ES modules (`import/export`), not CommonJS (`require`)
- Destructure imports when possible: `import { foo } from 'bar'`
- Prefer explicit types over `any`, use `unknown` when type is truly unknown
- Use modern ES2022+ features (target: ES2022)

### File Naming

- Use kebab-case for files: `ai-service.ts`, `file-analysis.spec.ts`
- Use PascalCase for classes and components: `AIService`, `UMLAnalyzer`
- Use camelCase for variables and functions: `generateUML`, `fileContent`

### VS Code Extension Guidelines

- Follow VS Code Extension API best practices
- Use proper activation events to minimize extension load time
- Dispose resources properly to avoid memory leaks
- Use VS Code's built-in UI components (TreeView, WebView, etc.)
- Handle errors gracefully with user-friendly messages

### Comments & Documentation

- **Always use English** for all comments and documentation
- Add JSDoc comments for public APIs and exported functions
- Explain "why" not "what" in comments
- Document complex algorithms or non-obvious logic

## Project-Specific Patterns

## Testing Strategy

### Unit Tests (Vitest)

- Core packages: Mock file system operations
- Git analyzer: Mock git operations and API calls
- Test files: `__tests__/*.test.ts` or `*.spec.ts`
- Coverage: Generate with `npm run test:coverage`

### VS Code Extension Testing

- Use VS Code Extension Test Runner
- Test extension activation and commands
- Mock VS Code APIs when needed
- Test file provider implementations

### Testing Best Practices

- Write tests for all new features
- Maintain minimum 80% code coverage
- Test both success and error scenarios
- Use descriptive test names
- Always run full test suite before committing

## Build & Deploy

### Build Order (IMPORTANT)

Must build in this specific order due to dependencies:

1. `npm run build` (builds all packages in correct order using TypeScript project references)

Or build specific packages:
```bash
npm run build:packages  # Build core packages only
cd packages/vscode-extension && npm run build  # Build extension
```

### Publishing

**Published Packages**:

**Core Library Packages** (npm):
1. `@code-review-goose/analysis-types` - Type definitions
2. `@code-review-goose/analysis-utils` - Shared utilities
3. `@code-review-goose/analysis-core` - Analysis engine
4. `@code-review-goose/analysis-adapter-node` - Node.js adapter
5. `@code-review-goose/analysis-adapter-vscode` - VS Code adapter
6. `@code-review-goose/analysis-parser-common` - Common parser utilities
7. `@code-review-goose/analysis-parser-typescript` - TypeScript/JavaScript parser
8. `@code-review-goose/analysis-parser-java` - Java parser
9. `@code-review-goose/analysis-parser-python` - Python parser
10. `@code-review-goose/git-analyzer` - Git analysis and SonarQube integration

**VS Code Extension** (VS Code Marketplace):
- `goose-code-review-vscode` - Published to VS Code Marketplace

**Version Management**:

- Uses **Changesets** for independent versioning
- Each package can have its own version number
- `npx changeset` to create a changeset
- `npx changeset version` to bump versions
- `npx changeset publish` to publish npm packages

**VS Code Extension Publishing**:

```bash
cd packages/vscode-extension

# Package extension
npm run package

# Publish to marketplace (requires publisher account)
npx vsce publish
```

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

### Core Package Dependencies

- `@babel/parser`, `@babel/traverse`, `@babel/types` - JavaScript/TypeScript AST parsing
- `tree-sitter` - Universal parser generator
- `tree-sitter-typescript`, `tree-sitter-java`, `tree-sitter-python` - Language-specific parsers

### VS Code Extension Dependencies

- `vscode` - VS Code Extension API
- `@code-review-goose/analysis-core` - Core UML analysis engine
- `@code-review-goose/analysis-adapter-vscode` - VS Code file system adapter
- `@code-review-goose/git-analyzer` - Git change analysis
- `openai` - OpenAI API client
- `@google/generative-ai` - Google Gemini API client

### Git Analyzer Dependencies

- `simple-git` - Git operations
- `@octokit/rest` - GitHub API client
- `sonarqube-scanner` - SonarQube integration

## Troubleshooting Tips

### Build issues

- Clean and reinstall: `npm run clean && npm install && npm run build`
- Check TypeScript project references if individual package builds fail
- Ensure all dependencies are installed: `npm install`

### Runtime issues

- **Extension not activating**: Check activation events in `package.json`
- **Commands not appearing**: Reload VS Code window (Cmd+R / Ctrl+R)
- **API key errors**: Check VS Code settings for AI provider configuration
- **File provider errors**: Ensure workspace folder is open in VS Code

### Test failures

**Unit test failures (Vitest)**:

- Mock issues: Ensure all external dependencies are properly mocked
- Import errors: Check module resolution and TypeScript configuration
- Coverage drops: Run `npm run test:coverage` to identify uncovered code

**VS Code Extension test failures**:

- Extension Host issues: Restart VS Code and try again
- API mocking: Ensure VS Code APIs are properly mocked in tests
- Timeout issues: Increase timeout for slow operations

### External Documentation

- **GitHub repo**: https://github.com/kuochunchang/code-review-goose
- **VS Code Extension API**: https://code.visualstudio.com/api
- **OpenAI API docs**: https://platform.openai.com/docs
- **Gemini API docs**: https://ai.google.dev/docs
- **Mermaid syntax**: https://mermaid.js.org/
- **Tree-sitter**: https://tree-sitter.github.io/tree-sitter/
- **SonarQube API**: https://docs.sonarqube.org/latest/extend/web-api/
- **npm workspaces**: https://docs.npmjs.com/cli/v8/using-npm/workspaces
- **TypeScript Project References**: https://www.typescriptlang.org/docs/handbook/project-references.html
- **Changesets**: https://github.com/changesets/changesets
