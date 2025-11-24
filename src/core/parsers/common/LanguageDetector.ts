/**
 * @code-review-goose/analysis-parser-common
 * Language detection utilities
 */

import type { SupportedLanguage } from '../../types/index.js';

/**
 * Language detector - detects programming language from file path
 * 
 * @example
 * ```typescript
 * const language = LanguageDetector.detectFromFilePath('src/App.tsx');
 * // Returns: 'typescript'
 * 
 * const isSupported = LanguageDetector.isSupported('example.java');
 * // Returns: true
 * ```
 */
export class LanguageDetector {
  /**
   * File extension to language mapping
   */
  private static readonly EXTENSION_MAP: Record<string, SupportedLanguage> = {
    // TypeScript
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',

    // JavaScript
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',

    // Java
    '.java': 'java',

    // Python
    '.py': 'python',
    '.pyi': 'python',
    '.pyw': 'python',

    // Go
    '.go': 'go',
  };

  /**
   * Detect language from file path
   * 
   * @param filePath - File path (can be absolute or relative)
   * @returns Detected language or null if unsupported
   * 
   * @example
   * ```typescript
   * LanguageDetector.detectFromFilePath('/path/to/file.ts')  // 'typescript'
   * LanguageDetector.detectFromFilePath('App.java')          // 'java'
   * LanguageDetector.detectFromFilePath('main.py')           // 'python'
   * LanguageDetector.detectFromFilePath('unknown.txt')       // null
   * ```
   */
  static detectFromFilePath(filePath: string): SupportedLanguage | null {
    // Handle file:// URI format from VS Code
    let normalizedPath = filePath;
    if (filePath.startsWith('file://')) {
      try {
        const url = new URL(filePath);
        normalizedPath = url.pathname;
        // On Windows, remove leading slash from pathname (e.g., /C:/path -> C:/path)
        if (process.platform === 'win32' && normalizedPath.match(/^\/[A-Z]:/)) {
          normalizedPath = normalizedPath.substring(1);
        }
      } catch {
        // If URL parsing fails, try simple string replacement
        normalizedPath = filePath.replace(/^file:\/\//, '');
      }
    }
    
    const ext = this.extractExtension(normalizedPath);
    return ext ? this.EXTENSION_MAP[ext] || null : null;
  }

  /**
   * Get all supported file extensions for a language
   * 
   * @param language - Language identifier
   * @returns Array of file extensions (with leading dot)
   * 
   * @example
   * ```typescript
   * LanguageDetector.getExtensions('typescript')
   * // Returns: ['.ts', '.tsx', '.mts', '.cts']
   * 
   * LanguageDetector.getExtensions('python')
   * // Returns: ['.py', '.pyi', '.pyw']
   * ```
   */
  static getExtensions(language: SupportedLanguage): string[] {
    return Object.entries(this.EXTENSION_MAP)
      .filter(([, lang]) => lang === language)
      .map(([ext]) => ext);
  }

  /**
   * Check if a file path is supported
   * 
   * @param filePath - File path to check
   * @returns true if language is supported
   * 
   * @example
   * ```typescript
   * LanguageDetector.isSupported('example.ts')   // true
   * LanguageDetector.isSupported('example.py')   // true
   * LanguageDetector.isSupported('example.txt')  // false
   * ```
   */
  static isSupported(filePath: string): boolean {
    return this.detectFromFilePath(filePath) !== null;
  }

  /**
   * Get all supported languages
   * 
   * @returns Array of supported language identifiers
   * 
   * @example
   * ```typescript
   * LanguageDetector.getSupportedLanguages()
   * // Returns: ['typescript', 'javascript', 'java', 'python', 'go']
   * ```
   */
  static getSupportedLanguages(): SupportedLanguage[] {
    const languages = new Set(Object.values(this.EXTENSION_MAP));
    return Array.from(languages);
  }

  /**
   * Get extension map for testing or inspection
   * 
   * @returns Copy of the extension map
   * @internal
   */
  static getExtensionMap(): Record<string, SupportedLanguage> {
    return { ...this.EXTENSION_MAP };
  }

  /**
   * Extract file extension from path
   * 
   * @param filePath - File path
   * @returns File extension (lowercase, with leading dot) or null
   * @private
   */
  private static extractExtension(filePath: string): string | null {
    const match = filePath.toLowerCase().match(/\.[^./\\]+$/);
    return match ? match[0] : null;
  }

  /**
   * Detect language from file content (heuristic-based)
   * 
   * This is a fallback method when file extension is ambiguous or missing.
   * Currently not implemented - returns null.
   * 
   * @param content - File content
   * @returns Detected language or null
   * @experimental
   */
  static detectFromContent(_content: string): SupportedLanguage | null {
    // TODO: Implement content-based detection using heuristics
    // - Check for shebang (#!/usr/bin/python, #!/usr/bin/env node)
    // - Check for language-specific patterns (import, package, def, class)
    // - Use ML-based detection for high accuracy
    return null;
  }
}
