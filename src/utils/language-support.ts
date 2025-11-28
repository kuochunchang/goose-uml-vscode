/**
 * Language support utilities for VS Code extension
 * Centralized language detection and validation
 */

/**
 * Supported language IDs in VS Code
 */
export const SUPPORTED_LANGUAGE_IDS = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
  "java",
  "python",
] as const;



export type SupportedLanguageId = (typeof SUPPORTED_LANGUAGE_IDS)[number];

// Re-export for convenience (used in other files)
export type { SupportedLanguage } from "../core/types/index.js";

/**
 * Check if a language ID is supported
 */
export function isSupportedLanguage(languageId: string): boolean {
  return SUPPORTED_LANGUAGE_IDS.includes(languageId as SupportedLanguageId);
}

/**
 * Get user-friendly language name
 */
export function getLanguageName(languageId: string): string {
  const languageMap: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    typescriptreact: "TypeScript React",
    javascriptreact: "JavaScript React",
    java: "Java",
    python: "Python",
  };
  return languageMap[languageId] || languageId;
}

/**
 * Get supported languages for error messages
 */
export function getSupportedLanguagesList(): string {
  return "TypeScript, JavaScript, Java, and Python";
}

/**
 * Check if diagram type is supported for a language
 */
export function isDiagramTypeSupported(
  languageId: string,
  diagramType: "class" | "sequence",
): boolean {
  // Class diagrams are supported for all languages
  if (diagramType === "class") {
    return isSupportedLanguage(languageId);
  }

  // Sequence diagrams are currently only supported for TS/JS
  if (diagramType === "sequence") {
    return [
      "typescript",
      "javascript",
      "typescriptreact",
      "javascriptreact",
    ].includes(languageId);
  }

  return false;
}

/**
 * Get error message for unsupported diagram type
 */
export function getUnsupportedDiagramTypeMessage(
  languageId: string,
  diagramType: "class" | "sequence",
): string {
  const languageName = getLanguageName(languageId);
  if (diagramType === "sequence") {
    return `${diagramType} diagrams are currently only supported for TypeScript/JavaScript files. ${languageName} support is planned for future releases.`;
  }
  return `${diagramType} diagrams are not supported for ${languageName} files.`;
}
