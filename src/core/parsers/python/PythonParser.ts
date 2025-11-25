/**
 * @code-review-goose/analysis-parser-python
 * Python parser implementation using tree-sitter
 */

import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { ILanguageParser } from "../common/ILanguageParser.js";
import type { UnifiedAST, SupportedLanguage } from "../../types/index.js";
import { PythonASTConverter } from "./PythonASTConverter.js";

/**
 * Python parser using tree-sitter
 *
 * This parser uses tree-sitter-python to parse Python source code and convert it
 * to a unified AST format compatible with the analysis engine.
 */
export class PythonParser implements ILanguageParser {
  private parser: Parser;
  private converter: PythonASTConverter;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Python);
    this.converter = new PythonASTConverter();
  }

  /**
   * Parse Python code and convert to UnifiedAST
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    try {
      const tree = this.parser.parse(code);
      return this.converter.convert(tree.rootNode, filePath, tree);
    } catch (error) {
      throw new Error(
        `Failed to parse Python code in ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get supported language
   */
  getSupportedLanguage(): SupportedLanguage {
    return "python";
  }

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return (
      /\.py$/.test(filePath) ||
      /\.pyi$/.test(filePath) ||
      /\.pyw$/.test(filePath)
    );
  }
}
