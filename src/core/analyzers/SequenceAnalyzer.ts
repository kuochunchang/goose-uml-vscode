/**
 * Sequence Analysis Service
 * Analyzes class interactions and method calls for sequence diagrams
 * Participants are classes/objects, messages are method calls
 *
 * This analyzer is platform-agnostic and works with parsed AST data.
 *
 * NOTE: This file only contains type definitions for sequence analysis.
 * The actual implementation has been migrated to UnifiedSequenceAnalyzer
 * which uses tree-sitter AST instead of Babel AST.
 */

/**
 * Represents a participant in the sequence diagram (class, function, or module)
 */
export interface SequenceParticipant {
  name: string;
  type: "class" | "function" | "module"; // Classes are objects, function is for top-level functions, module is fallback
  lineNumber?: number;
}

/**
 * Represents an interaction/message in the sequence diagram
 */
export interface SequenceInteraction {
  from: string; // Calling class/module
  to: string; // Called class/module
  message: string; // Method name with arguments
  type: "sync" | "async" | "return";
  lineNumber?: number;
}

/**
 * Result of sequence analysis
 */
export interface SequenceAnalysisResult {
  participants: SequenceParticipant[];
  interactions: SequenceInteraction[];
  entryPoints: string[]; // Entry point methods
}

