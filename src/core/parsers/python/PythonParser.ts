/**
 * @code-review-goose/analysis-parser-python
 * Python parser implementation using tree-sitter
 */

import Parser from "tree-sitter";
import type { SyntaxNode, Language } from "tree-sitter";
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
    // Type assertion needed due to tree-sitter version compatibility
    this.parser.setLanguage(Python as unknown as Language);
    this.converter = new PythonASTConverter();
  }

  /**
   * Parse Python code and convert to UnifiedAST
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    try {
      const tree = this.parser.parse(code);

      // Check for parse errors (tree-sitter doesn't throw on syntax errors)
      // Check if root node has ERROR type or contains ERROR nodes
      if (this.hasParseErrors(tree.rootNode)) {
        throw new Error(
          `Failed to parse Python code in ${filePath}: Syntax errors detected`,
        );
      }

      return this.converter.convert(tree.rootNode, filePath, tree);
    } catch (error) {
      throw new Error(
        `Failed to parse Python code in ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if a node or its children contain parse errors
   */
  private hasParseErrors(node: SyntaxNode): boolean {
    if (node.type === "ERROR" || node.type === "MISSING") {
      return true;
    }

    // Check children recursively
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && this.hasParseErrors(child)) {
        return true;
      }
    }

    return false;
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
