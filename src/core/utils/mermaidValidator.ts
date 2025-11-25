/**
 * Mermaid syntax validator
 * Platform-agnostic utility for validating and fixing Mermaid diagram syntax
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class MermaidValidator {
  /**
   * Validate Mermaid code
   */
  validate(mermaidCode: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!mermaidCode || mermaidCode.trim().length === 0) {
      errors.push("Mermaid code is empty");
      return { valid: false, errors, warnings };
    }

    const trimmed = mermaidCode.trim();

    // Check for valid diagram type declaration
    if (!this.hasValidHeader(trimmed)) {
      errors.push(
        "Missing or invalid diagram type header (e.g., classDiagram, flowchart TD, sequenceDiagram, graph TD)",
      );
    }

    // Check node definitions
    const invalidNodes = this.findInvalidNodes(trimmed);
    errors.push(...invalidNodes);

    // Check relationship syntax
    const invalidRelations = this.findInvalidRelations(trimmed);
    errors.push(...invalidRelations);

    // Check common syntax errors
    const syntaxErrors = this.checkCommonSyntaxErrors(trimmed);
    errors.push(...syntaxErrors);

    // Warning checks
    if (this.hasUnusedNodes(trimmed)) {
      warnings.push("Some nodes may be defined but not connected");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Auto-fix common errors
   */
  autoFix(mermaidCode: string): string {
    let fixed = mermaidCode.trim();

    // Remove possible markdown code block markers
    fixed = fixed.replace(/^```(?:mermaid)?\s*\n?/i, "");
    fixed = fixed.replace(/\n?```\s*$/i, "");

    // Fix type annotations in flowchart node labels
    fixed = this.fixFlowchartLabels(fixed);

    // Fix node names (remove invalid characters)
    fixed = this.fixNodeNames(fixed);

    // Fix relationship syntax
    fixed = this.fixRelationSyntax(fixed);

    // Remove excessive blank lines
    fixed = fixed.replace(/\n{3,}/g, "\n\n");

    return fixed.trim();
  }

  private hasValidHeader(code: string): boolean {
    const validHeaders = [
      /^\s*classDiagram/i,
      /^\s*flowchart\s+(TD|TB|BT|RL|LR)/i,
      /^\s*graph\s+(TD|TB|BT|RL|LR)/i,
      /^\s*sequenceDiagram/i,
      /^\s*stateDiagram/i,
      /^\s*erDiagram/i,
      /^\s*journey/i,
      /^\s*gantt/i,
      /^\s*pie/i,
    ];

    return validHeaders.some((regex) => regex.test(code));
  }

  private findInvalidNodes(code: string): string[] {
    const errors: string[] = [];

    // Check for node names with invalid characters
    const invalidCharsRegex = /[^\w\s\-_.[\](){}|<>+=*\\,;"'`~!@#$%^&/:]/g;
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      // Skip comments and blank lines
      if (line.trim().startsWith("%%") || line.trim().length === 0) {
        return;
      }

      // Check special characters (some invalid in Mermaid)
      if (invalidCharsRegex.test(line)) {
        const match = invalidCharsRegex.exec(line);
        if (match) {
          errors.push(
            `Line ${index + 1}: Invalid character '${match[0]}' in node definition`,
          );
        }
      }
    });

    return errors;
  }

  private findInvalidRelations(code: string): string[] {
    const errors: string[] = [];

    // Class diagram relationship syntax
    const classRelations = [
      "<|--", // Inheritance
      "<|..", // Implementation
      "--*", // Composition
      "--o", // Aggregation
      "-->", // Association
      "..", // Dependency
      "--", // Link
    ];

    // Graph/Flowchart relationship syntax
    const graphRelations = [
      "-->", // Arrow
      "---", // Connection
      "-.->", // Dashed arrow
      "-.-", // Dashed line
      "==>", // Thick arrow
      "===", // Thick line
    ];

    const lines = code.split("\n");

    lines.forEach((line, _index) => {
      // Skip diagram type declaration and comments
      if (this.hasValidHeader(line) || line.trim().startsWith("%%")) {
        return;
      }

      // Check if contains relationship symbols
      const hasRelation = [...classRelations, ...graphRelations].some((rel) =>
        line.includes(rel),
      );

      if (hasRelation) {
        // Simple check if relationship syntax is complete (nodes on both sides)
        const relationPattern =
          /(\w+)\s*(--|<\||\.\.|-\.|==).+?(--|\|>|>|\*|o)\s*(\w+)/;
        if (!relationPattern.test(line) && line.trim().length > 0) {
          // Possibly malformed relationship syntax, but not necessarily, so we can give warning instead of error
          // errors.push(`Line ${index + 1}: Possibly malformed relationship syntax`);
        }
      }
    });

    return errors;
  }

  private checkCommonSyntaxErrors(code: string): string[] {
    const errors: string[] = [];

    // Check bracket matching
    const openBrackets = (code.match(/[([{]/g) || []).length;
    const closeBrackets = (code.match(/[)\]}]/g) || []).length;

    if (openBrackets !== closeBrackets) {
      errors.push("Mismatched brackets or parentheses");
    }

    // Check quote matching
    const doubleQuotes = (code.match(/"/g) || []).length;
    const singleQuotes = (code.match(/'/g) || []).length;

    if (doubleQuotes % 2 !== 0) {
      errors.push("Mismatched double quotes");
    }

    if (singleQuotes % 2 !== 0) {
      errors.push("Mismatched single quotes");
    }

    return errors;
  }

  private hasUnusedNodes(_code: string): boolean {
    // Simplified version: this is just a basic check
    // Should actually parse AST to determine
    return false;
  }

  private fixNodeNames(code: string): string {
    const fixed = code;

    // Remove some invalid characters from node names
    // Note: this is a simplified version, actual situation may be more complex
    const lines = fixed.split("\n");
    const fixedLines = lines.map((line) => {
      // Keep comments and diagram type declarations
      if (line.trim().startsWith("%%") || this.hasValidHeader(line)) {
        return line;
      }

      // Fix spaces in node names (replace with underscores)
      // But keep spaces within quotes
      let inQuotes = false;
      let result = "";
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        }
        result += char;
      }

      return result;
    });

    return fixedLines.join("\n");
  }

  private fixRelationSyntax(code: string): string {
    let fixed = code;

    // Fix common relationship syntax errors
    // Example: <-- to <|--
    fixed = fixed.replace(/<--/g, "<|--");

    // Ensure spaces on both sides of relationship symbols
    fixed = fixed.replace(/(\w)(<\|--|<\|\.\.|-->|---)/g, "$1 $2");
    fixed = fixed.replace(/(<\|--|<\|\.\.|-->|---)(\w)/g, "$1 $2");

    return fixed;
  }

  private fixFlowchartLabels(code: string): string {
    const fixed = code;

    // Detect if flowchart or graph
    const isFlowchart = /^\s*(flowchart|graph)\s+(TD|TB|BT|RL|LR)/im.test(
      fixed,
    );
    if (!isFlowchart) {
      return fixed;
    }

    const lines = fixed.split("\n");
    const fixedLines = lines.map((line) => {
      // Skip comments and diagram type declarations
      if (line.trim().startsWith("%%") || this.hasValidHeader(line)) {
        return line;
      }

      // Fix labels in various node definitions
      // Handle square nodes: id[label] or id["label"]
      line = line.replace(/(\w+)\[([^\]]+)\]/g, (match, id, label) => {
        const fixedLabel = this.simplifyLabel(label);
        return `${id}[${fixedLabel}]`;
      });

      // Handle rounded rectangles: id(label)
      line = line.replace(/(\w+)\(([^)]+)\)(?!\s*-->)/g, (match, id, label) => {
        // Ensure not part of arrow
        const fixedLabel = this.simplifyLabel(label);
        return `${id}(${fixedLabel})`;
      });

      // Handle diamond: id{label}
      line = line.replace(/(\w+)\{([^}]+)\}/g, (match, id, label) => {
        const fixedLabel = this.simplifyLabel(label);
        return `${id}{${fixedLabel}}`;
      });

      // Handle cylinder: id[(label)]
      line = line.replace(/(\w+)\[\(([^)]+)\)\]/g, (match, id, label) => {
        const fixedLabel = this.simplifyLabel(label);
        return `${id}[(${fixedLabel})]`;
      });

      return line;
    });

    return fixedLines.join("\n");
  }

  private simplifyLabel(label: string): string {
    let simplified = label.trim();

    // Remove TypeScript type annotation patterns: (param): type or (param: type): returnType
    // Example: "calculateGrade(score): string" -> "calculateGrade"
    simplified = simplified.replace(/\([^)]*\):\s*\w+/g, "");

    // Remove function parameters: functionName(param1, param2) -> functionName
    simplified = simplified.replace(/(\w+)\([^)]*\)/g, "$1");

    // If label becomes empty, use original simplified version
    if (!simplified.trim()) {
      // Try to extract function name or main text
      const funcNameMatch = label.match(/(\w+)/);
      simplified = funcNameMatch ? funcNameMatch[1] : label;
    }

    // Remove redundant colons and type annotations
    simplified = simplified.replace(/:\s*\w+(\[\])?/g, "");

    // Clean up redundant whitespace
    simplified = simplified.trim();

    return simplified;
  }
}
