import type { SyntaxNode } from "tree-sitter";
import Parser from "tree-sitter";
import * as path from "path";
import type {
  UnifiedAST,
  CrossFileAnalysisOptions,
  IFileProvider,
} from "../types/index.js";
import { ParserService } from "../services/ParserService.js";
import { LanguageDetector } from "../parsers/common/index.js";

/**
 * Flowchart Analyzer
 * Analyzes control flow for flowcharts
 * Supports UnifiedAST with tree-sitter AST
 * Supports Cross-File Analysis with Swimlanes
 */
export class FlowchartAnalyzer {
  private nodeIdCounter: number = 0;
  private fileProvider: IFileProvider;
  private parserService: ParserService;

  // State for current analysis
  private visitedFunctions: Set<string> = new Set(); // "filePath:functionName"
  private fileSubgraphs: Map<string, string[]> = new Map(); // filePath -> mermaid lines
  private globalLinks: string[] = []; // Links between nodes across files
  private currentFilePath: string = "";

  constructor(fileProvider: IFileProvider) {
    this.fileProvider = fileProvider;
    this.parserService = ParserService.getInstance();
  }

  /**
   * Analyze UnifiedAST and generate Mermaid flowchart
   */
  async analyze(
    ast: UnifiedAST,
    options?: CrossFileAnalysisOptions,
  ): Promise<string> {
    this.nodeIdCounter = 0;
    this.visitedFunctions.clear();
    this.fileSubgraphs.clear();
    this.globalLinks = [];

    // Use provided file path or default
    // Note: ast.filePath might be missing in some tests, handle gracefully
    const entryFilePath =
      (ast as UnifiedAST & { filePath?: string }).filePath || "current_file";
    this.currentFilePath = entryFilePath;

    if (!ast.originalAST) {
      return this.generateFallbackDiagram("No AST available for analysis");
    }

    const tree = ast.originalAST as Parser.Tree;
    const rootNode = tree.rootNode;
    const language = ast.language;

    // Initialize subgraph for entry file
    if (!this.fileSubgraphs.has(entryFilePath)) {
      this.fileSubgraphs.set(entryFilePath, []);
    }

    // Analyze functions in the entry file
    if (
      language === "typescript" ||
      language === "javascript" ||
      language === "java"
    ) {
      await this.analyzeCStyleFunctions(
        rootNode,
        entryFilePath,
        options?.depth || 0,
      );
    } else if (language === "python") {
      await this.analyzePythonFunctions(
        rootNode,
        entryFilePath,
        options?.depth || 0,
      );
    } else {
      return this.generateFallbackDiagram(
        `Language ${language} not fully supported for Activity Diagrams yet`,
      );
    }

    // Assemble final Mermaid code
    let finalMermaid = "flowchart TD\n";

    // Add subgraphs (Swimlanes)
    for (const [filePath, lines] of this.fileSubgraphs.entries()) {
      if (lines.length === 0) continue;

      const safeId = this.sanitizeId(filePath);
      const label = path.basename(filePath);

      finalMermaid += `\n  subgraph ${safeId} ["${label}"]\n`;
      finalMermaid += `    direction TB\n`;
      finalMermaid += lines.join("");
      finalMermaid += `  end\n`;
    }

    // Add global links
    finalMermaid += "\n  %% Cross-file links\n";
    finalMermaid += this.globalLinks.join("");

    if (finalMermaid === "flowchart TD\n") {
      return this.generateFallbackDiagram("No functions found to analyze");
    }

    return finalMermaid;
  }

  private generateFallbackDiagram(message: string): string {
    return `flowchart TD\n  Error["${message}"]`;
  }

  private getNextId(): string {
    return `N${this.nodeIdCounter++}`;
  }

  private sanitizeId(text: string): string {
    return text.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  /**
   * Analyze C-style languages (TS, JS, Java)
   */
  private async analyzeCStyleFunctions(
    node: SyntaxNode,
    filePath: string,
    depth: number,
  ): Promise<void> {
    await this.traverseForFunctions(node, filePath, depth);
  }

  /**
   * Analyze Python functions
   */
  private async analyzePythonFunctions(
    node: SyntaxNode,
    filePath: string,
    depth: number,
  ): Promise<void> {
    await this.traverseForFunctions(node, filePath, depth);
  }

  private async traverseForFunctions(
    node: SyntaxNode,
    filePath: string,
    depth: number,
  ): Promise<void> {
    if (
      node.type === "function_declaration" ||
      node.type === "method_declaration" ||
      node.type === "arrow_function" ||
      node.type === "function_expression" ||
      node.type === "constructor_declaration" ||
      node.type === "function_definition" // Python
    ) {
      await this.generateFunctionSubgraph(node, filePath, depth);
      return; // Don't traverse inside functions to find more functions
    }

    for (const child of node.children) {
      await this.traverseForFunctions(child, filePath, depth);
    }
  }

  private async generateFunctionSubgraph(
    node: SyntaxNode,
    filePath: string,
    depth: number,
  ): Promise<string | null> {
    const nameNode = node.childForFieldName("name");
    let functionName = "Anonymous";
    if (nameNode) {
      functionName = nameNode.text;
    } else if (node.type === "constructor_declaration") {
      functionName = "constructor";
    }

    const funcKey = `${filePath}:${functionName}`;
    if (this.visitedFunctions.has(funcKey)) {
      return null; // Already visited, but we might want to return the start ID if we stored it
    }
    this.visitedFunctions.add(funcKey);

    // Sanitize name for Mermaid
    const safeName = functionName.replace(/[^a-zA-Z0-9_]/g, "_");
    const subgraphId = `subgraph_${safeName}_${this.getNextId()}`;

    // Add to file's subgraph lines
    const lines: string[] = [];
    lines.push(`\n    subgraph ${subgraphId} ["${functionName}"]\n`);
    lines.push(`      direction TB\n`);

    const startNodeId = this.getNextId();

    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      lines.push(`      ${startNodeId}(Start)\n`);

      // Pass context for recursion
      const endNodeId = await this.processBlock(
        bodyNode,
        startNodeId,
        filePath,
        depth,
        lines,
      );

      const finalNodeId = this.getNextId();
      lines.push(`      ${finalNodeId}(End)\n`);

      if (endNodeId) {
        lines.push(`      ${endNodeId} --> ${finalNodeId}\n`);
      } else {
        lines.push(`      ${startNodeId} --> ${finalNodeId}\n`);
      }
    } else {
      lines.push(`      ${startNodeId}(${functionName})\n`);
    }

    lines.push(`    end\n`);

    // Append lines to the file's subgraph
    if (!this.fileSubgraphs.has(filePath)) {
      this.fileSubgraphs.set(filePath, []);
    }
    this.fileSubgraphs.get(filePath)!.push(...lines);

    return startNodeId;
  }

  /**
   * Process a block of code
   */
  private async processBlock(
    node: SyntaxNode,
    previousNodeId: string,
    filePath: string,
    depth: number,
    lines: string[],
    linkLabel?: string,
  ): Promise<string | null> {
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

      const nextId = await this.processStatement(
        stmt,
        currentPrevId,
        filePath,
        depth,
        lines,
        isFirst ? linkLabel : undefined,
      );

      if (nextId) {
        currentPrevId = nextId;
        isFirst = false;
      }
    }

    return currentPrevId;
  }

  private async processStatement(
    node: SyntaxNode,
    previousNodeId: string,
    filePath: string,
    depth: number,
    lines: string[],
    linkLabel?: string,
  ): Promise<string | null> {
    const link = linkLabel ? `-- ${linkLabel} -->` : `-->`;

    // Control structures
    if (node.type === "if_statement") {
      return this.processIfStatement(
        node,
        previousNodeId,
        filePath,
        depth,
        lines,
        linkLabel,
      );
    } else if (node.type === "while_statement") {
      return this.processWhileStatement(
        node,
        previousNodeId,
        filePath,
        depth,
        lines,
        linkLabel,
      );
    } else if (
      node.type === "for_statement" ||
      node.type === "for_in_statement" ||
      node.type === "for_of_statement"
    ) {
      return this.processForStatement(
        node,
        previousNodeId,
        filePath,
        depth,
        lines,
        linkLabel,
      );
    } else if (node.type === "return_statement") {
      const returnId = this.getNextId();
      let returnText = node.text;
      if (returnText.length > 100)
        returnText = returnText.substring(0, 97) + "...";
      returnText = this.sanitizeLabel(returnText);

      lines.push(`      ${returnId}["${returnText}"]\n`);
      lines.push(`      ${previousNodeId} ${link} ${returnId}\n`);
      return returnId;
    } else if (node.type === "expression_statement") {
      // Check for call expression
      const callExpr = node.children.find((c) => c.type === "call_expression");
      if (callExpr && depth > 0) {
        return this.processCallExpression(
          callExpr,
          previousNodeId,
          filePath,
          depth,
          lines,
          linkLabel,
        );
      }

      // Standard expression handling
      const stmtId = this.getNextId();
      let text = node.text.split("\n")[0].trim();
      if (text.length > 100) text = text.substring(0, 97) + "...";
      text = this.sanitizeLabel(text);

      lines.push(`      ${stmtId}["${text}"]\n`);
      lines.push(`      ${previousNodeId} ${link} ${stmtId}\n`);
      return stmtId;
    } else if (
      node.type === "variable_declaration" ||
      node.type === "lexical_declaration" ||
      node.type === "local_variable_declaration"
    ) {
      // Check for initialization with call expression
      // e.g. const x = foo();
      // This is complex to parse generically, so we'll stick to simple statement for now
      // but we could inspect children for call_expression

      const stmtId = this.getNextId();
      let text = node.text.split("\n")[0].trim();
      if (text.length > 100) text = text.substring(0, 97) + "...";
      text = this.sanitizeLabel(text);

      lines.push(`      ${stmtId}["${text}"]\n`);
      lines.push(`      ${previousNodeId} ${link} ${stmtId}\n`);
      return stmtId;
    }

    // Default: treat as simple statement
    const stmtId = this.getNextId();
    let text = node.type;
    if (node.text.length < 100) {
      text = node.text;
    }
    text = this.sanitizeLabel(text);

    lines.push(`      ${stmtId}["${text}"]\n`);
    lines.push(`      ${previousNodeId} ${link} ${stmtId}\n`);
    return stmtId;
  }

  private async processCallExpression(
    node: SyntaxNode,
    previousNodeId: string,
    filePath: string,
    depth: number,
    lines: string[],
    linkLabel?: string,
  ): Promise<string> {
    const link = linkLabel ? `-- ${linkLabel} -->` : `-->`;

    // 1. Create a node for the call itself
    const callId = this.getNextId();
    let callText = node.text.split("\n")[0].trim();
    if (callText.length > 50) callText = callText.substring(0, 47) + "...";
    callText = this.sanitizeLabel(callText);

    lines.push(`      ${callId}[["${callText}"]]`); // Subroutine shape
    lines.push(`      ${previousNodeId} ${link} ${callId}\n`);

    // 2. Resolve and analyze the called function
    const functionNameNode = node.childForFieldName("function");
    if (functionNameNode) {
      let functionName = functionNameNode.text;
      // Handle member access (obj.method) - just get the method name for now
      if (functionNameNode.type === "member_expression") {
        const property = functionNameNode.childForFieldName("property");
        if (property) functionName = property.text;
      }

      const target = await this.resolveFunction(functionName, filePath);

      if (target) {
        // If we found the target file and function
        // Analyze it if we haven't visited it yet (or if we want to show the link)

        // Check if already visited to avoid infinite recursion
        const targetKey = `${target.filePath}:${target.functionName}`;

        if (!this.visitedFunctions.has(targetKey)) {
          // Parse target file
          try {
            const code = await this.fileProvider.readFile(target.filePath);
            const language = LanguageDetector.detectFromFilePath(
              target.filePath,
            );
            if (language && this.parserService.canParse(target.filePath)) {
              const ast = await this.parserService.parse(code, target.filePath);
              const tree = ast.originalAST as Parser.Tree;

              // Find the function node
              const targetNode = this.findFunctionNode(
                tree.rootNode,
                target.functionName,
              );

              if (targetNode) {
                // We need to capture the start node ID that WILL be generated.
                const targetStartNodeId = await this.analyzeTargetFunction(
                  targetNode,
                  target.filePath,
                  depth - 1,
                );

                if (targetStartNodeId) {
                  this.globalLinks.push(
                    `  ${callId} -.-> ${targetStartNodeId}\n`,
                  );
                }
              }
            }
          } catch (e) {
            console.warn(
              `[ActivityAnalyzer] Failed to analyze target file ${target.filePath}`,
              e,
            );
          }
        } else {
          // Already visited. We still want a link?
          // If we stored the startNodeId for visited functions, we could link.
          // For now, skip linking to already visited functions to keep it simple.
        }
      }
    }

    return callId;
  }

  private async analyzeTargetFunction(
    node: SyntaxNode,
    filePath: string,
    depth: number,
  ): Promise<string | null> {
    // Wrapper to call generateFunctionSubgraph and capture start ID
    return this.generateFunctionSubgraph(node, filePath, depth);
  }

  private async processIfStatement(
    node: SyntaxNode,
    previousNodeId: string,
    filePath: string,
    depth: number,
    lines: string[],
    linkLabel?: string,
  ): Promise<string> {
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
    lines.push(`      ${conditionId}{"${conditionText}?"}\n`);
    lines.push(`      ${previousNodeId} ${incomingLink} ${conditionId}\n`);

    const mergeNodeId = this.getNextId();
    lines.push(`      ${mergeNodeId}("Merge")\n`); // Merge node (rounded rectangle)

    // True branch
    if (consequenceNode) {
      const endTrue = await this.processBlock(
        consequenceNode,
        conditionId,
        filePath,
        depth,
        lines,
        "Yes",
      );
      if (endTrue) {
        lines.push(`      ${endTrue} --> ${mergeNodeId}\n`);
      } else {
        // Empty block
        lines.push(`      ${conditionId} -- Yes --> ${mergeNodeId}\n`);
      }
    } else {
      lines.push(`      ${conditionId} -- Yes --> ${mergeNodeId}\n`);
    }

    // False branch
    if (alternativeNode) {
      const endFalse = await this.processBlock(
        alternativeNode,
        conditionId,
        filePath,
        depth,
        lines,
        "No",
      );
      if (endFalse) {
        lines.push(`      ${endFalse} --> ${mergeNodeId}\n`);
      } else {
        lines.push(`      ${conditionId} -- No --> ${mergeNodeId}\n`);
      }
    } else {
      // No else block, link condition directly to merge
      lines.push(`      ${conditionId} -- No --> ${mergeNodeId}\n`);
    }

    return mergeNodeId;
  }

  private async processWhileStatement(
    node: SyntaxNode,
    previousNodeId: string,
    filePath: string,
    depth: number,
    lines: string[],
    linkLabel?: string,
  ): Promise<string> {
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
    lines.push(`      ${conditionId}{"${conditionText}"}\n`);
    lines.push(`      ${previousNodeId} ${incomingLink} ${conditionId}\n`);

    // Loop body
    if (bodyNode) {
      const endBody = await this.processBlock(
        bodyNode,
        conditionId,
        filePath,
        depth,
        lines,
        "Loop",
      );
      if (endBody) {
        // Loop back
        lines.push(`      ${endBody} --> ${conditionId}\n`);
      }
    }

    // Exit loop
    const exitNodeId = this.getNextId();
    lines.push(`      ${exitNodeId}("Exit")\n`); // Exit node (rounded rectangle)
    lines.push(`      ${conditionId} -- Done --> ${exitNodeId}\n`);

    return exitNodeId;
  }

  private async processForStatement(
    node: SyntaxNode,
    previousNodeId: string,
    filePath: string,
    depth: number,
    lines: string[],
    linkLabel?: string,
  ): Promise<string> {
    // Similar to while loop
    const conditionId = this.getNextId();
    const incomingLink = linkLabel ? `-- ${linkLabel} -->` : `-->`;

    lines.push(`      ${conditionId}{"Loop"}\n`);
    lines.push(`      ${previousNodeId} ${incomingLink} ${conditionId}\n`);

    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      const endBody = await this.processBlock(
        bodyNode,
        conditionId,
        filePath,
        depth,
        lines,
        "Loop",
      );
      if (endBody) {
        lines.push(`      ${endBody} --> ${conditionId}\n`);
      }
    }

    const exitNodeId = this.getNextId();
    lines.push(`      ${exitNodeId}("Exit")\n`); // Exit node (rounded rectangle)
    lines.push(`      ${conditionId} -- Done --> ${exitNodeId}\n`);

    return exitNodeId;
  }

  private sanitizeLabel(text: string): string {
    // Escape special characters to prevent Mermaid syntax errors
    // Mermaid supports HTML entities but without the & prefix in some contexts
    // We use the format #quot; instead of &quot; for better compatibility
    return text
      .replace(/&/g, "#amp;")
      .replace(/</g, "#lt;")
      .replace(/>/g, "#gt;")
      .replace(/"/g, "#quot;")
      .replace(/'/g, "#apos;")
      .replace(/\(/g, "#40;")
      .replace(/\)/g, "#41;")
      .replace(/\[/g, "#91;")
      .replace(/\]/g, "#93;")
      .replace(/\{/g, "#123;")
      .replace(/\}/g, "#125;")
      .replace(/\|/g, "#124;")
      .replace(/\n/g, " ");
  }

  // --- Cross-File Resolution Helpers ---

  private async resolveFunction(
    functionName: string,
    currentFilePath: string,
  ): Promise<{ filePath: string; functionName: string } | null> {
    // 1. Check imports in current file
    try {
      const code = await this.fileProvider.readFile(currentFilePath);
      const ast = await this.parserService.parse(code, currentFilePath);
      const unifiedAST = ast as UnifiedAST;

      // Check imports
      for (const imp of unifiedAST.imports) {
        if (imp.specifiers.includes(functionName)) {
          // Found import. Resolve source.
          if (imp.source) {
            const resolvedPath = await this.fileProvider.resolveImport(
              currentFilePath,
              imp.source,
            );
            if (resolvedPath) {
              return { filePath: resolvedPath, functionName };
            }
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private findFunctionNode(
    node: SyntaxNode,
    functionName: string,
  ): SyntaxNode | null {
    if (
      node.type === "function_declaration" ||
      node.type === "method_declaration" ||
      node.type === "arrow_function" ||
      node.type === "function_expression" ||
      node.type === "function_definition"
    ) {
      const nameNode = node.childForFieldName("name");
      if (nameNode && nameNode.text === functionName) {
        return node;
      }
    }

    for (const child of node.children) {
      const found = this.findFunctionNode(child, functionName);
      if (found) return found;
    }

    return null;
  }
}
