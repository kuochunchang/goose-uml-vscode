/**
 * @code-review-goose/analysis-parser-java
 * Java parser implementation using tree-sitter
 */

import type { SyntaxNode, Language } from "tree-sitter";
import Parser from "tree-sitter";
import Java from "tree-sitter-java";
import type { SupportedLanguage, UnifiedAST } from "../../types/index.js";
import type { ILanguageParser } from "../common/ILanguageParser.js";
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
    // Type assertion needed due to tree-sitter version compatibility
    this.parser.setLanguage(Java as unknown as Language);
    this.converter = new JavaASTConverter();
  }

  /**
   * Parse Java code and convert to UnifiedAST
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    try {
      const tree = this.parser.parse(code);

      // Check for critical parse errors (tree-sitter doesn't throw on syntax errors)
      // Only fail if there are errors in critical nodes (class/method declarations)
      // Ignore errors in annotations as tree-sitter may not fully support complex annotations
      if (this.hasCriticalParseErrors(tree.rootNode)) {
        throw new Error(
          `Failed to parse Java code in ${filePath}: Syntax errors detected`,
        );
      }

      return this.converter.convert(tree.rootNode, filePath, tree);
    } catch (error) {
      throw new Error(
        `Failed to parse Java code in ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if a node or its children contain critical parse errors
   * Ignores errors within annotations as tree-sitter may not fully support complex annotations
   */
  private hasCriticalParseErrors(node: SyntaxNode): boolean {
    // Skip checking inside annotations - they may have parsing issues but shouldn't block analysis
    if (
      node.type === "annotation" ||
      node.type === "marker_annotation" ||
      node.type === "annotation_argument_list"
    ) {
      return false;
    }

    if (node.type === "ERROR" || node.type === "MISSING") {
      // Check if this error is inside an annotation by walking up the tree
      let parent = node.parent;
      while (parent) {
        if (
          parent.type === "annotation" ||
          parent.type === "marker_annotation" ||
          parent.type === "annotation_argument_list" ||
          parent.type === "modifiers"
        ) {
          // Error is inside an annotation, ignore it
          return false;
        }
        parent = parent.parent;
      }
      // Error is outside annotations, this is critical
      return true;
    }

    // Check children recursively
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && this.hasCriticalParseErrors(child)) {
        return true;
      }
    }

    return false;
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
