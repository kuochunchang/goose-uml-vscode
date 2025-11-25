import type { SyntaxNode } from "tree-sitter";
import Parser from "tree-sitter";
import type { UnifiedAST } from "../types/index.js";

/**
 * Activity Diagram Analyzer
 * Analyzes control flow for activity diagrams (flowcharts)
 * Supports UnifiedAST with tree-sitter AST
 */
export class ActivityAnalyzer {
  private mermaidCode: string = "";
  private nodeIdCounter: number = 0;

  /**
   * Analyze UnifiedAST and generate Mermaid flowchart
   */
  analyze(ast: UnifiedAST): string {
    this.mermaidCode = "flowchart TD\n";
    this.nodeIdCounter = 0;

    if (!ast.originalAST) {
      return this.generateFallbackDiagram("No AST available for analysis");
    }

    const tree = ast.originalAST as Parser.Tree;
    const rootNode = tree.rootNode;
    const language = ast.language;

    // Generate subgraphs for each function/method
    if (
      language === "typescript" ||
      language === "javascript" ||
      language === "java"
    ) {
      this.analyzeCStyleFunctions(rootNode);
    } else if (language === "python") {
      this.analyzePythonFunctions(rootNode);
    } else {
      return this.generateFallbackDiagram(
        `Language ${language} not fully supported for Activity Diagrams yet`,
      );
    }

    if (this.mermaidCode === "flowchart TD\n") {
      return this.generateFallbackDiagram("No functions found to analyze");
    }

    return this.mermaidCode;
  }

  private generateFallbackDiagram(message: string): string {
    return `flowchart TD\n  Error["${message}"]`;
  }

  private getNextId(): string {
    return `N${this.nodeIdCounter++}`;
  }

  /**
   * Analyze C-style languages (TS, JS, Java)
   */
  private analyzeCStyleFunctions(node: SyntaxNode): void {
    this.traverseForFunctions(node);
  }

  /**
   * Analyze Python functions
   */
  private analyzePythonFunctions(node: SyntaxNode): void {
    this.traverseForFunctions(node);
  }

  private traverseForFunctions(node: SyntaxNode): void {
    if (
      node.type === "function_declaration" ||
      node.type === "method_declaration" ||
      node.type === "arrow_function" ||
      node.type === "function_expression" ||
      node.type === "constructor_declaration" ||
      node.type === "function_definition" // Python
    ) {
      this.generateFunctionSubgraph(node);
      return; // Don't traverse inside functions to find more functions
    }

    for (const child of node.children) {
      this.traverseForFunctions(child);
    }
  }

  private generateFunctionSubgraph(node: SyntaxNode): void {
    const nameNode = node.childForFieldName("name");
    let functionName = "Anonymous";
    if (nameNode) {
      functionName = nameNode.text;
    } else if (node.type === "constructor_declaration") {
      functionName = "constructor";
    }

    // Sanitize name for Mermaid
    const safeName = functionName.replace(/[^a-zA-Z0-9_]/g, "_");
    const subgraphId = `subgraph_${safeName}_${this.getNextId()}`;

    this.mermaidCode += `\n  subgraph ${subgraphId} ["${functionName}"]\n`;
    this.mermaidCode += `    direction TB\n`;

    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      const startNodeId = this.getNextId();
      this.mermaidCode += `    ${startNodeId}(Start)\n`;

      const endNodeId = this.processBlock(bodyNode, startNodeId);

      const finalNodeId = this.getNextId();
      this.mermaidCode += `    ${finalNodeId}(End)\n`;

      if (endNodeId) {
        this.mermaidCode += `    ${endNodeId} --> ${finalNodeId}\n`;
      } else {
        // If block returned null (e.g. empty block), link start to end
        this.mermaidCode += `    ${startNodeId} --> ${finalNodeId}\n`;
      }
    } else {
      // No body (e.g. abstract method)
      const startNodeId = this.getNextId();
      this.mermaidCode += `    ${startNodeId}(${functionName})\n`;
    }

    this.mermaidCode += `  end\n`;
  }

  /**
   * Process a block of code (statement block)
   * Returns the ID of the last node in the flow
   */
  private processBlock(
    node: SyntaxNode,
    previousNodeId: string,
    linkLabel?: string,
  ): string | null {
    let currentPrevId = previousNodeId;
    let isFirst = true;

    // Get statements based on language/node type
    let statements: SyntaxNode[] = [];

    if (node.type === "block" && node.parent?.type === "function_definition") {
      // Python block
      statements = node.children;
    } else if (node.type === "block" || node.type === "statement_block") {
      // C-style block { ... }
      statements = node.children.filter(
        (c) => c.type !== "{" && c.type !== "}",
      );
    } else if (node.type === "else_clause") {
      // Handle else clause (unwrap)
      const blockChild = node.children.find(
        (c) => c.type === "block" || c.type === "statement_block",
      );
      if (blockChild) {
        statements = blockChild.children.filter(
          (c) => c.type !== "{" && c.type !== "}",
        );
      } else {
        // Filter out keywords
        statements = node.children.filter(
          (c) =>
            c.type !== "else" &&
            c.type !== ":" &&
            c.type !== "{" &&
            c.type !== "}",
        );
      }
    } else {
      // Single statement
      statements = [node];
    }

    for (const stmt of statements) {
      // Skip comments
      if (
        stmt.type === "comment" ||
        stmt.type === "line_comment" ||
        stmt.type === "block_comment"
      )
        continue;

      const nextId = this.processStatement(
        stmt,
        currentPrevId,
        isFirst ? linkLabel : undefined,
      );

      if (nextId) {
        currentPrevId = nextId;
        isFirst = false;
      }
    }

    return currentPrevId;
  }

  private processStatement(
    node: SyntaxNode,
    previousNodeId: string,
    linkLabel?: string,
  ): string | null {
    const link = linkLabel ? `-- ${linkLabel} -->` : `-->`;

    // Control structures
    if (node.type === "if_statement") {
      return this.processIfStatement(node, previousNodeId, linkLabel);
    } else if (node.type === "while_statement") {
      return this.processWhileStatement(node, previousNodeId, linkLabel);
    } else if (
      node.type === "for_statement" ||
      node.type === "for_in_statement" ||
      node.type === "for_of_statement"
    ) {
      return this.processForStatement(node, previousNodeId, linkLabel);
    } else if (node.type === "return_statement") {
      const returnId = this.getNextId();
      let returnText = node.text;
      if (returnText.length > 100)
        returnText = returnText.substring(0, 97) + "...";
      returnText = this.sanitizeLabel(returnText);

      this.mermaidCode += `    ${returnId}["${returnText}"]\n`;
      this.mermaidCode += `    ${previousNodeId} ${link} ${returnId}\n`;
      return returnId;
    } else if (node.type === "throw_statement") {
      const throwId = this.getNextId();
      let throwText = node.text;
      if (throwText.length > 100)
        throwText = throwText.substring(0, 97) + "...";
      throwText = this.sanitizeLabel(throwText);

      this.mermaidCode += `    ${throwId}["${throwText}"]\n`;
      this.mermaidCode += `    ${previousNodeId} ${link} ${throwId}\n`;
      return throwId;
    } else if (
      node.type === "variable_declaration" ||
      node.type === "lexical_declaration" ||
      node.type === "expression_statement" ||
      node.type === "local_variable_declaration"
    ) {
      // Simple statement
      const stmtId = this.getNextId();
      let text = node.text.split("\n")[0].trim();
      if (text.length > 100) text = text.substring(0, 97) + "...";
      text = this.sanitizeLabel(text);

      this.mermaidCode += `    ${stmtId}["${text}"]\n`;
      this.mermaidCode += `    ${previousNodeId} ${link} ${stmtId}\n`;
      return stmtId;
    }

    // Default: treat as simple statement
    const stmtId = this.getNextId();
    let text = node.type;
    if (node.text.length < 100) {
      text = node.text;
    }
    text = this.sanitizeLabel(text);

    this.mermaidCode += `    ${stmtId}["${text}"]\n`;
    this.mermaidCode += `    ${previousNodeId} ${link} ${stmtId}\n`;
    return stmtId;
  }

  private processIfStatement(
    node: SyntaxNode,
    previousNodeId: string,
    linkLabel?: string,
  ): string {
    const conditionNode = node.childForFieldName("condition");
    const consequenceNode = node.childForFieldName("consequence");
    const alternativeNode = node.childForFieldName("alternative");

    const conditionId = this.getNextId();
    let conditionText = "condition";
    if (conditionNode) {
      conditionText = conditionNode.text.trim();
      // Remove outer parentheses if present
      if (conditionText.startsWith("(") && conditionText.endsWith(")")) {
        conditionText = conditionText.substring(1, conditionText.length - 1);
      }

      if (conditionText.length > 50)
        conditionText = conditionText.substring(0, 47) + "...";
    }
    conditionText = this.sanitizeLabel(conditionText);

    const incomingLink = linkLabel ? `-- ${linkLabel} -->` : `-->`;
    this.mermaidCode += `    ${conditionId}{"${conditionText}?"}\n`;
    this.mermaidCode += `    ${previousNodeId} ${incomingLink} ${conditionId}\n`;

    const mergeNodeId = this.getNextId();
    this.mermaidCode += `    ${mergeNodeId}{}\n`; // Merge node (diamond)

    // True branch
    if (consequenceNode) {
      const endTrue = this.processBlock(consequenceNode, conditionId, "Yes");
      if (endTrue) {
        this.mermaidCode += `    ${endTrue} --> ${mergeNodeId}\n`;
      } else {
        // Empty block
        this.mermaidCode += `    ${conditionId} -- Yes --> ${mergeNodeId}\n`;
      }
    } else {
      this.mermaidCode += `    ${conditionId} -- Yes --> ${mergeNodeId}\n`;
    }

    // False branch
    if (alternativeNode) {
      const endFalse = this.processBlock(alternativeNode, conditionId, "No");
      if (endFalse) {
        this.mermaidCode += `    ${endFalse} --> ${mergeNodeId}\n`;
      } else {
        this.mermaidCode += `    ${conditionId} -- No --> ${mergeNodeId}\n`;
      }
    } else {
      // No else block, link condition directly to merge
      this.mermaidCode += `    ${conditionId} -- No --> ${mergeNodeId}\n`;
    }

    return mergeNodeId;
  }

  private processWhileStatement(
    node: SyntaxNode,
    previousNodeId: string,
    linkLabel?: string,
  ): string {
    const conditionNode = node.childForFieldName("condition");
    const bodyNode = node.childForFieldName("body");

    const conditionId = this.getNextId();
    let conditionText = "while loop";
    if (conditionNode) {
      conditionText = conditionNode.text.trim();
      if (conditionText.startsWith("(") && conditionText.endsWith(")")) {
        conditionText = conditionText.substring(1, conditionText.length - 1);
      }
      if (conditionText.length > 50)
        conditionText = conditionText.substring(0, 47) + "...";
    }
    conditionText = this.sanitizeLabel(conditionText);

    const incomingLink = linkLabel ? `-- ${linkLabel} -->` : `-->`;
    this.mermaidCode += `    ${conditionId}{"${conditionText}"}\n`;
    this.mermaidCode += `    ${previousNodeId} ${incomingLink} ${conditionId}\n`;

    // Loop body
    if (bodyNode) {
      const endBody = this.processBlock(bodyNode, conditionId, "Loop");
      if (endBody) {
        // Loop back
        this.mermaidCode += `    ${endBody} --> ${conditionId}\n`;
      }
    }

    // Exit loop
    const exitNodeId = this.getNextId();
    this.mermaidCode += `    ${exitNodeId}{}\n`; // Merge node
    this.mermaidCode += `    ${conditionId} -- Done --> ${exitNodeId}\n`;

    return exitNodeId;
  }

  private processForStatement(
    node: SyntaxNode,
    previousNodeId: string,
    linkLabel?: string,
  ): string {
    // Similar to while loop
    const conditionId = this.getNextId();
    const incomingLink = linkLabel ? `-- ${linkLabel} -->` : `-->`;

    this.mermaidCode += `    ${conditionId}{"Loop"}\n`;
    this.mermaidCode += `    ${previousNodeId} ${incomingLink} ${conditionId}\n`;

    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      const endBody = this.processBlock(bodyNode, conditionId, "Loop");
      if (endBody) {
        this.mermaidCode += `    ${endBody} --> ${conditionId}\n`;
      }
    }

    const exitNodeId = this.getNextId();
    this.mermaidCode += `    ${exitNodeId}{}\n`;
    this.mermaidCode += `    ${conditionId} -- Done --> ${exitNodeId}\n`;

    return exitNodeId;
  }

  private sanitizeLabel(text: string): string {
    return text.replace(/"/g, "'").replace(/\n/g, " ");
  }
}
