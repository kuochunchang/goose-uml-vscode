/**
 * @code-review-goose/analysis-parser-common
 * Parser registry for managing multiple language parsers
 */

import type { SupportedLanguage } from '../../types/index.js';
import type { ILanguageParser, ParserFactory } from './ILanguageParser.js';
import { LanguageDetector } from './LanguageDetector.js';

/**
 * Parser registry - manages language parsers and provides unified access
 * 
 * The registry supports both eager and lazy parser registration:
 * - Eager: Parser instance is provided directly
 * - Lazy: Parser factory function is provided for on-demand initialization
 * 
 * @example
 * ```typescript
 * const registry = new ParserRegistry();
 * 
 * // Eager registration
 * registry.register(new TypeScriptParser());
 * registry.register(new JavaParser());
 * 
 * // Lazy registration (parser created on first use)
 * registry.registerLazy('python', () => new PythonParser());
 * 
 * // Get parser by language
 * const tsParser = registry.getParser('typescript');
 * 
 * // Auto-detect language and get parser
 * const parser = await registry.getParserForFile('src/App.tsx');
 * const ast = await parser.parse(code, 'src/App.tsx');
 * ```
 */
export class ParserRegistry {
  /**
   * Registered parser instances (eager)
   */
  private parsers: Map<SupportedLanguage, ILanguageParser> = new Map();

  /**
   * Registered parser factories (lazy)
   */
  private parserFactories: Map<SupportedLanguage, ParserFactory> = new Map();

  /**
   * Cache for lazy-initialized parsers
   */
  private lazyParsersCache: Map<SupportedLanguage, ILanguageParser> = new Map();

  /**
   * Register a language parser (eager initialization)
   * 
   * @param parser - Parser instance
   * @throws {Error} If parser for the language is already registered
   * 
   * @example
   * ```typescript
   * const registry = new ParserRegistry();
   * registry.register(new TypeScriptParser());
   * ```
   */
  register(parser: ILanguageParser): void {
    const language = parser.getSupportedLanguage();

    if (this.parsers.has(language) || this.parserFactories.has(language)) {
      throw new Error(`Parser for language '${language}' is already registered`);
    }

    this.parsers.set(language, parser);
  }

  /**
   * Register a language parser factory (lazy initialization)
   * 
   * The parser will be created on first use, which can improve startup time
   * for applications that don't use all registered parsers.
   * 
   * @param language - Language identifier
   * @param factory - Factory function that creates the parser
   * @throws {Error} If parser for the language is already registered
   * 
   * @example
   * ```typescript
   * registry.registerLazy('java', () => new JavaParser());
   * registry.registerLazy('python', async () => {
   *   await loadPythonGrammar();
   *   return new PythonParser();
   * });
   * ```
   */
  registerLazy(language: SupportedLanguage, factory: ParserFactory): void {
    if (this.parsers.has(language) || this.parserFactories.has(language)) {
      throw new Error(`Parser for language '${language}' is already registered`);
    }

    this.parserFactories.set(language, factory);
  }

  /**
   * Get parser for a specific language
   * 
   * For lazy-registered parsers, this will trigger initialization on first call.
   * 
   * @param language - Language identifier
   * @returns Parser instance or undefined if not registered
   * 
   * @example
   * ```typescript
   * const parser = await registry.getParser('typescript');
   * if (parser) {
   *   const ast = await parser.parse(code, filePath);
   * }
   * ```
   */
  async getParser(language: SupportedLanguage): Promise<ILanguageParser | undefined> {
    // Check eager-registered parsers first
    if (this.parsers.has(language)) {
      return this.parsers.get(language);
    }

    // Check lazy-registered parsers
    if (this.parserFactories.has(language)) {
      // Check cache first
      if (this.lazyParsersCache.has(language)) {
        return this.lazyParsersCache.get(language);
      }

      // Initialize parser
      const factory = this.parserFactories.get(language)!;
      const parser = await factory();

      // Verify parser supports the expected language
      if (parser.getSupportedLanguage() !== language) {
        throw new Error(
          `Parser factory for '${language}' returned parser for '${parser.getSupportedLanguage()}'`
        );
      }

      // Cache the initialized parser
      this.lazyParsersCache.set(language, parser);
      return parser;
    }

    return undefined;
  }

  /**
   * Auto-detect language from file path and get appropriate parser
   * 
   * @param filePath - File path (absolute or relative)
   * @returns Parser instance or undefined if language is not supported
   * @throws {Error} If language is detected but parser is not registered
   * 
   * @example
   * ```typescript
   * const parser = await registry.getParserForFile('src/Main.java');
   * if (parser) {
   *   const ast = await parser.parse(code, 'src/Main.java');
   * }
   * ```
   */
  async getParserForFile(filePath: string): Promise<ILanguageParser | undefined> {
    const language = LanguageDetector.detectFromFilePath(filePath);

    if (!language) {
      return undefined;
    }

    const parser = await this.getParser(language);

    if (!parser) {
      throw new Error(
        `Language '${language}' detected for file '${filePath}' but no parser is registered. ` +
          `Please register a parser for '${language}'.`
      );
    }

    return parser;
  }

  /**
   * Check if a parser is registered for a language
   * 
   * @param language - Language identifier
   * @returns true if parser is registered
   * 
   * @example
   * ```typescript
   * if (registry.hasParser('typescript')) {
   *   console.log('TypeScript parser is available');
   * }
   * ```
   */
  hasParser(language: SupportedLanguage): boolean {
    return this.parsers.has(language) || this.parserFactories.has(language);
  }

  /**
   * Get all registered languages
   * 
   * @returns Array of language identifiers
   * 
   * @example
   * ```typescript
   * const languages = registry.getRegisteredLanguages();
   * console.log('Supported languages:', languages);
   * // Output: ['typescript', 'javascript', 'java', 'python']
   * ```
   */
  getRegisteredLanguages(): SupportedLanguage[] {
    const languages = new Set<SupportedLanguage>();

    for (const lang of this.parsers.keys()) {
      languages.add(lang);
    }

    for (const lang of this.parserFactories.keys()) {
      languages.add(lang);
    }

    return Array.from(languages);
  }

  /**
   * Clear all registered parsers
   * 
   * This is useful for testing or hot-reloading scenarios.
   * 
   * @example
   * ```typescript
   * registry.clear();
   * // All parsers are now unregistered
   * ```
   */
  clear(): void {
    this.parsers.clear();
    this.parserFactories.clear();
    this.lazyParsersCache.clear();
  }

  /**
   * Unregister a parser for a specific language
   * 
   * @param language - Language identifier
   * @returns true if parser was unregistered, false if not found
   * 
   * @example
   * ```typescript
   * const removed = registry.unregister('python');
   * if (removed) {
   *   console.log('Python parser unregistered');
   * }
   * ```
   */
  unregister(language: SupportedLanguage): boolean {
    const hadEager = this.parsers.delete(language);
    const hadLazy = this.parserFactories.delete(language);
    this.lazyParsersCache.delete(language);

    return hadEager || hadLazy;
  }
}
