/**
 * @code-review-goose/analysis-parser-typescript
 * TypeScript parser implementation using Babel
 */

import { parse } from '@babel/parser';
import type { ILanguageParser } from '../common/ILanguageParser.js';
import type { UnifiedAST, SupportedLanguage } from '../../types/index.js';
import { BabelASTConverter } from './BabelASTConverter.js';

/**
 * TypeScript parser using Babel
 * 
 * This parser wraps @babel/parser to provide a unified interface for parsing TypeScript code.
 */
export class TypeScriptParser implements ILanguageParser {
  private converter: BabelASTConverter;

  constructor() {
    this.converter = new BabelASTConverter();
  }

  /**
   * Parse TypeScript code and convert to UnifiedAST
   */
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: [
          'typescript',
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
        `Failed to parse TypeScript code in ${filePath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get supported language
   */
  getSupportedLanguage(): SupportedLanguage {
    return 'typescript';
  }

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return /\.tsx?$/.test(filePath) || /\.mts$/.test(filePath) || /\.cts$/.test(filePath);
  }
}
