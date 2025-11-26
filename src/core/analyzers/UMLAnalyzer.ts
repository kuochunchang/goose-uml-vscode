import { LanguageDetector } from "../parsers/common/index.js";
import { ParserService } from "../services/ParserService.js";
import type {
  DependencyInfo as ASTDependencyInfo,
  BidirectionalAnalysisResult,
  ClassInfo,
  DiagramGenerationMode,
  DiagramType,
  FileAnalysisResult,
  IFileProvider,
  ImportInfo,
  SequenceInfo,
  UMLResult,
  UnifiedAST,
} from "../types/index.js";
import { MermaidValidator } from "../utils/mermaidValidator.js";
import { FlowchartAnalyzer } from "./FlowchartAnalyzer.js";
import { CrossFileAnalyzer } from "./CrossFileAnalyzer.js";
import { OOAnalyzer } from "./OOAnalyzer.js";
import { UnifiedSequenceAnalyzer } from "./UnifiedSequenceAnalyzer.js";

// Simplified dependency information
export interface DependencyInfo {
  from: string;
  to: string;
  type: "import" | "composition" | "aggregation" | "usage";
}

export class UMLAnalyzer {
  private validator: MermaidValidator;
  private fileProvider: IFileProvider;
  private parserService: ParserService;

  constructor(fileProvider: IFileProvider) {
    this.fileProvider = fileProvider;
    this.validator = new MermaidValidator();
    this.parserService = ParserService.getInstance();
  }

  /**
   * Generate UML diagram (native mode only)
   *
   * @param code - Source code to analyze
   * @param type - Diagram type
   * @param filePath - Optional file path for language detection (required for multi-language support)
   */
  async generateDiagram(
    code: string,
    type: DiagramType,
    filePath?: string,
  ): Promise<UMLResult> {
    try {
      return await this.generateWithNative(
        code,
        type,
        filePath || "unknown.ts",
      );
    } catch (error) {
      throw new Error(
        `Failed to generate ${type} diagram: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Generate UML diagram with unified interface for both single-file and cross-file analysis
   *
   * @param filePath - Target file path to analyze (relative to project root)
   * @param type - Diagram type: 'class', 'flowchart', 'sequence', or 'dependency'
   * @param options - Generation options
   * @param options.depth - Analysis depth: 0 = single file only, 1-10 = cross-file analysis (default: 0)
   * @param options.mode - Analysis mode for cross-file: 'bidirectional', 'forward', or 'reverse' (default: 'bidirectional')
   * @param options.aiMode - AI generation mode override (uses config if not specified)
   * @returns UML diagram with consistent metadata structure
   */
  async generateUnifiedDiagram(
    filePath: string,
    type: DiagramType,
    options?: {
      depth?: number;
      mode?: "bidirectional" | "forward" | "reverse";
      aiMode?: DiagramGenerationMode;
    },
  ): Promise<UMLResult> {
    const depth = options?.depth ?? 0;
    const mode = options?.mode ?? "bidirectional";

    try {
      // Validate depth parameter
      if (depth < 0 || depth > 10) {
        throw new Error(
          "Depth must be between 0 (single file) and 10 (cross-file)",
        );
      }

      // For class diagrams, support both single-file and cross-file analysis
      if (type === "class") {
        if (depth === 0) {
          // Single-file class diagram
          return await this.generateSingleFileClassDiagram(filePath);
        } else {
          // Cross-file class diagram
          return await this.generateCrossFileClassDiagram(
            filePath,
            depth as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
            mode,
          );
        }
      }

      // For sequence diagrams, support both single-file and cross-file analysis
      if (type === "sequence") {
        if (depth === 0) {
          // Single-file sequence diagram
          return await this.generateSingleFileDiagram(filePath, type);
        } else {
          // Cross-file sequence diagram
          return await this.generateCrossFileSequenceDiagram(
            filePath,
            depth as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
            mode,
          );
        }
      }

      // For flowcharts, support both single-file and cross-file analysis
      if (type === "flowchart") {
        if (depth === 0) {
          // Single-file flowchart
          return await this.generateSingleFileDiagram(filePath, type);
        } else {
          // Cross-file flowchart
          return await this.generateCrossFileFlowchart(
            filePath,
            depth as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
          );
        }
      }

      // Single-file analysis for dependency
      return await this.generateSingleFileDiagram(filePath, type);
    } catch (error) {
      throw new Error(
        `Failed to generate ${type} diagram (depth=${depth}): ${(error as Error).message}`,
      );
    }
  }

  /**
   * Generate single-file class diagram from file path
   */
  private async generateSingleFileClassDiagram(
    filePath: string,
  ): Promise<UMLResult> {
    // Read file content using fileProvider
    const code = await this.fileProvider.readFile(filePath);

    // Use existing generateDiagram for single-file class diagram (with filePath for language detection)
    const result = await this.generateDiagram(code, "class", filePath);

    // Add depth metadata
    return {
      ...result,
      metadata: {
        ...result.metadata,
        depth: 0,
        singleFile: true,
        filePath,
      },
    };
  }

  /**
   * Generate single-file diagram (flowchart, sequence, dependency) from file path
   */
  private async generateSingleFileDiagram(
    filePath: string,
    type: DiagramType,
  ): Promise<UMLResult> {
    // Read file content using fileProvider
    const code = await this.fileProvider.readFile(filePath);

    // Use existing generateDiagram for single-file analysis (with filePath for language detection)
    const result = await this.generateDiagram(code, type, filePath);

    // Add depth metadata
    return {
      ...result,
      metadata: {
        ...result.metadata,
        depth: 0,
        singleFile: true,
        filePath,
      },
    };
  }

  /**
   * Generate cross-file flowchart
   */
  async generateCrossFileFlowchart(
    filePath: string,
    depth: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 = 1,
  ): Promise<UMLResult> {
    // Read file content using fileProvider
    const code = await this.fileProvider.readFile(filePath);
    const ast = await this.parseCode(code, filePath);

    const analyzer = new FlowchartAnalyzer(this.fileProvider);
    const mermaidCode = await analyzer.analyze(ast, { depth });

    return {
      type: "flowchart",
      mermaidCode,
      generationMode: "native",
      metadata: {
        depth,
        singleFile: false,
        filePath,
      },
    };
  }

  /**
   * Generate cross-file class diagram with specified analysis mode
   *
   * @param filePath - Target file path to analyze
   * @param depth - Maximum traversal depth (1-10)
   * @param mode - Analysis mode: 'forward', 'reverse', or 'bidirectional'
   * @returns UML class diagram with cross-file relationships
   */
  async generateCrossFileClassDiagram(
    filePath: string,
    depth: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 = 1,
    mode: "forward" | "reverse" | "bidirectional" = "bidirectional",
  ): Promise<UMLResult> {
    // Validate depth parameter
    if (depth < 1 || depth > 10) {
      throw new Error("Cross-file analysis depth must be between 1 and 10");
    }

    // Create CrossFileAnalyzer instance
    const crossFileAnalyzer = new CrossFileAnalyzer(this.fileProvider);

    // Execute analysis based on mode
    let analysisResult: BidirectionalAnalysisResult;

    if (mode === "forward") {
      // Forward-only mode: only analyze what this file imports
      const forwardResults = await crossFileAnalyzer.analyzeForward(
        filePath,
        depth,
      );
      // Convert to BidirectionalAnalysisResult format
      const forwardDeps: FileAnalysisResult[] = [];
      const allClasses: ClassInfo[] = [];
      const allRelationships: ASTDependencyInfo[] = [];
      const classSet = new Set<string>();
      const relationshipSet = new Set<string>();

      for (const [path, result] of forwardResults.entries()) {
        if (path !== filePath) {
          forwardDeps.push(result);
        }
        for (const cls of result.classes) {
          const key = `${result.filePath}:${cls.name}`;
          if (!classSet.has(key)) {
            classSet.add(key);
            allClasses.push(cls);
          }
        }
        // In forward mode, show all relationships in the dependency chain
        // (e.g., if chain is 3-->4-->5, show both 3-->4 and 4-->5)
        for (const rel of result.relationships) {
          const key = `${rel.from}:${rel.to}:${rel.type}:${rel.context || ""}`;
          if (!relationshipSet.has(key)) {
            relationshipSet.add(key);
            allRelationships.push(rel);
          }
        }
      }

      analysisResult = {
        targetFile: filePath,
        forwardDeps,
        reverseDeps: [],
        allClasses,
        relationships: allRelationships,
        stats: {
          totalFiles: forwardResults.size,
          totalClasses: allClasses.length,
          totalRelationships: allRelationships.length,
          maxDepth: Math.max(
            ...Array.from(forwardResults.values()).map((r) => r.depth),
          ),
        },
      };
    } else if (mode === "reverse") {
      // Reverse-only mode: only analyze what imports this file
      const reverseResults = await crossFileAnalyzer.analyzeReverse(
        filePath,
        depth,
      );
      // Convert to BidirectionalAnalysisResult format
      const reverseDeps: FileAnalysisResult[] = [];
      const allClasses: ClassInfo[] = [];
      const allRelationships: ASTDependencyInfo[] = [];
      const classSet = new Set<string>();
      const relationshipSet = new Set<string>();

      // Separate target file classes from other classes, grouped by depth
      const targetFileClasses: ClassInfo[] = [];

      // Build a map of depth to FileAnalysisResult
      const depthMap = new Map<
        number,
        Array<{ filePath: string; result: FileAnalysisResult }>
      >();

      for (const [path, result] of reverseResults.entries()) {
        if (path !== filePath) {
          reverseDeps.push(result);
        }

        // Group by depth for ordering
        if (!depthMap.has(result.depth)) {
          depthMap.set(result.depth, []);
        }
        depthMap.get(result.depth)!.push({ filePath: path, result });

        // Separate target file classes
        if (path === filePath) {
          for (const cls of result.classes) {
            targetFileClasses.push(cls);
          }
        }
      }

      // In reverse mode: first build the reverse dependency chain
      // to determine which classes should be displayed
      const targetClassNames = new Set(
        targetFileClasses.map((cls) => cls.name),
      );

      // Build a set of all classes that are part of the reverse dependency chain
      // (classes that eventually point to target classes)
      // IMPORTANT: Exclude relationships from target file when building the chain
      // to avoid including forward dependencies (e.g., Layer4 --> Layer5)
      const chainClassNames = new Set<string>(targetClassNames);
      let changed = true;
      // Iteratively find all classes that point to classes in the chain
      // This builds the complete reverse dependency chain (e.g., 1-->2-->3 if target is 3)
      while (changed) {
        changed = false;
        for (const [path, result] of reverseResults.entries()) {
          // Skip target file when building the chain (its relationships are forward deps)
          if (path === filePath) {
            continue;
          }
          for (const rel of result.relationships) {
            // If 'to' is in the chain, add 'from' to the chain
            // Also ensure 'from' is not a target class (to avoid forward deps)
            if (
              chainClassNames.has(rel.to) &&
              !chainClassNames.has(rel.from) &&
              !targetClassNames.has(rel.from)
            ) {
              chainClassNames.add(rel.from);
              changed = true;
            }
          }
        }
      }

      // Process classes in depth order (0, 1, 2, ... n-1)
      // In reverse mode, only include classes that are in the reverse dependency chain
      const otherClasses: ClassInfo[] = [];
      const sortedDepths = Array.from(depthMap.keys()).sort((a, b) => a - b);

      for (const d of sortedDepths) {
        const filesAtDepth = depthMap.get(d)!;
        for (const { filePath: fileAtDepth, result } of filesAtDepth) {
          // Skip target file (it will be added at the end)
          if (fileAtDepth === filePath) {
            continue;
          }

          for (const cls of result.classes) {
            // In reverse mode, only include classes that are in the reverse dependency chain
            if (mode === "reverse" && !chainClassNames.has(cls.name)) {
              continue; // Skip classes not in the reverse dependency chain
            }

            const key = `${result.filePath}:${cls.name}`;
            if (!classSet.has(key)) {
              classSet.add(key);
              otherClasses.push(cls);
            }
          }
        }
      }

      // Add relationships (after classes are organized)
      // In reverse mode, show all relationships in the reverse dependency chain
      // This ensures we show the complete reverse dependency chain (e.g., 1-->2-->3)
      // Exclude relationships where 'from' is a target class (those are forward dependencies)
      // Also exclude relationships from the target file itself
      for (const [path, result] of reverseResults.entries()) {
        // In reverse mode, skip all relationships from the target file
        // (these are forward dependencies, not reverse)
        if (mode === "reverse" && path === filePath) {
          continue; // Skip all relationships from target file
        }

        for (const rel of result.relationships) {
          // In reverse mode:
          // 1. Only show relationships where 'to' is in the chain (leads to target)
          // 2. Exclude relationships where 'from' is a target class (those are forward deps)
          if (mode === "reverse") {
            // Skip if 'to' is not in the chain (doesn't lead to target)
            if (!chainClassNames.has(rel.to)) {
              continue;
            }
            // Skip if 'from' is a target class (this is a forward dependency, not reverse)
            if (targetClassNames.has(rel.from)) {
              continue;
            }
          }

          const key = `${rel.from}:${rel.to}:${rel.type}:${rel.context || ""}`;
          if (!relationshipSet.has(key)) {
            relationshipSet.add(key);
            allRelationships.push(rel);
          }
        }
      }

      // In reverse mode: classes ordered by depth (0 -> n), then target file at the end
      const orderedClasses = [...otherClasses, ...targetFileClasses];

      analysisResult = {
        targetFile: filePath,
        forwardDeps: [],
        reverseDeps,
        allClasses: orderedClasses,
        relationships: allRelationships,
        stats: {
          totalFiles: reverseResults.size,
          totalClasses: allClasses.length,
          totalRelationships: allRelationships.length,
          maxDepth: Math.max(
            ...Array.from(reverseResults.values()).map((r) => r.depth),
          ),
        },
      };
    } else {
      // Bidirectional mode: analyze both forward and reverse
      analysisResult = await crossFileAnalyzer.analyzeBidirectional(
        filePath,
        depth,
      );
    }

    // Generate Mermaid class diagram from analysis result
    const mermaidCode = this.generateMermaidClassDiagram(
      analysisResult.allClasses,
      analysisResult.relationships,
      mode, // Pass mode to control arrow direction
    );

    // Return UML result with cross-file metadata
    return {
      type: "class",
      mermaidCode,
      generationMode: "native",
      metadata: {
        classes: analysisResult.allClasses,
        dependencies: analysisResult.relationships,
        depth,
        mode,
        singleFile: false,
        filePath,
        crossFileStats: analysisResult.stats,
        forwardDependencies: analysisResult.forwardDeps.map(
          (dep) => dep.filePath,
        ),
        reverseDependencies: analysisResult.reverseDeps.map(
          (dep) => dep.filePath,
        ),
      },
    };
  }

  /**
   * Generate cross-file sequence diagram
   * Analyzes method call flows across multiple files based on dependencies
   */
  async generateCrossFileSequenceDiagram(
    filePath: string,
    depth: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 = 1,
    mode: "forward" | "reverse" | "bidirectional" = "bidirectional",
  ): Promise<UMLResult> {
    // Validate depth parameter
    if (depth < 1 || depth > 10) {
      throw new Error("Cross-file analysis depth must be between 1 and 10");
    }

    // Create CrossFileAnalyzer instance to get related files
    const crossFileAnalyzer = new CrossFileAnalyzer(this.fileProvider);

    // Execute analysis to get related files
    const analysisResult = await crossFileAnalyzer.analyzeBidirectional(
      filePath,
      depth,
    );

    // Collect all files to analyze (main file + dependencies)
    const filesToAnalyze = new Set<string>();
    filesToAnalyze.add(filePath);

    // Add forward dependencies
    for (const dep of analysisResult.forwardDeps) {
      filesToAnalyze.add(dep.filePath);
    }

    // Add reverse dependencies
    for (const dep of analysisResult.reverseDeps) {
      filesToAnalyze.add(dep.filePath);
    }

    // Analyze each file and collect sequence information
    const allParticipants = new Map<
      string,
      { name: string; type: string; sourceFile?: string }
    >();
    const allInteractions: Array<{
      from: string;
      to: string;
      message: string;
      type: string;
      sourceFile?: string;
    }> = [];
    const allEntryPoints = new Set<string>();

    for (const file of filesToAnalyze) {
      try {
        const code = await this.fileProvider.readFile(file);
        const ast = await this.parseCode(code, file);

        // Get relative file name for annotation
        const fileName = file.split("/").pop() || file;

        // Use UnifiedSequenceAnalyzer for all languages (UnifiedAST)
        const unifiedSequenceAnalyzer = new UnifiedSequenceAnalyzer();
        const analysis = unifiedSequenceAnalyzer.analyze(ast);

        // Add participants with source file annotation
        for (const participant of analysis.participants) {
          const key = `${participant.name}_${fileName}`;
          if (!allParticipants.has(key)) {
            allParticipants.set(key, {
              ...participant,
              sourceFile: fileName,
            });
          }
        }

        // Add interactions with source file annotation
        for (const interaction of analysis.interactions) {
          allInteractions.push({
            ...interaction,
            sourceFile: fileName,
          });
        }

        // Add entry points
        for (const entryPoint of analysis.entryPoints) {
          allEntryPoints.add(entryPoint);
        }
      } catch (error) {
        // Skip files that can't be analyzed
        console.warn(`Failed to analyze ${file} for sequence diagram:`, error);
      }
    }

    // Generate Mermaid sequence diagram from merged results
    const mermaidCode = this.generateMermaidSequenceDiagram({
      participants: Array.from(allParticipants.values()),
      interactions: allInteractions,
      entryPoints: Array.from(allEntryPoints),
    });

    // Convert to SequenceInfo for metadata
    const sequences = this.convertToSequenceInfo({
      participants: Array.from(allParticipants.values()),
      interactions: allInteractions,
    });

    // Return UML result with cross-file metadata
    return {
      type: "sequence",
      mermaidCode,
      generationMode: "native",
      metadata: {
        sequences,
        participants: Array.from(allParticipants.values()),
        interactions: allInteractions,
        entryPoints: Array.from(allEntryPoints),
        depth,
        mode,
        singleFile: false,
        filePath,
        crossFileStats: analysisResult.stats,
        forwardDependencies: analysisResult.forwardDeps.map(
          (dep) => dep.filePath,
        ),
        reverseDependencies: analysisResult.reverseDeps.map(
          (dep) => dep.filePath,
        ),
      },
    };
  }

  /**
   * Get Mermaid relationship symbol
   */
  private getRelationshipSymbol(type: string): string {
    switch (type) {
      case "inheritance":
        return "<|--";
      case "realization":
        return "<|..";
      case "composition":
        return "*--";
      case "aggregation":
        return "o--";
      case "association":
        return "-->";
      case "dependency":
        return "..>";
      case "injection":
        return "..>";
      default:
        return "-->";
    }
  }

  /**
   * Generate diagram using native AST parsing
   */
  private async generateWithNative(
    code: string,
    type: DiagramType,
    filePath: string,
  ): Promise<UMLResult> {
    // Parse code to AST (supports multiple languages)
    const ast = await this.parseCode(code, filePath);

    if (type === "class") {
      return this.generateClassDiagram(ast, code, filePath);
    } else if (type === "sequence") {
      // Sequence diagrams use UnifiedAST for all languages
      return this.generateSequenceDiagramFromUnifiedAST(ast, code);
    } else if (type === "flowchart") {
      // Flowcharts
      return await this.generateFlowchart(ast);
    }

    throw new Error(`Unsupported diagram type: ${type}`);
  }

  /**
   * Parse code to AST (supports multiple languages)
   * Uses unified parser system for all languages (TypeScript, JavaScript, Java, Python)
   */
  private async parseCode(code: string, filePath: string): Promise<UnifiedAST> {
    // Normalize file path (handle file:// URIs from VS Code)
    let normalizedPath = filePath;
    if (filePath.startsWith("file://")) {
      try {
        const url = new URL(filePath);
        normalizedPath = url.pathname;
        // On Windows, remove leading slash from pathname (e.g., /C:/path -> C:/path)
        if (process.platform === "win32" && normalizedPath.match(/^\/[A-Z]:/)) {
          normalizedPath = normalizedPath.substring(1);
        }
      } catch {
        // If URL parsing fails, try simple string replacement
        normalizedPath = filePath.replace(/^file:\/\//, "");
      }
    }

    const language = LanguageDetector.detectFromFilePath(normalizedPath);

    // Debug logging (can be removed in production)
    if (!language) {
      console.warn(
        `[UMLAnalyzer] Could not detect language for file: ${filePath} (normalized: ${normalizedPath})`,
      );
    } else {
      console.debug(
        `[UMLAnalyzer] Detected language: ${language} for file: ${filePath}`,
      );
    }

    // Use unified parser for all languages
    if (language) {
      if (!this.parserService.canParse(normalizedPath)) {
        throw new Error(
          `No parser available for language '${language}' (file: ${normalizedPath}). ` +
            `Supported languages: ${this.parserService.getSupportedLanguages().join(", ")}`,
        );
      }

      try {
        return await this.parserService.parse(code, normalizedPath);
      } catch (error) {
        throw new Error(
          `Failed to parse ${language} code: ${(error as Error).message}`,
        );
      }
    }

    throw new Error(
      `Unsupported file type: ${normalizedPath}. ` +
        `Could not detect language from file path. ` +
        `Supported extensions: .ts, .tsx, .js, .jsx, .java, .py, .pyi, .pyw`,
    );
  }

  /**
   * Generate activity diagram (flowchart)
   */
  /**
   * Generate flowchart
   */
  private async generateFlowchart(ast: UnifiedAST): Promise<UMLResult> {
    const analyzer = new FlowchartAnalyzer(this.fileProvider);
    const mermaidCode = await analyzer.analyze(ast);

    return {
      type: "flowchart",
      mermaidCode,
      generationMode: "native",
      metadata: {
        // Add any specific metadata if needed
      },
    };
  }

  /**
   * Generate class diagram (supports UnifiedAST)
   */
  private generateClassDiagram(
    ast: UnifiedAST,
    _code: string,
    _filePath: string,
  ): UMLResult {
    const classes: ClassInfo[] = [];
    const ooAnalyzer = new OOAnalyzer();
    let imports: ImportInfo[] = [];

    // UnifiedAST from all parsers (TypeScript, JavaScript, Java, Python)
    classes.push(...ast.classes);
    // Convert interfaces to ClassInfo format (interfaces have extends as string[])
    // Preserve type: 'interface' to maintain correct UML representation
    for (const iface of ast.interfaces) {
      classes.push({
        ...iface,
        // Keep original type: 'interface' instead of overwriting with 'class'
        extends:
          iface.extends && iface.extends.length > 0
            ? iface.extends[0]
            : undefined,
        implements:
          iface.extends && iface.extends.length > 1
            ? iface.extends.slice(1)
            : undefined,
      });
    }
    imports = ast.imports;

    // Analyze OO relationships (composition, aggregation, dependency, etc.)
    const ooAnalysis = ooAnalyzer.analyze(classes, imports);

    // Generate Mermaid class diagram syntax with OO relationships
    const mermaidCode = this.generateMermaidClassDiagram(
      classes,
      ooAnalysis.relationships,
    );

    return {
      type: "class",
      mermaidCode,
      generationMode: "native",
      metadata: {
        classes,
        dependencies: ooAnalysis.relationships,
        imports,
      },
    };
  }

  /**
   * Check if a type name represents a class (not a primitive type)
   */
  private isClassTypeName(typeName: string): boolean {
    const primitiveTypes = [
      "string",
      "number",
      "boolean",
      "null",
      "undefined",
      "void",
      "any",
      "unknown",
      "never",
      "bigint",
      "symbol",
    ];

    const builtInTypes = [
      "Array",
      "Map",
      "Set",
      "WeakMap",
      "WeakSet",
      "Promise",
      "Date",
      "RegExp",
      "Error",
    ];

    // Remove array brackets and generic type arguments
    const baseType = typeName.replace(/\[\]/g, "").replace(/<.*>/g, "").trim();

    // Check if it's a primitive type
    if (primitiveTypes.includes(baseType.toLowerCase())) {
      return false;
    }

    // Check if it's a built-in type
    if (builtInTypes.includes(baseType)) {
      return false;
    }

    // Class names typically start with uppercase letter
    return baseType.length > 0 && baseType[0] === baseType[0].toUpperCase();
  }

  /**
   * Generate Mermaid class diagram syntax
   */
  private generateMermaidClassDiagram(
    classes: ClassInfo[],
    dependencies?: ASTDependencyInfo[],
    mode?: "forward" | "reverse" | "bidirectional",
  ): string {
    let mermaid = "classDiagram\n";

    // In reverse mode, add direction TB to ensure proper top-to-bottom layout
    if (mode === "reverse") {
      mermaid += "  direction TB\n";
    }

    // If no classes found, generate a placeholder to avoid empty diagram
    if (classes.length === 0) {
      mermaid += "  class NoClassesFound\n";
      mermaid += "  NoClassesFound : No classes or interfaces found\n";
      mermaid += "  NoClassesFound : +This file may not contain\n";
      mermaid += "  NoClassesFound : +any class definitions\n";
      return mermaid;
    }

    // Generate each class/interface
    classes.forEach((classInfo) => {
      const isInterface = classInfo.type === "interface";

      mermaid += isInterface
        ? `  interface ${classInfo.name}\n`
        : `  class ${classInfo.name}\n`;

      // Add properties
      classInfo.properties.forEach((prop) => {
        const visibility = this.getVisibilitySymbol(prop.visibility);
        const type = prop.type
          ? ` ${this.sanitizeTypeForMermaid(prop.type)}`
          : "";
        mermaid += `  ${classInfo.name} : ${visibility}${prop.name}${type}\n`;
      });

      // Add methods
      classInfo.methods.forEach((method) => {
        const visibility = this.getVisibilitySymbol(method.visibility);
        // Mermaid doesn't support TypeScript-style "name: type" in parameters
        // Use "type name" format instead
        const params = method.parameters
          .map((p) => {
            if (p.type) {
              return `${this.sanitizeTypeForMermaid(p.type)} ${p.name}`;
            }
            return p.name;
          })
          .join(", ");
        const returnType = method.returnType
          ? ` ${this.sanitizeTypeForMermaid(method.returnType)}`
          : "";
        mermaid += `  ${classInfo.name} : ${visibility}${method.name}(${params})${returnType}\n`;
      });

      mermaid += "\n";
    });

    // Generate inheritance and implementation relationships
    classes.forEach((classInfo) => {
      // Inheritance relationship (solid line with hollow arrow)
      if (classInfo.extends) {
        mermaid += `  ${classInfo.extends} <|-- ${classInfo.name}\n`;
      }

      // Implementation relationship (dashed line with hollow arrow)
      if (classInfo.implements) {
        classInfo.implements.forEach((interfaceName) => {
          mermaid += `  ${interfaceName} <|.. ${classInfo.name}\n`;
        });
      }
    });

    // Generate OO relationship dependencies (composition, aggregation, etc.)
    if (dependencies && dependencies.length > 0) {
      const internalDeps = dependencies.filter((dep) =>
        this.classExists(dep.to, classes),
      );

      internalDeps.forEach((dep) => {
        const { type, cardinality, context } = dep;
        const { from, to } = dep;

        // In reverse mode, relationships already point TO target classes
        // (filtered in generateCrossFileClassDiagram), so we don't need to swap
        // The arrow direction should remain: from -> to (showing what depends on target)

        // Generate Mermaid syntax based on relationship type
        switch (type) {
          case "composition": // Solid diamond ◆ (strong ownership)
            // A *-- B : cardinality (A owns B, B's lifecycle controlled by A)
            mermaid += `  ${from} *-- "${cardinality || "1"}" ${to}`;
            if (context) {
              mermaid += ` : ${this.sanitizeLabelForMermaid(context)}`;
            }
            mermaid += "\n";
            break;

          case "aggregation": // Hollow diamond ◇ (weak ownership)
            // A o-- B : cardinality (A uses B, but B can exist independently)
            mermaid += `  ${from} o-- "${cardinality || "*"}" ${to}`;
            if (context) {
              mermaid += ` : ${this.sanitizeLabelForMermaid(context)}`;
            }
            mermaid += "\n";
            break;

          case "dependency": // Dashed arrow (uses/depends on)
            // A ..> B (method uses B as parameter or return type)
            mermaid += `  ${from} ..> ${to}`;
            if (context) {
              mermaid += ` : ${this.sanitizeLabelForMermaid(context)}`;
            }
            mermaid += "\n";
            break;

          case "association": // Solid arrow (references)
            // A --> B : cardinality (A references B)
            mermaid += `  ${from} --> "${cardinality || "1"}" ${to}`;
            if (context) {
              mermaid += ` : ${context}`;
            }
            mermaid += "\n";
            break;

          case "injection": {
            mermaid += `  ${from} ..> ${to}`;
            const label = `inject${context ? ` ${context}` : ""}`;
            mermaid += ` : ${label}`;
            mermaid += "\n";
            break;
          }

          default:
            // Fallback to basic dependency
            mermaid += `  ${from} ..> ${to}\n`;
        }
      });
    }

    return mermaid;
  }

  /**
   * Check if a class exists in the classes list
   */
  private classExists(className: string, classes: ClassInfo[]): boolean {
    return classes.some((cls) => cls.name === className);
  }

  /**
   * Get visibility symbol
   */
  private getVisibilitySymbol(
    visibility: "public" | "private" | "protected",
  ): string {
    switch (visibility) {
      case "public":
        return "+";
      case "private":
        return "-";
      case "protected":
        return "#";
      default:
        return "+";
    }
  }

  private sanitizeTypeForMermaid(type: string): string {
    return type
      .replace(/["']/g, "")
      .replace(/\s+/g, " ")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\|/g, "&#124;")
      .trim();
  }

  private sanitizeLabelForMermaid(label: string): string {
    return label.replace(/<<|>>/g, "").replace(/["']/g, "").trim();
  }

  /**
   * Generate sequence diagram from UnifiedAST (Java/Python)
   */
  private generateSequenceDiagramFromUnifiedAST(
    ast: UnifiedAST,
    _code: string,
  ): UMLResult {
    const unifiedSequenceAnalyzer = new UnifiedSequenceAnalyzer();
    const analysis = unifiedSequenceAnalyzer.analyze(ast);

    // Generate Mermaid sequence diagram syntax
    const mermaidCode = this.generateMermaidSequenceDiagram(analysis);

    // Extract metadata for backward compatibility
    const sequences: SequenceInfo[] = this.convertToSequenceInfo(analysis);

    return {
      type: "sequence",
      mermaidCode,
      generationMode: "native",
      metadata: {
        sequences,
        participants: analysis.participants,
        interactions: analysis.interactions,
        entryPoints: analysis.entryPoints,
      },
    };
  }

  /**
   * Generate Mermaid sequence diagram syntax
   */
  private generateMermaidSequenceDiagram(analysis: {
    participants: Array<{ name: string; type: string }>;
    interactions: Array<{
      from: string;
      to: string;
      message: string;
      type: string;
    }>;
    entryPoints: string[];
  }): string {
    let mermaid = "sequenceDiagram\n";

    // If no interactions found, generate a placeholder
    if (analysis.interactions.length === 0) {
      mermaid += "  participant NoCode\n";
      mermaid += "  Note over NoCode: No function calls detected\n";
      return mermaid;
    }

    // Add participants in order
    const addedParticipants = new Set<string>();
    for (const participant of analysis.participants) {
      if (!addedParticipants.has(participant.name)) {
        mermaid += `  participant ${this.sanitizeParticipantName(participant.name)}\n`;
        addedParticipants.add(participant.name);
      }
    }

    mermaid += "\n";

    // Add interactions
    for (const interaction of analysis.interactions) {
      const from = this.sanitizeParticipantName(interaction.from);
      const to = this.sanitizeParticipantName(interaction.to);
      const message = this.sanitizeMessage(interaction.message);

      // Choose arrow type based on interaction type
      let arrow = "->>";
      if (interaction.type === "async") {
        arrow = "-)";
      } else if (interaction.type === "return") {
        arrow = "-->>";
      }

      mermaid += `  ${from}${arrow}${to}: ${message}\n`;
    }

    return mermaid;
  }

  /**
   * Sanitize participant name for Mermaid
   */
  private sanitizeParticipantName(name: string): string {
    // Replace dots with underscores for nested names (e.g., Class.method -> Class_method)
    return name.replace(/\./g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  }

  /**
   * Sanitize message for Mermaid
   */
  private sanitizeMessage(message: string): string {
    // Escape special characters that might break Mermaid syntax
    return message.replace(/"/g, '\\"');
  }

  /**
   * Convert analysis result to legacy SequenceInfo format for backward compatibility
   */
  private convertToSequenceInfo(analysis: {
    participants: Array<{ name: string }>;
    interactions: Array<{
      from: string;
      to: string;
      message: string;
      type: string;
    }>;
  }): SequenceInfo[] {
    const participantMap = new Map<string, SequenceInfo>();

    // Initialize all participants
    for (const participant of analysis.participants) {
      participantMap.set(participant.name, {
        participant: participant.name,
        interactions: [],
      });
    }

    // Group interactions by participant
    for (const interaction of analysis.interactions) {
      const fromInfo = participantMap.get(interaction.from);
      if (fromInfo) {
        fromInfo.interactions.push({
          from: interaction.from,
          to: interaction.to,
          message: interaction.message,
          type: interaction.type as "sync" | "async" | "return",
        });
      }
    }

    return Array.from(participantMap.values());
  }
}
