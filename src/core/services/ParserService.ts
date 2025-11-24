/**
 * @code-review-goose/analysis-core
 * Unified parser service that manages all language parsers
 */

import type { UnifiedAST, SupportedLanguage } from '../types/index.js';
import type { ILanguageParser } from '../parsers/common/index.js';
import { ParserRegistry, LanguageDetector } from '../parsers/common/index.js';

/**
 * Unified parser service for multi-language support
 * 
 * This service manages all language parsers and provides a unified interface
 * for parsing code in different languages.
 */
export class ParserService {
  private static instance: ParserService;
  private registry: ParserRegistry;

  constructor() {
    this.registry = new ParserRegistry();
  }

  /**
   * Get the singleton instance of ParserService
   */
  public static getInstance(): ParserService {
    if (!ParserService.instance) {
      ParserService.instance = new ParserService();
    }
    return ParserService.instance;
  }

  /**
   * Register a language parser
   * 
   * @param parser - The parser instance to register
   */
  registerParser(parser: ILanguageParser): void {
    this.registry.register(parser);
  }

  /**
   * Parse code using the appropriate parser based on file path
   * 
   * @param code - Source code to parse
   * @param filePath - File path (used for language detection)
   * @returns UnifiedAST representation of the code
   * @throws Error if no parser is available for the file
   */
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    const language = LanguageDetector.detectFromFilePath(filePath);

    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    const parser = await this.registry.getParser(language);

    if (!parser) {
      throw new Error(`No parser available for language: ${language}`);
    }

    return await parser.parse(code, filePath);
  }

  /**
   * Check if a file can be parsed
   * 
   * @param filePath - File path to check
   * @returns true if a parser is available for this file
   */
  canParse(filePath: string): boolean {
    const language = LanguageDetector.detectFromFilePath(filePath);
    if (!language) {
      return false;
    }
    // Check if we have a parser registered for this language
    return this.registry.hasParser(language);
  }

  /**
   * Get the detected language for a file path
   * 
   * @param filePath - File path
   * @returns Detected language or null if unsupported
   */
  detectLanguage(filePath: string): SupportedLanguage | null {
    return LanguageDetector.detectFromFilePath(filePath);
  }

  /**
   * Get parser for a specific language
   * 
   * @param language - Language to get parser for
   * @returns Parser instance or undefined if not available
   */
  async getParser(language: SupportedLanguage): Promise<ILanguageParser | undefined> {
    return await this.registry.getParser(language);
  }

  /**
   * Get parser for a file path
   * 
   * @param filePath - File path
   * @returns Parser instance or undefined if not available
   */
  async getParserForFile(filePath: string): Promise<ILanguageParser | undefined> {
    return await this.registry.getParserForFile(filePath);
  }

  /**
   * Get list of supported languages
   * 
   * @returns Array of supported language identifiers
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return this.registry.getRegisteredLanguages();
  }
}
