/**
 * @code-review-goose/analysis-parser-java
 * Java parser implementation using tree-sitter
 */

import Parser from "tree-sitter";
import Java from "tree-sitter-java";
import type { ILanguageParser } from "../common/ILanguageParser.js";
import type { UnifiedAST, SupportedLanguage } from "../../types/index.js";
import { JavaASTConverter } from "./JavaASTConverter.js";

/**
 * Java parser using tree-sitter
 *
 * This parser uses tree-sitter-java to parse Java source code and convert it
 * to a unified AST format compatible with the analysis engine.
 */
export class JavaParser implements ILanguageParser {
  private parser: Parser;
  private converter: JavaASTConverter;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Java);
    this.converter = new JavaASTConverter();
  }

  /**
   * Parse Java code and convert to UnifiedAST
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    try {
      const tree = this.parser.parse(code);
      return this.converter.convert(tree.rootNode, filePath, tree);
    } catch (error) {
      throw new Error(
        `Failed to parse Java code in ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get supported language
   */
  getSupportedLanguage(): SupportedLanguage {
    return "java";
  }

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return /\.java$/.test(filePath);
  }
}
