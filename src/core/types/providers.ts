/**
 * File system and cache provider interfaces for platform-agnostic analysis
 * These interfaces enable dependency inversion, allowing the core analysis engine
 * to work across different platforms (Node.js, VS Code, Browser)
 */

/**
 * File system abstraction interface
 * Implementations:
 * - NodeFileProvider: Uses fs-extra for Node.js/CLI
 * - VSCodeFileProvider: Uses vscode.workspace.fs for VS Code extension
 * - BrowserFileProvider: Uses virtual file system for browser environments
 */
export interface IFileProvider {
  /**
   * Read file content as string
   * @param path - Absolute or relative file path
   * @returns File content as UTF-8 string
   * @throws Error if file does not exist or cannot be read
   */
  readFile(path: string): Promise<string>;

  /**
   * Resolve import statement to absolute file path
   * @param from - Source file path (importer)
   * @param to - Import specifier (e.g., './utils', '@/components/Button')
   * @returns Resolved absolute path, or null if cannot be resolved
   * @example
   * resolveImport('/src/app.ts', './utils') -> '/src/utils.ts'
   * resolveImport('/src/app.ts', '@/components/Button') -> '/src/components/Button.tsx'
   */
  resolveImport(from: string, to: string): Promise<string | null>;

  /**
   * List files matching a glob pattern
   * @param pattern - Glob pattern (e.g., '**\/*.ts', 'src/**\/*.{ts,tsx}')
   * @returns Array of absolute file paths
   */
  listFiles(pattern: string): Promise<string[]>;

  /**
   * Check if a file or directory exists
   * @param path - File or directory path
   * @returns True if exists, false otherwise
   */
  exists(path: string): Promise<boolean>;
}

/**
 * Cache provider abstraction interface (optional)
 * Allows caching of analysis results for performance optimization
 * Implementations:
 * - MemoryCacheProvider: In-memory cache (default)
 * - FileCacheProvider: File-based cache for persistence
 * - RedisCacheProvider: Redis-based cache for distributed systems
 */
export interface ICacheProvider {
  /**
   * Retrieve cached value by key
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store value in cache
   * @param key - Cache key
   * @param value - Value to cache (must be JSON-serializable)
   * @param ttl - Time-to-live in milliseconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Remove value from cache
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cached values
   */
  clear(): Promise<void>;
}
