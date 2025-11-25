/**
 * @code-review-goose/analysis-parser-typescript
 * TypeScript parser implementation using tree-sitter
 */

import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { ILanguageParser } from "../common/ILanguageParser.js";
import type { UnifiedAST, SupportedLanguage } from "../../types/index.js";
import { TypeScriptASTConverter } from "./TypeScriptASTConverter.js";

/**
 * TypeScript parser using tree-sitter
 *
 * This parser uses tree-sitter-typescript to parse TypeScript source code and convert it
 * to a unified AST format compatible with the analysis engine.
 */
export class TypeScriptParser implements ILanguageParser {
  private parser: Parser;
  private converter: TypeScriptASTConverter;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript);
    this.converter = new TypeScriptASTConverter();
  }

  /**
   * Parse TypeScript code and convert to UnifiedAST
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(code: string, filePath: string): Promise<UnifiedAST> {
    try {
      const tree = this.parser.parse(code);
      
      // Check for parse errors (tree-sitter doesn't throw on syntax errors)
      // Check if root node has ERROR type or contains ERROR nodes
      if (this.hasParseErrors(tree.rootNode)) {
        throw new Error(
          `Failed to parse TypeScript code in ${filePath}: Syntax errors detected`,
        );
      }
      
      return this.converter.convert(tree.rootNode, filePath, tree);
    } catch (error) {
      throw new Error(
        `Failed to parse TypeScript code in ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if a node or its children contain parse errors
   */
  private hasParseErrors(node: any): boolean {
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
    return "typescript";
  }

  /**
   * Check if this parser can handle the file
   */
  canParse(filePath: string): boolean {
    return (
      /\.tsx?$/.test(filePath) ||
      /\.mts$/.test(filePath) ||
      /\.cts$/.test(filePath)
    );
  }
}
