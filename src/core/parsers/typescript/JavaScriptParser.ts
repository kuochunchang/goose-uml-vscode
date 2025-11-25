/**
 * @code-review-goose/analysis-parser-typescript
 * JavaScript parser implementation using tree-sitter
 */

import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { ILanguageParser } from "../common/ILanguageParser.js";
import type { UnifiedAST, SupportedLanguage } from "../../types/index.js";
import { TypeScriptASTConverter } from "./TypeScriptASTConverter.js";

/**
 * JavaScript parser using tree-sitter
 *
 * This parser uses tree-sitter-typescript (which supports JavaScript) to parse JavaScript
 * source code and convert it to a unified AST format compatible with the analysis engine.
 */
export class JavaScriptParser implements ILanguageParser {
  private parser: Parser;
  private converter: TypeScriptASTConverter;

  constructor() {
    this.parser = new Parser();
    // Use TypeScript language for JavaScript (TypeScript is a superset of JavaScript)
    this.parser.setLanguage(TypeScript.typescript);
    this.converter = new TypeScriptASTConverter();
  }

  /**
   * Parse JavaScript code and convert to UnifiedAST
   */
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    try {
      const tree = this.parser.parse(code);
      return this.converter.convert(tree.rootNode, filePath, tree);
    } catch (error) {
      throw new Error(
        `Failed to parse JavaScript code in ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get supported language
   */
  getSupportedLanguage(): SupportedLanguage {
    return "javascript";
  }

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return (
      /\.jsx?$/.test(filePath) ||
      /\.mjs$/.test(filePath) ||
      /\.cjs$/.test(filePath)
    );
  }
}
