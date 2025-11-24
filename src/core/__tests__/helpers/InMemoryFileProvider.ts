import { IFileProvider } from '../../types/providers.js';
import * as path from 'path';

/**
 * In-memory file provider for testing
 * Simulates a file system using a Map<path, content>
 */
export class InMemoryFileProvider implements IFileProvider {
  private files: Map<string, string> = new Map();

  /**
   * Create provider with initial file contents
   * @param files - Map of file paths to contents
   */
  constructor(files: Record<string, string> = {}) {
    for (const [filePath, content] of Object.entries(files)) {
      this.files.set(this.normalizePath(filePath), content);
    }
  }

  /**
   * Add or update a file
   */
  addFile(filePath: string, content: string): void {
    this.files.set(this.normalizePath(filePath), content);
  }

  /**
   * Remove a file
   */
  removeFile(filePath: string): void {
    this.files.delete(this.normalizePath(filePath));
  }

  /**
   * Clear all files
   */
  clear(): void {
    this.files.clear();
  }

  /**
   * Get all file paths
   */
  getAllPaths(): string[] {
    return Array.from(this.files.keys());
  }

  // IFileProvider implementation

  async readFile(filePath: string): Promise<string> {
    const normalized = this.normalizePath(filePath);
    const content = this.files.get(normalized);

    if (content === undefined) {
      throw new Error(`File not found: ${filePath}`);
    }

    return content;
  }

  async resolveImport(from: string, to: string): Promise<string | null> {
    // Handle relative imports
    if (to.startsWith('./') || to.startsWith('../')) {
      const fromDir = path.dirname(this.normalizePath(from));
      const resolved = path.join(fromDir, to);

      // Try different extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.java', '.py'];
      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (await this.exists(fullPath)) {
          return fullPath;
        }
      }

      return null;
    }

    // Absolute or module imports - return null for simplicity
    return null;
  }

  async listFiles(pattern: string): Promise<string[]> {
    // Simple glob matching (just wildcard support for testing)
    const allPaths = Array.from(this.files.keys());

    // Convert glob pattern to regex
    // **/*.ts -> match all .ts files
    // **/*.{ts,tsx} -> match .ts or .tsx files
    // src/**/*.java -> match all .java files in src directory
    let regexPattern = pattern
      .replace(/\\/g, '/')
      // Handle brace expansion FIRST: {ts,tsx} -> (ts|tsx)
      .replace(/\{([^}]+)\}/g, (_, p1) => `(${p1.replace(/,/g, '|')})`)
      // Replace ** before single * to avoid conflicts
      .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
      // Escape dots
      .replace(/\./g, '\\.')
      // Replace single * (matches within path segment)
      .replace(/\*/g, '[^/]*')
      // Replace ** (matches across path segments)
      .replace(/<<<DOUBLESTAR>>>/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);

    return allPaths.filter(p => regex.test(p.replace(/\\/g, '/')));
  }

  async exists(filePath: string): Promise<boolean> {
    return this.files.has(this.normalizePath(filePath));
  }

  // Helper methods

  /**
   * Normalize path to use forward slashes and remove trailing slashes
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/\/$/, '');
  }
}
