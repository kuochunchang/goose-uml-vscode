/**
 * @code-review-goose/analysis-parser-common
 * Language parser interface for multi-language support
 */

import type { UnifiedAST, SupportedLanguage } from '../../types/index.js';

/**
 * Language parser interface - all language parsers must implement this
 * 
 * This interface enables platform-agnostic parsing by abstracting the underlying
 * parser implementation (Babel, tree-sitter, etc.) and providing a unified API.
 * 
 * @example
 * ```typescript
 * class TypeScriptParser implements ILanguageParser {
 *   async parse(code: string, filePath: string): Promise<UnifiedAST> {
 *     const tree = this.parser.parse(code);
 *     return this.convertToUnifiedAST(tree);
 *   }
 * 
 *   getSupportedLanguage(): SupportedLanguage {
 *     return 'typescript';
 *   }
 * 
 *   canParse(filePath: string): boolean {
 *     return /\.tsx?$/.test(filePath);
 *   }
 * }
 * ```
 */
export interface ILanguageParser {
  /**
   * Parse source code and convert to UnifiedAST
   * 
   * @param code - Source code string
   * @param filePath - File path (for error reporting and context)
   * @returns Unified AST structure
   * @throws {Error} If parsing fails or syntax is invalid
   */
  parse(code: string, filePath: string): Promise<UnifiedAST>;

  /**
   * Get the language this parser supports
   * 
   * @returns Supported language identifier
   */
  getSupportedLanguage(): SupportedLanguage;

  /**
   * Check if this parser can handle the given file
   * 
   * This method typically checks file extension but can also
   * perform more sophisticated detection if needed.
   * 
   * @param filePath - File path to check
   * @returns true if this parser supports the file
   */
  canParse(filePath: string): boolean;
}

/**
 * Parser factory function type
 * Used for lazy initialization of parsers
 */
export type ParserFactory = () => ILanguageParser | Promise<ILanguageParser>;

/**
 * Parser configuration options
 */
export interface ParserOptions {
  /**
   * Enable strict mode parsing (throw on errors vs recover)
   */
  strict?: boolean;

  /**
   * Enable source location tracking in AST
   */
  sourceLocations?: boolean;

  /**
   * Custom parser-specific options
   */
  customOptions?: Record<string, unknown>;
}
