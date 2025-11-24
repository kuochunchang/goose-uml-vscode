/**
 * @code-review-goose/analysis-parser-common
 * Common parser interfaces and utilities for multi-language support
 *
 * This package provides the foundation for language-agnostic parsing:
 * - ILanguageParser: Abstract interface all parsers must implement
 * - ParserRegistry: Manages multiple language parsers
 * - LanguageDetector: Detects programming language from file paths
 *
 * @packageDocumentation
 *
 * @example Basic Usage
 * ```typescript
 * import { ParserRegistry, LanguageDetector } from '@code-review-goose/analysis-parser-common';
 * import { TypeScriptParser } from '@code-review-goose/analysis-parser-typescript';
 * import { JavaParser } from '@code-review-goose/analysis-parser-java';
 *
 * // Create registry and register parsers
 * const registry = new ParserRegistry();
 * registry.register(new TypeScriptParser());
 * registry.register(new JavaParser());
 *
 * // Auto-detect language and parse
 * const filePath = 'src/Example.java';
 * const parser = await registry.getParserForFile(filePath);
 *
 * if (parser) {
 *   const code = await readFile(filePath);
 *   const ast = await parser.parse(code, filePath);
 *   console.log('Parsed classes:', ast.classes.length);
 * }
 * ```
 *
 * @example Lazy Registration
 * ```typescript
 * // Register parsers lazily for faster startup
 * registry.registerLazy('python', () => new PythonParser());
 * registry.registerLazy('go', async () => {
 *   await loadGoGrammar();
 *   return new GoParser();
 * });
 * ```
 */

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Language parser interface - all language parsers must implement this
 */
export type {
  ILanguageParser,
  ParserFactory,
  ParserOptions,
} from "./ILanguageParser.js";

// ============================================================================
// Parser Registry
// ============================================================================

/**
 * Parser registry - manages multiple language parsers
 */
export { ParserRegistry } from "./ParserRegistry.js";

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Language detector - detects programming language from file paths
 */
export { LanguageDetector } from "./LanguageDetector.js";
