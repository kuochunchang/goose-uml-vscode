import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.test.ts",
        "**/__tests__/**",
        "vitest.config.ts",
        // VS Code extension entry point - requires complex VS Code API mocking
        "src/extension.ts",
        // VS Code WebView panel - requires complex VS Code API mocking
        "src/views/diagram-panel.ts",
        // VS Code file provider - requires complex VS Code API mocking
        "src/core/services/vscode-file-provider.ts",
        // Type definitions only
        "src/core/analyzers/SequenceAnalyzer.ts",
        // Simple export files
        "src/core/parsers/**/index.ts",
        "src/core/services/index.ts",
        // ASTConverter files are complex and require extensive mocking
        // They are internal implementation details and tested indirectly through parser tests
        "src/core/parsers/**/ASTConverter.ts",
      ],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75, // Branches are harder to cover completely, 75% is acceptable
        statements: 80,
      },
    },
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
