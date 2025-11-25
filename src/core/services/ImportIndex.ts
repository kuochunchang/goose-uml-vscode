import { LanguageDetector } from "../parsers/common/index.js";
import { IFileProvider, SupportedLanguage } from "../types/index.js";
import { ParserService } from "./ParserService.js";

/**
 * Import index configuration
 */
export interface ImportIndexOptions {
  /**
   * Root directory to scan
   * @default workspace root
   */
  rootDir?: string;

  /**
   * File patterns to include (glob)
   * @default ['**\/*.{ts,tsx,js,jsx,java,py}']
   */
  includePatterns?: string[];

  /**
   * File patterns to exclude (glob)
   * @default Language-specific defaults
   */
  excludePatterns?: string[];

  /**
   * Maximum number of files to index
   * @default 10000
   */
  maxFiles?: number;
}

/**
 * Language-specific default exclude patterns
 */
const DEFAULT_EXCLUDE_PATTERNS: Record<SupportedLanguage, string[]> = {
  typescript: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/out/**",
    "**/*.min.js",
    "**/*.bundle.js",
    "**/.vscode/**",
    "**/.git/**",
  ],
  javascript: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/out/**",
    "**/*.min.js",
    "**/*.bundle.js",
    "**/.vscode/**",
    "**/.git/**",
  ],
  java: [
    "**/target/**",
    "**/build/**",
    "**/.gradle/**",
    "**/.idea/**",
    "**/*.class",
    "**/.git/**",
  ],
  python: [
    "**/__pycache__/**",
    "**/*.pyc",
    "**/.pytest_cache/**",
    "**/venv/**",
    "**/env/**",
    "**/.venv/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
  ],
  go: ["**/vendor/**", "**/.git/**", "**/bin/**", "**/pkg/**", "**/.vscode/**"],
};

/**
 * ImportIndex - Fast class-to-file resolution
 *
 * Purpose:
 * - Build className → filePaths mapping once
 * - O(1) lookup instead of O(N) glob search
 * - Avoid repeated workspace scans
 *
 * Lifecycle:
 * - Created per UML generation session
 * - Disposed after analysis completes
 * - No persistent state between sessions
 *
 * Design decision:
 * - Short-lived cache (per-session) ensures correctness
 * - No file watching needed - rebuild on next generation
 */
export class ImportIndex {
  private index: Map<string, string[]> = new Map();
  private parserService: ParserService;
  private builtAt: number = 0;

  constructor(private readonly fileProvider: IFileProvider) {
    this.parserService = ParserService.getInstance();
  }

  /**
   * Build index by scanning workspace
   *
   * Performance:
   * - ~1-2 seconds for 1000 files
   * - ~10-20 seconds for 10000 files
   *
   * @param options - Index configuration
   */
  async buildIndex(options: ImportIndexOptions = {}): Promise<void> {
    const startTime = Date.now();

    // Determine file patterns
    const includePatterns = options.includePatterns || [
      "**/*.{ts,tsx,js,jsx,java,py}",
    ];

    // Get all candidate files
    const allFiles: string[] = [];
    for (const pattern of includePatterns) {
      const files = await this.fileProvider.listFiles(pattern);
      allFiles.push(...files);
    }

    // Apply exclude patterns
    const excludePatterns =
      options.excludePatterns || this.getDefaultExcludePatterns();
    const filteredFiles = this.filterFiles(allFiles, excludePatterns);

    // Limit file count
    const maxFiles = options.maxFiles || 10000;
    if (filteredFiles.length > maxFiles) {
      console.warn(
        `[ImportIndex] Found ${filteredFiles.length} files, limiting to ${maxFiles}`,
      );
      filteredFiles.splice(maxFiles);
    }

    console.log(
      `[ImportIndex] Indexing ${filteredFiles.length} files (excluded ${allFiles.length - filteredFiles.length} files)...`,
    );

    // Build index
    let indexedFiles = 0;
    let indexedClasses = 0;

    for (const filePath of filteredFiles) {
      try {
        const classNames = await this.extractClassNames(filePath);

        if (classNames.length > 0) {
          indexedFiles++;

          for (const className of classNames) {
            if (!this.index.has(className)) {
              this.index.set(className, []);
            }

            // Avoid duplicate file paths
            const existingPaths = this.index.get(className)!;
            if (!existingPaths.includes(filePath)) {
              existingPaths.push(filePath);
              indexedClasses++;
            }
          }
        }
      } catch (error) {
        // Skip files that fail to parse
        console.debug(`[ImportIndex] Failed to parse ${filePath}:`, error);
      }
    }

    this.builtAt = Date.now();
    const duration = this.builtAt - startTime;

    console.log(
      `[ImportIndex] Built index in ${duration}ms: ${indexedFiles} files, ${indexedClasses} class mappings`,
    );
  }

  /**
   * Resolve class name to file paths
   *
   * @param className - Class or interface name
   * @returns Array of file paths containing this class (empty if not found)
   */
  resolve(className: string): string[] {
    return this.index.get(className) || [];
  }

  /**
   * Get all indexed class names
   */
  getAllClassNames(): string[] {
    return Array.from(this.index.keys());
  }

  /**
   * Get index statistics
   */
  getStats(): {
    classCount: number;
    fileCount: number;
    builtAt: string;
  } {
    return {
      classCount: this.index.size,
      fileCount: new Set(Array.from(this.index.values()).flat()).size,
      builtAt: new Date(this.builtAt).toISOString(),
    };
  }

  /**
   * Clear index (for testing or manual refresh)
   */
  clear(): void {
    this.index.clear();
    this.builtAt = 0;
  }

  // Private helper methods

  /**
   * Extract class/interface names from a file
   */
  private async extractClassNames(filePath: string): Promise<string[]> {
    const classNames: string[] = [];

    try {
      // Read file
      const code = await this.fileProvider.readFile(filePath);

      // Detect language
      const language = LanguageDetector.detectFromFilePath(filePath);

      // Parse and extract class names using simple regex for performance
      if (language === "typescript" || language === "javascript") {
        classNames.push(...this.extractTypeScriptClasses(code));
      } else if (language === "java") {
        classNames.push(...this.extractJavaClasses(code));
      } else if (language === "python") {
        classNames.push(...this.extractPythonClasses(code));
      }
    } catch {
      // Return empty array on parse errors
      return [];
    }

    return classNames;
  }

  /**
   * Extract class names from TypeScript/JavaScript code
   * Using simple regex for performance (no full AST parsing)
   */
  private extractTypeScriptClasses(code: string): string[] {
    const classNames: string[] = [];

    // Match: class ClassName, interface InterfaceName, type TypeName
    const patterns = [
      /(?:export\s+)?(?:abstract\s+)?class\s+([A-Z][a-zA-Z0-9_]*)/g,
      /(?:export\s+)?interface\s+([A-Z][a-zA-Z0-9_]*)/g,
      /(?:export\s+)?type\s+([A-Z][a-zA-Z0-9_]*)\s*=/g,
      /(?:export\s+)?enum\s+([A-Z][a-zA-Z0-9_]*)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const className = match[1];
        if (className && !classNames.includes(className)) {
          classNames.push(className);
        }
      }
    }

    return classNames;
  }

  /**
   * Extract class names from Java code
   * Using simple regex for performance
   */
  private extractJavaClasses(code: string): string[] {
    const classNames: string[] = [];

    // Match: public class ClassName, interface InterfaceName, enum EnumName
    const patterns = [
      /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+([A-Z][a-zA-Z0-9_]*)/g,
      /(?:public\s+)?interface\s+([A-Z][a-zA-Z0-9_]*)/g,
      /(?:public\s+)?enum\s+([A-Z][a-zA-Z0-9_]*)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const className = match[1];
        if (className && !classNames.includes(className)) {
          classNames.push(className);
        }
      }
    }

    return classNames;
  }

  /**
   * Extract class names from Python code
   * Using simple regex for performance
   */
  private extractPythonClasses(code: string): string[] {
    const classNames: string[] = [];

    // Match: class ClassName: or class ClassName(BaseClass):
    const pattern = /^class\s+([A-Z][a-zA-Z0-9_]*)/gm;

    let match;
    while ((match = pattern.exec(code)) !== null) {
      const className = match[1];
      if (className && !classNames.includes(className)) {
        classNames.push(className);
      }
    }

    return classNames;
  }

  /**
   * Filter files by exclude patterns
   */
  private filterFiles(files: string[], excludePatterns: string[]): string[] {
    if (excludePatterns.length === 0) {
      return files;
    }

    // Convert glob patterns to regex
    const regexPatterns = excludePatterns.map((pattern) => {
      const regexStr = pattern
        .replace(/\\/g, "/")
        // Escape special regex characters except wildcards
        .replace(/\./g, "\\.")
        .replace(/\+/g, "\\+")
        .replace(/\?/g, "\\?")
        .replace(/\|/g, "\\|")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/\^/g, "\\^")
        .replace(/\$/g, "\\$")
        // Convert wildcards to regex
        .replace(/\*\*/g, "<<<DOUBLESTAR>>>") // Temporary placeholder
        .replace(/\*/g, "[^/]*") // Single * = match within path segment
        .replace(/<<<DOUBLESTAR>>>/g, ".*"); // ** = match across path segments

      return new RegExp(regexStr);
    });

    return files.filter((file) => {
      const normalizedPath = file.replace(/\\/g, "/");
      return !regexPatterns.some((regex) => regex.test(normalizedPath));
    });
  }

  /**
   * Get default exclude patterns for detected languages
   */
  private getDefaultExcludePatterns(): string[] {
    // Combine exclude patterns from all languages
    const allPatterns = new Set<string>();

    for (const language of Object.keys(
      DEFAULT_EXCLUDE_PATTERNS,
    ) as SupportedLanguage[]) {
      for (const pattern of DEFAULT_EXCLUDE_PATTERNS[language]) {
        allPatterns.add(pattern);
      }
    }

    return Array.from(allPatterns);
  }
}
