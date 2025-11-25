/**
 * Unified AST model for multi-language support
 * This module defines language-agnostic AST structures for code analysis
 */

/**
 * Supported programming languages
 */
export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "java"
  | "python"
  | "go";

/**
 * Import statement information
 */
export interface ImportInfo {
  /** Source module path (e.g., './utils', 'react', 'java.util.List') */
  source: string;

  /** Imported symbols (e.g., ['useState', 'useEffect']) */
  specifiers: string[];

  /** Whether this is a default import */
  isDefault: boolean;

  /** Whether this is a namespace import (import * as foo) */
  isNamespace: boolean;

  /** Namespace alias if applicable (e.g., 'React' in 'import * as React') */
  namespaceAlias?: string;

  /** Whether this is a dynamic import (import() or require()) */
  isDynamic: boolean;

  /** Line number in source file */
  lineNumber: number;

  /** Import type (type-only import in TypeScript) */
  isTypeOnly?: boolean;
}

/**
 * Export statement information
 */
export interface ExportInfo {
  /** Exported symbol name */
  name: string;

  /** Whether this is a default export */
  isDefault: boolean;

  /** Whether this is a re-export from another module */
  isReExport: boolean;

  /** Source module if re-exporting */
  source?: string;

  /** Export type (class, function, variable, interface, type) */
  exportType:
    | "class"
    | "function"
    | "variable"
    | "interface"
    | "type"
    | "const"
    | "enum";

  /** Line number in source file */
  lineNumber: number;

  /** Visibility modifier (for languages like Java) */
  visibility?: "public" | "protected" | "private" | "internal";
}

/**
 * Object-oriented relationship types following UML standards
 */
export type OORelationshipType =
  | "inheritance" // extends (solid line with hollow arrow)
  | "realization" // implements (dashed line with hollow arrow)
  | "composition" // strong ownership (solid diamond ◆)
  | "aggregation" // weak ownership (hollow diamond ◇)
  | "dependency" // uses/depends on (dashed arrow)
  | "association" // references (solid arrow)
  | "injection"; // dependency injection (special dependency)

/**
 * UML multiplicity/cardinality
 */
export type Cardinality = "1" | "0..1" | "1..*" | "*" | "0..*";

/**
 * Dependency/relationship information between classes
 */
export interface DependencyInfo {
  /** Source class/entity */
  from: string;

  /** Target class/entity */
  to: string;

  /** Relationship type */
  type: OORelationshipType;

  /** UML cardinality (e.g., '1', '0..1', '1..*', '*') */
  cardinality?: Cardinality;

  /** Line number where relationship is defined */
  lineNumber: number;

  /** Additional context (e.g., property name, method name) */
  context?: string;

  /** Whether the target type is from an external module */
  isExternal?: boolean;

  /** Source module of the target type if external */
  sourceModule?: string;
}

/**
 * Property/field information with enhanced type details
 */
export interface PropertyInfo {
  /** Property name */
  name: string;

  /** Type annotation (string representation) */
  type?: string;

  /** Visibility modifier */
  visibility: "public" | "private" | "protected";

  /** Whether this is a static property */
  isStatic?: boolean;

  /** Whether this is readonly/final */
  isReadonly?: boolean;

  /** Whether this is optional (TypeScript) */
  isOptional?: boolean;

  /** Line number */
  lineNumber?: number;

  /** Whether the type is an array/collection */
  isArray?: boolean;

  /** Whether the type is a class (for composition/aggregation analysis) */
  isClassType?: boolean;

  /** Resolved type information (for OO analysis) */
  resolvedType?: ResolvedTypeInfo;
}

/**
 * Method/function parameter information
 */
export interface ParameterInfo {
  /** Parameter name */
  name: string;

  /** Type annotation */
  type?: string;

  /** Whether this is optional */
  isOptional?: boolean;

  /** Default value if any */
  defaultValue?: string;

  /** Resolved type information */
  resolvedType?: ResolvedTypeInfo;
}

/**
 * Method/function information with enhanced type details
 */
export interface MethodInfo {
  /** Method name */
  name: string;

  /** Parameters */
  parameters: ParameterInfo[];

  /** Return type */
  returnType?: string;

  /** Visibility modifier */
  visibility: "public" | "private" | "protected";

  /** Whether this is a static method */
  isStatic?: boolean;

  /** Whether this is abstract */
  isAbstract?: boolean;

  /** Whether this is async */
  isAsync?: boolean;

  /** Line number */
  lineNumber?: number;

  /** Resolved return type information */
  resolvedReturnType?: ResolvedTypeInfo;
}

/**
 * Resolved type information for dependency analysis
 */
export interface ResolvedTypeInfo {
  /** Base type name (e.g., 'Engine', 'Person') */
  typeName: string;

  /** Whether this is an array/collection type */
  isArray: boolean;

  /** Whether this is a primitive type */
  isPrimitive: boolean;

  /** Whether this is a class type */
  isClassType: boolean;

  /** Whether this is an interface type */
  isInterfaceType: boolean;

  /** Whether this is from an external module */
  isExternal: boolean;

  /** Source module if external */
  sourceModule?: string;

  /** Generic type arguments if applicable (e.g., Array<Person> -> ['Person']) */
  genericArgs?: string[];
}

/**
 * Class information with enhanced OO analysis support
 */
export interface ClassInfo {
  /** Class name */
  name: string;

  /** Type: class or interface */
  type: "class" | "interface";

  /** Properties/fields */
  properties: PropertyInfo[];

  /** Methods */
  methods: MethodInfo[];

  /** Parent class (extends) */
  extends?: string;

  /** Implemented interfaces */
  implements?: string[];

  /** Whether this is abstract */
  isAbstract?: boolean;

  /** Line number */
  lineNumber?: number;

  /** Constructor parameters (for dependency injection analysis) */
  constructorParams?: ParameterInfo[];
}

/**
 * Interface information
 */
export interface InterfaceInfo {
  name: string;
  type: "interface";
  properties: PropertyInfo[];
  methods: MethodInfo[];
  /** Extended interfaces */
  extends?: string[];
  lineNumber?: number;
}

/**
 * Function/method declaration (for functional programming)
 */
export interface FunctionInfo {
  /** Function name */
  name: string;

  /** Parameters */
  parameters: ParameterInfo[];

  /** Return type */
  returnType: string;

  /** Whether this is exported */
  isExported: boolean;

  /** Whether this is async */
  isAsync?: boolean;

  /** Line number */
  lineNumber?: number;
}

/**
 * Unified AST model - language-agnostic representation
 */
export interface UnifiedAST {
  /** Source language */
  language: SupportedLanguage;

  /** File path */
  filePath: string;

  /** All import statements */
  imports: ImportInfo[];

  /** All export statements */
  exports: ExportInfo[];

  /** All classes */
  classes: ClassInfo[];

  /** All interfaces */
  interfaces: InterfaceInfo[];

  /** All functions (top-level) */
  functions: FunctionInfo[];

  /** All OO relationships (inheritance, composition, etc.) */
  dependencies: DependencyInfo[];

  /** Original AST (language-specific, for advanced use cases) */
  originalAST?: unknown;
}

/**
 * AST cache entry
 */
export interface ASTCacheEntry {
  /** File path */
  filePath: string;

  /** SHA256 hash of file content */
  codeHash: string;

  /** Unified AST */
  ast: UnifiedAST;

  /** Timestamp when cached */
  timestamp: number;

  /** File size in bytes */
  fileSize: number;
}

/**
 * OO analysis result
 */
export interface OOAnalysisResult {
  /** All detected relationships */
  relationships: DependencyInfo[];

  /** Inheritance hierarchy */
  inheritanceTree: Map<string, string[]>;

  /** Composition relationships */
  compositions: DependencyInfo[];

  /** Aggregation relationships */
  aggregations: DependencyInfo[];

  /** Dependency relationships */
  dependencies: DependencyInfo[];

  /** Association relationships */
  associations: DependencyInfo[];

  /** Dependency injection patterns */
  injections: DependencyInfo[];
}

/**
 * Cross-file analysis options
 */
export interface CrossFileAnalysisOptions {
  /** Maximum depth to traverse (1-10) */
  depth: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  /** Whether to include external types (e.g., from node_modules) */
  includeExternalTypes?: boolean;

  /** Ignore patterns for file scanning (glob patterns) */
  ignorePatterns?: string[];
}

/**
 * File analysis result - single file with its parsed content
 */
export interface FileAnalysisResult {
  /** Absolute file path */
  filePath: string;

  /** Parsed classes from this file */
  classes: ClassInfo[];

  /** Import statements */
  imports: ImportInfo[];

  /** Export statements */
  exports: ExportInfo[];

  /** Depth from the original file (0 = original file, 1 = direct dependency, etc.) */
  depth: number;

  /** OO relationships detected in this file */
  relationships: DependencyInfo[];
}

/**
 * Bidirectional analysis result - combines forward and reverse dependencies
 */
export interface BidirectionalAnalysisResult {
  /** The target file being analyzed */
  targetFile: string;

  /** Forward dependencies (files that targetFile imports) */
  forwardDeps: FileAnalysisResult[];

  /** Reverse dependencies (files that import targetFile) */
  reverseDeps: FileAnalysisResult[];

  /** All classes from all analyzed files (deduplicated) */
  allClasses: ClassInfo[];

  /** All relationships from all analyzed files (deduplicated) */
  relationships: DependencyInfo[];

  /** Statistics */
  stats: {
    totalFiles: number;
    totalClasses: number;
    totalRelationships: number;
    maxDepth: number;
  };
}

/**
 * Import index for fast reverse dependency lookup
 */
export interface ImportIndex {
  /** Map from file path to array of files it imports */
  fileToImports: Map<string, string[]>;

  /** Reverse index: map from file path to array of files that import it */
  importToFiles: Map<string, string[]>;

  /** Timestamp when index was built */
  timestamp: number;

  /** Number of files indexed */
  fileCount: number;
}

/**
 * Import index builder options
 */
export interface ImportIndexOptions {
  /** Project root path */
  projectPath: string;

  /** File extensions to include */
  extensions?: string[];

  /** Ignore patterns (glob) */
  ignorePatterns?: string[];

  /** Maximum number of files to scan */
  maxFiles?: number;

  /** Concurrency limit for parallel file processing */
  concurrency?: number;
}

/**
 * Cross-file dependency graph
 */
export interface CrossFileDependencyGraph {
  /** Nodes: file path -> classes in that file */
  nodes: Map<string, ClassInfo[]>;

  /** Edges: dependency relationships between files */
  edges: Array<{
    from: string; // file path
    to: string; // file path
    dependencies: DependencyInfo[]; // specific class relationships
  }>;

  /** Entry point file */
  entryPoint: string;

  /** Maximum depth reached */
  maxDepth: number;
}
