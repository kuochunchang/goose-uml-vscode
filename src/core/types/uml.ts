/**
 * UML diagram type definitions
 * This module contains types for UML diagram generation and storage
 */

import type { ClassInfo, DependencyInfo as ASTDependencyInfo, ImportInfo } from './ast.js';

/**
 * UML diagram type (supported diagram types)
 */
export type DiagramType = 'class' | 'sequence';

/**
 * UML generation mode
 * - 'native': Native TypeScript/JavaScript analysis (no AI)
 */
export type DiagramGenerationMode = 'native';



/**
 * Sequence diagram interaction information
 */
export interface InteractionInfo {
  /** Source participant */
  from: string;

  /** Target participant */
  to: string;

  /** Message/method call description */
  message: string;

  /** Interaction type */
  type: 'sync' | 'async' | 'return';
}

/**
 * Sequence diagram participant information
 */
export interface SequenceInfo {
  /** Participant name (class, object, or actor) */
  participant: string;

  /** All interactions involving this participant */
  interactions: InteractionInfo[];
}

/**
 * Simplified dependency information for UML diagrams
 * Note: For detailed OO relationships, use DependencyInfo from ast.ts
 */
export interface SimpleDependencyInfo {
  /** Source entity */
  from: string;

  /** Target entity */
  to: string;

  /** Dependency type */
  type: 'import' | 'composition' | 'aggregation' | 'usage';
}

/**
 * UML diagram generation result
 */
export interface UMLResult {
  /** Diagram type */
  type: DiagramType;

  /** Generated Mermaid code */
  mermaidCode: string;

  /** Generation mode used */
  generationMode: DiagramGenerationMode;

  /** Optional metadata about the diagram */
  metadata?: {
    /** Classes extracted from code (for class diagrams) */
    classes?: ClassInfo[];

    /** Function names (for flowcharts) */
    functions?: string[];

    /** Dependencies (simplified or full AST dependencies) */
    dependencies?: SimpleDependencyInfo[] | ASTDependencyInfo[];

    /** Sequence diagram information */
    sequences?: SequenceInfo[];

    /** Import statements */
    imports?: ImportInfo[];

    /** Reason for fallback to AI mode (if applicable) */
    fallbackReason?: string;

    /** Whether the diagram was auto-fixed */
    autoFixed?: boolean;

    /** Additional metadata */
    [key: string]: unknown;
  };
}

/**
 * UML diagrams storage for a file
 * Stores different types of UML diagrams
 */
export interface UMLDiagrams {
  /** Class diagram */
  class?: UMLResult;



  /** Sequence diagram */
  sequence?: UMLResult;

  /** Dependency diagram */
  dependency?: UMLResult;
}
