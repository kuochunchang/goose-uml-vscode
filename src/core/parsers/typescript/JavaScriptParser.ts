/**
 * @code-review-goose/analysis-parser-typescript
 * JavaScript parser implementation using Babel
 */

import { parse } from '@babel/parser';
import type { ILanguageParser } from '../common/ILanguageParser.js';
import type { UnifiedAST, SupportedLanguage } from '../../types/index.js';
import { BabelASTConverter } from './BabelASTConverter.js';

/**
 * JavaScript parser using Babel
 * 
 * This parser wraps @babel/parser to provide a unified interface for parsing JavaScript code.
 */
export class JavaScriptParser implements ILanguageParser {
  private converter: BabelASTConverter;

  constructor() {
    this.converter = new BabelASTConverter();
  }

  /**
   * Parse JavaScript code and convert to UnifiedAST
   */
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'decorators-legacy',
          'classProperties',
          'classPrivateProperties',
          'classPrivateMethods',
        ],
        sourceFilename: filePath,
      });

      return this.converter.convert(ast, filePath);
    } catch (error) {
      throw new Error(
        `Failed to parse JavaScript code in ${filePath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get supported language
   */
  getSupportedLanguage(): SupportedLanguage {
    return 'javascript';
  }

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return /\.jsx?$/.test(filePath) || /\.mjs$/.test(filePath) || /\.cjs$/.test(filePath);
  }
}
