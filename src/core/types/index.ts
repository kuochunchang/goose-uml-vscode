/**
 * @code-review-goose/analysis-types
 * Shared type definitions for code analysis - zero dependencies
 *
 * This package provides platform-agnostic type definitions for code analysis,
 * enabling dependency inversion and multi-platform support (Node.js, VS Code, Browser).
 *
 * @packageDocumentation
 */

// ============================================================================
// Provider Interfaces (Dependency Inversion)
// ============================================================================
export type { IFileProvider, ICacheProvider } from './providers.js';

// ============================================================================
// AST Types (Abstract Syntax Tree)
// ============================================================================
export type {
  // Language support
  SupportedLanguage,
  // Import/Export
  ImportInfo,
  ExportInfo,
  // Object-Oriented relationships
  OORelationshipType,
  Cardinality,
  DependencyInfo,
  // Class structure
  PropertyInfo,
  ParameterInfo,
  MethodInfo,
  ResolvedTypeInfo,
  ClassInfo,
  InterfaceInfo,
  FunctionInfo,
  // Unified AST
  UnifiedAST,
  ASTCacheEntry,
  // Analysis results
  OOAnalysisResult,
  CrossFileAnalysisOptions,
  FileAnalysisResult,
  BidirectionalAnalysisResult,
  // Import index
  ImportIndex,
  ImportIndexOptions,
  CrossFileDependencyGraph,
} from './ast.js';

// ============================================================================
// UML Types (Diagram Generation)
// ============================================================================
export type {
  // Diagram types
  DiagramType,
  DiagramGenerationMode,

  // Sequence diagram
  InteractionInfo,
  SequenceInfo,
  // Dependencies
  SimpleDependencyInfo,
  // Results
  UMLResult,
  UMLDiagrams,
} from './uml.js';
