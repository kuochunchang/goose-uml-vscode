import { parse } from '@babel/parser';
import traverseDefault from '@babel/traverse';
import * as t from '@babel/types';
import * as path from 'path';
import type {
  BidirectionalAnalysisResult,
  ClassInfo,
  DependencyInfo,
  FileAnalysisResult,
  IFileProvider,
  MethodInfo,
  ParameterInfo,
  PropertyInfo,
  UnifiedAST,
  ImportInfo,
  ExportInfo,
} from '../types/index.js';
import { LanguageDetector } from '../parsers/common/index.js';
import { ParserService } from '../services/ParserService.js';
import { OOAnalyzer } from './OOAnalyzer.js';

// Handle CommonJS/ESM compatibility for @babel/traverse
const traverse =
  typeof traverseDefault === 'function' ? traverseDefault : (traverseDefault as any).default;

/**
 * CrossFileAnalyzer - Platform-agnostic cross-file dependency analyzer
 *
 * Responsibilities:
 * - Forward dependency analysis: Track which files this file imports
 * - Supports multi-level depth tracking (depth 1-3)
 * - Circular dependency detection
 * - AST caching for performance
 *
 * Platform Integration:
 * - Uses IFileProvider for all file operations (platform-agnostic)
 * - Delegates import resolution to the provider
 * - No direct file system dependencies
 *
 * Note:
 * - Reverse dependency analysis (who imports this file) is handled by the adapter layer
 * - Import index building is handled by the adapter layer
 */
export class CrossFileAnalyzer {
  private readonly ooAnalyzer: OOAnalyzer;
  private readonly parserService: ParserService;

  // AST cache: filePath → { ast, analysis }
  // Note: mtime validation removed - adapter layer can handle cache invalidation
  private astCache: Map<
    string,
    {
      ast: any;
      analysis: FileAnalysisResult;
    }
  >;

  // Visited files (used to avoid circular dependencies)
  private visited: Set<string>;

  constructor(private readonly fileProvider: IFileProvider) {
    this.ooAnalyzer = new OOAnalyzer();
    this.parserService = ParserService.getInstance();
    this.astCache = new Map();
    this.visited = new Set();
  }

  /**
   * Analyze forward dependencies
   *
   * @param filePath - File path to analyze
   * @param maxDepth - Maximum tracking depth (1-3)
   * @returns Map<filePath, FileAnalysisResult> - All analyzed files
   */
  async analyzeForward(
    filePath: string,
    maxDepth: 1 | 2 | 3
  ): Promise<Map<string, FileAnalysisResult>> {
    // Validate depth parameter
    if (maxDepth < 1 || maxDepth > 3) {
      throw new Error('Depth must be between 1 and 3');
    }

    // Verify file exists
    if (!(await this.fileProvider.exists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Reset visited tracking
    this.visited.clear();

    // Build result Map
    const results = new Map<string, FileAnalysisResult>();

    // Recursive analysis
    await this.analyzeFileRecursive(filePath, 0, maxDepth, results);

    return results;
  }

  // TODO: Import index functionality will be handled by the Node.js adapter
  // The core analyzer focuses on forward analysis only
  //
  // Reverse dependency analysis methods (commented out):
  // - analyzeReverse()
  // - analyzeReverseDependencies()
  // - createReverseDependencies()
  // - getOrBuildImportIndex()
  //
  // These will be implemented in @code-review-goose/analysis-adapter-node
  // using ImportIndexBuilder and providing bidirectional analysis

  /**
   * Analyze bidirectional dependencies (Bidirectional mode)
   *
   * Combines Forward and Reverse analysis for complete dependency view
   *
   * Note: This method is kept for API compatibility but currently only
   * performs forward analysis. Full bidirectional analysis will be
   * implemented in the adapter layer.
   *
   * @param filePath - File path to analyze
   * @param maxDepth - Maximum tracking depth (1-3)
   * @returns BidirectionalAnalysisResult - Contains forward, reverse dependencies and statistics
   */
  async analyzeBidirectional(
    filePath: string,
    maxDepth: 1 | 2 | 3
  ): Promise<BidirectionalAnalysisResult> {
    // Validate depth parameter
    if (maxDepth < 1 || maxDepth > 3) {
      throw new Error('Depth must be between 1 and 3');
    }

    // Verify file exists
    if (!(await this.fileProvider.exists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    // 1. Execute forward analysis
    const forwardResults = await this.analyzeForward(filePath, maxDepth);

    // 2. Reverse analysis - TODO: Will be implemented in adapter layer
    // For now, return empty reverse dependencies
    const reverseResults = new Map<string, FileAnalysisResult>();

    // 3. Merge results
    const allResults = new Map<string, FileAnalysisResult>();

    // Add forward dependencies (excluding target file)
    const forwardDeps: FileAnalysisResult[] = [];
    for (const [path, result] of forwardResults.entries()) {
      if (path !== filePath) {
        forwardDeps.push(result);
      }
      allResults.set(path, result);
    }

    // Add reverse dependencies (excluding target file and existing ones)
    const reverseDeps: FileAnalysisResult[] = [];
    for (const [path, result] of reverseResults.entries()) {
      if (path !== filePath) {
        reverseDeps.push(result);
      }
      if (!allResults.has(path)) {
        allResults.set(path, result);
      }
    }

    // 4. Extract all classes (deduplicated)
    const allClasses: ClassInfo[] = [];
    const classSet = new Set<string>(); // For deduplication (filePath:className)

    for (const result of allResults.values()) {
      for (const cls of result.classes) {
        const key = `${result.filePath}:${cls.name}`;
        if (!classSet.has(key)) {
          classSet.add(key);
          allClasses.push(cls);
        }
      }
    }

    // 5. Extract all relationships (deduplicated)
    const allRelationships: DependencyInfo[] = [];
    const relationshipSet = new Set<string>(); // For deduplication

    for (const result of allResults.values()) {
      for (const rel of result.relationships) {
        // Create unique key: from:to:type:context
        const key = `${rel.from}:${rel.to}:${rel.type}:${rel.context || ''}`;
        if (!relationshipSet.has(key)) {
          relationshipSet.add(key);
          allRelationships.push(rel);
        }
      }
    }

    // 6. Calculate statistics
    const maxDepthFound = Math.max(...Array.from(allResults.values()).map((r) => r.depth));

    return {
      targetFile: filePath,
      forwardDeps,
      reverseDeps,
      allClasses,
      relationships: allRelationships,
      stats: {
        totalFiles: allResults.size,
        totalClasses: allClasses.length,
        totalRelationships: allRelationships.length,
        maxDepth: maxDepthFound,
      },
    };
  }

  /**
   * Recursively analyze file and its dependencies
   * 
   * Strategy: Instead of relying on import statements (which are error-prone and language-specific),
   * we extract class dependencies directly from AST relationships and search for matching files.
   */
  private async analyzeFileRecursive(
    filePath: string,
    currentDepth: number,
    maxDepth: number,
    results: Map<string, FileAnalysisResult>
  ): Promise<void> {
    // Check if already visited (avoid circular dependencies)
    if (this.visited.has(filePath)) {
      return;
    }

    // Mark as visited
    this.visited.add(filePath);

    // Analyze current file
    const analysis = await this.analyzeFile(filePath, currentDepth);

    // Store result
    results.set(filePath, analysis);

    // Stop recursion if max depth reached
    if (currentDepth >= maxDepth) {
      return;
    }

    // Extract referenced classes from AST relationships (more reliable than imports)
    const referencedClasses = this.extractReferencedClasses(analysis);
    const unresolvedClasses: string[] = [];

    for (const className of referencedClasses) {
      // Try to find the class file (prioritize same directory, then search project-wide)
      const resolvedPath = await this.findClassFile(filePath, className);
      
      if (resolvedPath && !this.visited.has(resolvedPath)) {
        await this.analyzeFileRecursive(resolvedPath, currentDepth + 1, maxDepth, results);
      } else if (!resolvedPath) {
        unresolvedClasses.push(className);
      }
    }

    // Log unresolved classes for debugging
    if (unresolvedClasses.length > 0) {
      console.debug(
        `[CrossFileAnalyzer] Unresolved classes in ${filePath}:`,
        unresolvedClasses
      );
    }
  }

  /**
   * Extract referenced class names from OO relationships
   * This is more reliable than parsing imports, as it directly reflects actual dependencies
   */
  private extractReferencedClasses(analysis: FileAnalysisResult): Set<string> {
    const referencedClasses = new Set<string>();

    // Extract from relationships (composition, aggregation, dependency, etc.)
    for (const relationship of analysis.relationships) {
      // Add the target class (the class being referenced)
      referencedClasses.add(relationship.to);
    }

    // Also extract from extends/implements
    for (const classInfo of analysis.classes) {
      if (classInfo.extends) {
        referencedClasses.add(classInfo.extends);
      }
      if (classInfo.implements) {
        for (const interfaceName of classInfo.implements) {
          referencedClasses.add(interfaceName);
        }
      }
    }

    return referencedClasses;
  }

  /**
   * Find class file by searching the project
   * 
   * Search strategy:
   * 1. Try same directory first (most common case)
   * 2. For Python: check imports to find the source module
   * 3. Search project-wide using glob patterns
   * 4. For Python: parse all Python files to find class definition
   */
  private async findClassFile(
    currentFilePath: string,
    className: string
  ): Promise<string | null> {
    const language = LanguageDetector.detectFromFilePath(currentFilePath);

    // Strategy 1: Check same directory first (fast path)
    const sameDirPath = await this.tryResolveInSameDirectory(currentFilePath, className, language);
    if (sameDirPath) {
      console.debug(`[CrossFileAnalyzer] Resolved class in same directory: ${className} -> ${sameDirPath}`);
      return sameDirPath;
    }

    // Strategy 2: For Python, use imports to find the source module
    if (language === 'python') {
      const importBasedPath = await this.findPythonClassViaImports(currentFilePath, className);
      if (importBasedPath) {
        console.debug(`[CrossFileAnalyzer] Resolved Python class via imports: ${className} -> ${importBasedPath}`);
        return importBasedPath;
      }
    }

    // Strategy 3: Search project-wide (slower but more thorough)
    const projectWidePath = await this.searchClassInProject(className, language);
    if (projectWidePath) {
      console.debug(`[CrossFileAnalyzer] Resolved class via project search: ${className} -> ${projectWidePath}`);
      return projectWidePath;
    }

    return null;
  }

  /**
   * Find Python class file by checking imports
   * For example, if we have "from .layer_2 import Service", resolve .layer_2 to find Service
   */
  private async findPythonClassViaImports(
    currentFilePath: string,
    className: string
  ): Promise<string | null> {
    // Get the analysis result (should be cached)
    const cached = this.getCachedAnalysis(currentFilePath);
    if (!cached) return null;

    // Look for imports that import this class
    for (const importInfo of cached.imports) {
      if (importInfo.specifiers.includes(className)) {
        // Found an import for this class, try to resolve the source module
        const resolvedPath = await this.fileProvider.resolveImport(currentFilePath, importInfo.source);
        if (resolvedPath) {
          return resolvedPath;
        }
      }
    }

    return null;
  }

  /**
   * Try to resolve class in the same directory
   */
  private async tryResolveInSameDirectory(
    currentFilePath: string,
    className: string,
    language: string | null
  ): Promise<string | null> {
    // Use path.dirname to handle both forward slashes (Unix) and backslashes (Windows)
    const directory = path.dirname(currentFilePath);

    if (language === 'java') {
      const candidatePath = path.join(directory, `${className}.java`);
      if (await this.fileProvider.exists(candidatePath)) {
        return candidatePath;
      }
    } else if (language === 'python') {
      // Try snake_case conversion
      const snakeCaseName = this.camelToSnakeCase(className);
      const candidatePath1 = path.join(directory, `${snakeCaseName}.py`);
      if (await this.fileProvider.exists(candidatePath1)) {
        return candidatePath1;
      }

      // Try original name (if already snake_case)
      const candidatePath2 = path.join(directory, `${className}.py`);
      if (await this.fileProvider.exists(candidatePath2)) {
        return candidatePath2;
      }

      // Try lowercase
      const candidatePath3 = path.join(directory, `${className.toLowerCase()}.py`);
      if (await this.fileProvider.exists(candidatePath3)) {
        return candidatePath3;
      }
    } else if (language === 'typescript' || language === 'javascript') {
      // Try various TypeScript/JavaScript extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx'];
      for (const ext of extensions) {
        const candidatePath = path.join(directory, `${className}${ext}`);
        if (await this.fileProvider.exists(candidatePath)) {
          return candidatePath;
        }

        // Try lowercase for TypeScript/JavaScript
        const lowerPath = path.join(directory, `${className.toLowerCase()}${ext}`);
        if (await this.fileProvider.exists(lowerPath)) {
          return lowerPath;
        }
      }
    }

    return null;
  }

  /**
   * Search for class file in the entire project using glob patterns
   */
  private async searchClassInProject(
    className: string,
    language: string | null
  ): Promise<string | null> {
    let pattern: string;

    if (language === 'java') {
      pattern = `**/${className}.java`;
    } else if (language === 'python') {
      // Try multiple naming conventions
      const snakeCaseName = this.camelToSnakeCase(className);
      const patterns = [
        `**/${snakeCaseName}.py`,
        `**/${className}.py`,
        `**/${className.toLowerCase()}.py`,
      ];

      for (const p of patterns) {
        const files = await this.fileProvider.listFiles(p);
        if (files.length > 0) {
          // Return the first match (prioritize test-data over other directories)
          return this.selectBestMatch(files);
        }
      }
      return null;
    } else if (language === 'typescript' || language === 'javascript') {
      // Search for TypeScript/JavaScript files
      const patterns = [
        `**/${className}.ts`,
        `**/${className}.tsx`,
        `**/${className}.js`,
        `**/${className}.jsx`,
        `**/${className.toLowerCase()}.ts`,
        `**/${className.toLowerCase()}.tsx`,
      ];

      for (const p of patterns) {
        const files = await this.fileProvider.listFiles(p);
        if (files.length > 0) {
          return this.selectBestMatch(files);
        }
      }
      return null;
    } else {
      // Unknown language, try common extensions
      pattern = `**/${className}.*`;
    }

    const files = await this.fileProvider.listFiles(pattern);
    if (files.length > 0) {
      return this.selectBestMatch(files);
    }

    return null;
  }

  /**
   * Select best match from multiple candidates
   * Prioritize: test-data > src > other
   */
  private selectBestMatch(files: string[]): string {
    if (files.length === 1) {
      return files[0];
    }

    // Prioritize test-data files
    const testDataFiles = files.filter(f => f.includes('test-data'));
    if (testDataFiles.length > 0) {
      return testDataFiles[0];
    }

    // Prioritize src files
    const srcFiles = files.filter(f => f.includes('/src/'));
    if (srcFiles.length > 0) {
      return srcFiles[0];
    }

    // Return first match
    return files[0];
  }

  /**
   * Convert CamelCase to snake_case
   */
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  /**
   * Analyze single file
   */
  private async analyzeFile(filePath: string, depth: number): Promise<FileAnalysisResult> {
    // Check cache
    const cached = this.getCachedAnalysis(filePath);
    if (cached) {
      return { ...cached, depth }; // Update depth
    }

    // Read file content
    const code = await this.fileProvider.readFile(filePath);

    // Parse AST (supports multiple languages)
    const language = LanguageDetector.detectFromFilePath(filePath);
    let ast: UnifiedAST | t.File;
    let imports: ImportInfo[] = [];
    let exports: ExportInfo[] = [];
    let classes: ClassInfo[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Use Babel parser for TypeScript/JavaScript (backward compatible)
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
      });

      // Extract imports
      imports = this.ooAnalyzer.extractImports(ast);

      // Extract exports
      exports = this.ooAnalyzer.extractExports(ast);

      // Extract classes (using traverse)
      traverse(ast, {
        ClassDeclaration: (path: any) => {
          const node = path.node;
          const classInfo = this.extractClassInfo(node);
          if (classInfo) {
            classes.push(classInfo);
          }
        },
        TSInterfaceDeclaration: (path: any) => {
          const node = path.node;
          const interfaceInfo = this.extractInterfaceInfo(node);
          if (interfaceInfo) {
            classes.push(interfaceInfo);
          }
        },
      });
    } else if (language && this.parserService.canParse(filePath)) {
      // Use unified parser for other languages (Java, Python)
      ast = await this.parserService.parse(code, filePath);
      const unifiedAST = ast as UnifiedAST;
      classes = [...unifiedAST.classes];
      // Convert interfaces to ClassInfo format
      for (const iface of unifiedAST.interfaces) {
        classes.push({
          ...iface,
          type: 'class' as const,
          extends: iface.extends && iface.extends.length > 0 ? iface.extends[0] : undefined,
          implements: iface.extends && iface.extends.length > 1 ? iface.extends.slice(1) : undefined,
        });
      }
      imports = unifiedAST.imports;
      exports = unifiedAST.exports;
    } else {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    // Analyze OO relationships
    const ooAnalysis = this.ooAnalyzer.analyze(classes, imports);

    // Build analysis result
    const analysis: FileAnalysisResult = {
      filePath,
      classes,
      imports,
      exports,
      depth,
      relationships: ooAnalysis.relationships,
    };

    // Cache result
    this.cacheAnalysis(filePath, ast, analysis);

    return analysis;
  }

  /**
   * Get analysis result from cache
   *
   * Note: mtime validation removed - adapter layer can handle cache invalidation
   */
  private getCachedAnalysis(filePath: string): FileAnalysisResult | null {
    const cached = this.astCache.get(filePath);
    if (!cached) {
      return null;
    }

    return cached.analysis;
  }

  /**
   * Cache analysis result
   */
  private cacheAnalysis(filePath: string, ast: any, analysis: FileAnalysisResult): void {
    this.astCache.set(filePath, {
      ast,
      analysis,
    });
  }

  /**
   * Get all analyzed files list
   */
  getAnalyzedFiles(): string[] {
    return Array.from(this.astCache.keys());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.astCache.clear();
    this.visited.clear();
  }

  /**
   * Extract class information from AST node
   */
  private extractClassInfo(node: t.ClassDeclaration): ClassInfo | null {
    if (!node.id) {
      return null;
    }

    const className = node.id.name;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];
    let constructorParams: ParameterInfo[] = [];

    // Extract superClass (extends)
    const extendsClass =
      node.superClass && t.isIdentifier(node.superClass) ? node.superClass.name : undefined;

    // Extract implements
    const implementsInterfaces: string[] = [];
    if (node.implements) {
      node.implements.forEach((impl: any) => {
        if (t.isTSExpressionWithTypeArguments(impl) && t.isIdentifier(impl.expression)) {
          implementsInterfaces.push(impl.expression.name);
        }
      });
    }

    // Extract properties and methods
    node.body.body.forEach((member: any) => {
      if (t.isClassProperty(member) && t.isIdentifier(member.key)) {
        const propInfo = this.extractPropertyInfo(member);
        if (propInfo) {
          properties.push(propInfo);
        }
      } else if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
        if (member.kind === 'constructor') {
          // Extract constructor parameters
          constructorParams = member.params.map((param: any) => this.extractParameterInfo(param));
        } else {
          const methodInfo = this.extractMethodInfo(member);
          if (methodInfo) {
            methods.push(methodInfo);
          }
        }
      }
    });

    return {
      name: className,
      type: 'class',
      properties,
      methods,
      extends: extendsClass,
      implements: implementsInterfaces.length > 0 ? implementsInterfaces : undefined,
      isAbstract: node.abstract ?? undefined,
      constructorParams: constructorParams.length > 0 ? constructorParams : undefined,
    };
  }

  /**
   * Extract interface information from AST node
   */
  private extractInterfaceInfo(node: t.TSInterfaceDeclaration): ClassInfo | null {
    const interfaceName = node.id.name;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];

    // Extract extends
    const extendsInterfaces: string[] = [];
    if (node.extends) {
      node.extends.forEach((ext: any) => {
        if (t.isIdentifier(ext.expression)) {
          extendsInterfaces.push(ext.expression.name);
        }
      });
    }

    // Extract properties and methods
    node.body.body.forEach((member: any) => {
      if (t.isTSPropertySignature(member) && t.isIdentifier(member.key)) {
        const propInfo = this.extractPropertySignatureInfo(member);
        if (propInfo) {
          properties.push(propInfo);
        }
      } else if (t.isTSMethodSignature(member) && t.isIdentifier(member.key)) {
        const methodInfo = this.extractMethodSignatureInfo(member);
        if (methodInfo) {
          methods.push(methodInfo);
        }
      }
    });

    return {
      name: interfaceName,
      type: 'interface',
      properties,
      methods,
      implements: extendsInterfaces.length > 0 ? extendsInterfaces : undefined,
    };
  }

  /**
   * Extract property information
   */
  private extractPropertyInfo(member: any): PropertyInfo | null {
    if (!t.isIdentifier(member.key)) {
      return null;
    }

    const name = member.key.name;
    const visibility = this.getVisibility(member);
    const type = member.typeAnnotation
      ? this.getTypeString(member.typeAnnotation.typeAnnotation)
      : undefined;

    return {
      name,
      type,
      visibility,
      isStatic: member.static,
      isReadonly: member.readonly,
    };
  }

  /**
   * Extract property signature information (interface)
   */
  private extractPropertySignatureInfo(member: any): PropertyInfo | null {
    if (!t.isIdentifier(member.key)) {
      return null;
    }

    const name = member.key.name;
    const type = member.typeAnnotation
      ? this.getTypeString(member.typeAnnotation.typeAnnotation)
      : undefined;

    return {
      name,
      type,
      visibility: 'public',
      isOptional: member.optional,
    };
  }

  /**
   * Extract method information
   */
  private extractMethodInfo(member: any): MethodInfo | null {
    if (!t.isIdentifier(member.key)) {
      return null;
    }

    const name = member.key.name;
    const visibility = this.getVisibility(member);
    const parameters = member.params.map((param: any) => this.extractParameterInfo(param));
    const returnType = member.returnType
      ? this.getTypeString(member.returnType.typeAnnotation)
      : undefined;

    return {
      name,
      parameters,
      returnType,
      visibility,
      isStatic: member.static,
      isAbstract: member.abstract,
      isAsync: member.async,
    };
  }

  /**
   * Extract method signature information (interface)
   */
  private extractMethodSignatureInfo(member: any): MethodInfo | null {
    if (!t.isIdentifier(member.key)) {
      return null;
    }

    const name = member.key.name;
    const parameters = member.parameters.map((param: any) => this.extractParameterInfo(param));
    const returnType = member.typeAnnotation
      ? this.getTypeString(member.typeAnnotation.typeAnnotation)
      : undefined;

    return {
      name,
      parameters,
      returnType,
      visibility: 'public',
    };
  }

  /**
   * Extract parameter information
   */
  private extractParameterInfo(param: any): ParameterInfo {
    let name = 'unknown';
    let type: string | undefined;
    let isOptional = false;

    if (t.isIdentifier(param)) {
      name = param.name;
      type =
        param.typeAnnotation && 'typeAnnotation' in param.typeAnnotation
          ? this.getTypeString((param.typeAnnotation as any).typeAnnotation)
          : undefined;
      isOptional = param.optional ?? false;
    } else if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
      name = param.left.name;
      type =
        param.left.typeAnnotation && 'typeAnnotation' in param.left.typeAnnotation
          ? this.getTypeString((param.left.typeAnnotation as any).typeAnnotation)
          : undefined;
      isOptional = true;
    }

    return {
      name,
      type,
      isOptional,
    };
  }

  /**
   * Get visibility modifier
   */
  private getVisibility(member: any): 'public' | 'private' | 'protected' {
    if (member.accessibility) {
      return member.accessibility as 'public' | 'private' | 'protected';
    }
    return 'public';
  }

  /**
   * Get type string
   */
  private getTypeString(typeAnnotation: any): string {
    if (t.isTSStringKeyword(typeAnnotation)) {
      return 'string';
    }
    if (t.isTSNumberKeyword(typeAnnotation)) {
      return 'number';
    }
    if (t.isTSBooleanKeyword(typeAnnotation)) {
      return 'boolean';
    }
    if (t.isTSVoidKeyword(typeAnnotation)) {
      return 'void';
    }
    if (t.isTSAnyKeyword(typeAnnotation)) {
      return 'any';
    }
    if (t.isTSTypeReference(typeAnnotation) && t.isIdentifier(typeAnnotation.typeName)) {
      return typeAnnotation.typeName.name;
    }
    if (t.isTSArrayType(typeAnnotation)) {
      return this.getTypeString(typeAnnotation.elementType) + '[]';
    }
    return 'unknown';
  }
}
