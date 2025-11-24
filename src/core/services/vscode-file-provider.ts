/**
 * VS Code implementation of IFileProvider interface
 * Uses vscode.workspace.fs for file system operations
 */

import * as vscode from 'vscode';
import type { IFileProvider } from '../types/index.js';

/**
 * VSCodeFileProvider
 * Implements IFileProvider interface using VS Code Workspace APIs
 *
 * Features:
 * - Async file reading with UTF-8 encoding
 * - Path resolution with extension inference
 * - Glob pattern matching using VS Code APIs
 * - Workspace boundary validation
 */
export class VSCodeFileProvider implements IFileProvider {
  private readonly workspaceUri: vscode.Uri;
  private readonly extensions = ['.ts', '.tsx', '.js', '.jsx', '.java', '.py'];

  /**
   * @param workspaceUri - Workspace root URI for all file operations
   */
  constructor(workspaceUri: vscode.Uri) {
    this.workspaceUri = workspaceUri;
  }

  /**
   * Read file content as UTF-8 string
   * @throws Error if file does not exist or cannot be read
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const uri = this.resolveUri(filePath);

      // Validate file is within workspace boundary
      if (!this.isWithinWorkspace(uri)) {
        throw new Error(`File path is outside workspace boundary: ${filePath}`);
      }

      // Check if file exists
      const fileType = await this.getFileType(uri);
      if (fileType === null) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      if (fileType !== vscode.FileType.File) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Read file content
      const contentBytes = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder('utf-8').decode(contentBytes);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Resolve import statement to absolute file path
   * Handles multiple language import formats:
   * - TypeScript/JavaScript: relative paths (./utils, ../models/User)
   * - Java: fully qualified class names (com.example.User)
   * - Python: module paths (models.user)
   *
   * @param from - Source file path (importer)
   * @param to - Import specifier
   * @returns Resolved absolute path, or null if cannot be resolved
   */
  async resolveImport(from: string, to: string): Promise<string | null> {
    try {
      // Validate from file exists
      const fromUri = this.resolveUri(from);
      if (!(await this.exists(from))) {
        console.warn(`[VSCodeFileProvider] Source file does not exist: ${from}`);
        return null;
      }

      // Detect language from source file
      const language = this.detectLanguage(from);

      console.debug(
        `[VSCodeFileProvider] Resolving import: language="${language}", from="${from}", to="${to}"`
      );

      let targetUri: vscode.Uri | null = null;

      switch (language) {
        case 'typescript':
        case 'javascript':
          targetUri = await this.resolveTypeScriptImport(fromUri, to);
          break;
        case 'java':
          targetUri = await this.resolveJavaImport(to);
          break;
        case 'python':
          targetUri = await this.resolvePythonImport(fromUri, to);
          break;
        default:
          console.warn(`[VSCodeFileProvider] Unsupported language: ${language}`);
          return null;
      }

      if (targetUri) {
        console.debug(`[VSCodeFileProvider] Import resolved: ${targetUri.fsPath}`);
        return targetUri.fsPath;
      } else {
        console.warn(
          `[VSCodeFileProvider] Failed to resolve import: from="${from}", to="${to}"`
        );
        return null;
      }
    } catch (error) {
      console.error(
        `[VSCodeFileProvider] Error resolving import: from="${from}", to="${to}"`,
        error
      );
      return null;
    }
  }

  /**
   * List files matching a glob pattern
   * @param pattern - Glob pattern (e.g., '**\/*.ts', 'src/**\/*.{ts,tsx}')
   * @returns Array of absolute file paths
   */
  async listFiles(pattern: string): Promise<string[]> {
    try {
      // Convert the pattern to a RelativePattern based on workspace
      const relativePattern = new vscode.RelativePattern(this.workspaceUri, pattern);

      // Use VS Code's findFiles API
      const uris = await vscode.workspace.findFiles(
        relativePattern,
        '**/node_modules/**' // Exclude node_modules
      );

      // Filter to ensure all files are within workspace boundary
      return uris
        .filter((uri) => this.isWithinWorkspace(uri))
        .map((uri) => uri.fsPath);
    } catch (error) {
      console.error(`Failed to list files with pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Check if a file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const uri = this.resolveUri(filePath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve path relative to workspace root
   * If already absolute URI, validates it's within workspace
   */
  private resolveUri(filePath: string): vscode.Uri {
    // If already a URI, parse it
    if (filePath.startsWith('file://')) {
      return vscode.Uri.parse(filePath);
    }

    // If absolute path, create URI from file system path
    if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
      return vscode.Uri.file(filePath);
    }

    // Relative path - resolve from workspace root
    return vscode.Uri.joinPath(this.workspaceUri, filePath);
  }

  /**
   * Get directory URI from file URI
   */
  private getDirectoryUri(fileUri: vscode.Uri): vscode.Uri {
    const pathParts = fileUri.path.split('/');
    pathParts.pop(); // Remove file name
    return fileUri.with({ path: pathParts.join('/') });
  }

  /**
   * Check if path is a relative import (./ or ../)
   */
  private isRelativePath(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../');
  }

  /**
   * Validate that file URI is within workspace boundary
   * Prevents path traversal attacks
   */
  private isWithinWorkspace(uri: vscode.Uri): boolean {
    try {
      const workspacePath = this.workspaceUri.fsPath.toLowerCase();
      const filePath = uri.fsPath.toLowerCase();

      // Normalize paths for comparison
      const normalizedWorkspace = workspacePath.endsWith('/') || workspacePath.endsWith('\\')
        ? workspacePath
        : workspacePath + '/';

      const normalizedFile = filePath.endsWith('/') || filePath.endsWith('\\')
        ? filePath
        : filePath + '/';

      // Check if file path starts with workspace path
      return normalizedFile.startsWith(normalizedWorkspace) || filePath === workspacePath;
    } catch {
      return false;
    }
  }

  /**
   * Resolve file URI with extension inference and index file resolution
   *
   * Tries in order:
   * 1. Exact path (if has extension)
   * 2. Path + supported extensions (.ts, .tsx, .js, .jsx)
   * 3. Path as directory with index file
   *
   * @param baseUri - Base URI without extension
   * @returns Resolved file URI or null if not found
   */
  private async resolveFile(baseUri: vscode.Uri): Promise<vscode.Uri | null> {
    // 1. If path already has extension and exists, return it
    const hasExtension = this.extensions.some((ext) => baseUri.path.endsWith(ext));
    if (hasExtension && (await this.fileExists(baseUri))) {
      return baseUri;
    }

    // 2. Try adding various extensions
    for (const ext of this.extensions) {
      const uriWithExt = baseUri.with({ path: baseUri.path + ext });
      if (await this.fileExists(uriWithExt)) {
        return uriWithExt;
      }
    }

    // 3. Try as directory with index file
    if (await this.directoryExists(baseUri)) {
      for (const ext of this.extensions) {
        const indexUri = vscode.Uri.joinPath(baseUri, `index${ext}`);
        if (await this.fileExists(indexUri)) {
          return indexUri;
        }
      }
    }

    // 4. Cannot resolve
    return null;
  }

  /**
   * Get file type from URI (File, Directory, or null if not exists)
   */
  private async getFileType(uri: vscode.Uri): Promise<vscode.FileType | null> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type;
    } catch {
      return null;
    }
  }

  /**
   * Check if URI exists and is a file
   */
  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    const fileType = await this.getFileType(uri);
    return fileType === vscode.FileType.File;
  }

  /**
   * Check if URI exists and is a directory
   */
  private async directoryExists(uri: vscode.Uri): Promise<boolean> {
    const fileType = await this.getFileType(uri);
    return fileType === vscode.FileType.Directory;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): 'typescript' | 'javascript' | 'java' | 'python' | null {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.tsx')) {
      return 'typescript';
    }
    if (lowerPath.endsWith('.js') || lowerPath.endsWith('.jsx')) {
      return 'javascript';
    }
    if (lowerPath.endsWith('.java')) {
      return 'java';
    }
    if (lowerPath.endsWith('.py') || lowerPath.endsWith('.pyi') || lowerPath.endsWith('.pyw')) {
      return 'python';
    }
    return null;
  }

  /**
   * Resolve TypeScript/JavaScript import (relative paths)
   * Example: './utils', '../models/User'
   */
  private async resolveTypeScriptImport(fromUri: vscode.Uri, importPath: string): Promise<vscode.Uri | null> {
    // Only handle relative imports (not node_modules)
    if (!this.isRelativePath(importPath)) {
      console.debug(`[VSCodeFileProvider] Skipping non-relative import: ${importPath}`);
      return null;
    }

    // Calculate target path
    const fromDir = this.getDirectoryUri(fromUri);
    const targetUri = vscode.Uri.joinPath(fromDir, importPath);

    // Validate within workspace boundary
    if (!this.isWithinWorkspace(targetUri)) {
      console.warn(`[VSCodeFileProvider] Import target outside workspace: ${targetUri.fsPath}`);
      return null;
    }

    // Try to resolve the file with various extensions and index files
    return await this.resolveFile(targetUri);
  }

  /**
   * Resolve Java import (fully qualified class name)
   * Example: 'com.example.multilayer.Service' -> 'test-data/java/multi_layer/Service.java'
   * 
   * Java import resolution strategy:
   * 1. Convert package.ClassName to package/ClassName.java
   * 2. Search for the file in common source directories (src/main/java, src, .)
   * 3. Fall back to workspace-wide search if direct resolution fails
   */
  private async resolveJavaImport(importPath: string): Promise<vscode.Uri | null> {
    // Skip wildcard imports (com.example.*)
    if (importPath.endsWith('.*')) {
      console.debug(`[VSCodeFileProvider] Skipping wildcard import: ${importPath}`);
      return null;
    }

    // Skip standard library and common framework imports
    if (this.isJavaStandardLibrary(importPath)) {
      console.debug(`[VSCodeFileProvider] Skipping standard library import: ${importPath}`);
      return null;
    }

    // Convert package.ClassName to package/ClassName.java
    const relativePath = importPath.replace(/\./g, '/') + '.java';

    // Common Java source directories to try
    const sourceDirs = [
      'src/main/java',
      'src',
      'test-data/java',
      'test-data/java/multi_layer',
      'test-data/java/features',
      'test-data/java/relationships',
      '.',
    ];

    // Try each source directory
    for (const sourceDir of sourceDirs) {
      const candidateUri = vscode.Uri.joinPath(this.workspaceUri, sourceDir, relativePath);
      
      if (this.isWithinWorkspace(candidateUri) && await this.fileExists(candidateUri)) {
        console.debug(`[VSCodeFileProvider] Resolved Java import: ${importPath} -> ${candidateUri.fsPath}`);
        return candidateUri;
      }
    }

    // Fall back to workspace-wide search by class name
    const className = importPath.split('.').pop();
    if (className) {
      const pattern = `**/${className}.java`;
      const matchingFiles = await this.listFiles(pattern);
      
      if (matchingFiles.length > 0) {
        // Return the first match (could be improved with better heuristics)
        const resolvedUri = vscode.Uri.file(matchingFiles[0]);
        console.debug(`[VSCodeFileProvider] Resolved Java import via search: ${importPath} -> ${resolvedUri.fsPath}`);
        return resolvedUri;
      }
    }

    console.warn(`[VSCodeFileProvider] Failed to resolve Java import: ${importPath}`);
    return null;
  }

  /**
   * Check if import is from Java standard library or common frameworks
   */
  private isJavaStandardLibrary(importPath: string): boolean {
    const standardPrefixes = [
      'java.',
      'javax.',
      'jakarta.',
      'org.springframework.',
      'org.hibernate.',
      'com.google.common.',
    ];
    
    return standardPrefixes.some(prefix => importPath.startsWith(prefix));
  }

  /**
   * Resolve Python import (module path)
   * Example: 'models.user' -> 'models/user.py' or 'models/user/__init__.py'
   * 
   * Python import resolution strategy:
   * 1. For relative imports (from . or from ..), resolve from current directory
   * 2. For absolute imports, search from workspace root and common source directories
   */
  private async resolvePythonImport(fromUri: vscode.Uri, importPath: string): Promise<vscode.Uri | null> {
    // Handle relative imports (. or ..)
    if (importPath.startsWith('.')) {
      return await this.resolvePythonRelativeImport(fromUri, importPath);
    }

    // Skip standard library imports
    if (this.isPythonStandardLibrary(importPath)) {
      console.debug(`[VSCodeFileProvider] Skipping standard library import: ${importPath}`);
      return null;
    }

    // Convert module.path to module/path
    const relativePath = importPath.replace(/\./g, '/');

    // Common Python source directories
    const sourceDirs = [
      'src',
      'test-data/python',
      'test-data/python/multi_layer',
      'test-data/python/features',
      'test-data/python/relationships',
      '.',
    ];

    // Try each source directory
    for (const sourceDir of sourceDirs) {
      // Try as a module file (module/path.py)
      const moduleFileUri = vscode.Uri.joinPath(this.workspaceUri, sourceDir, relativePath + '.py');
      if (this.isWithinWorkspace(moduleFileUri) && await this.fileExists(moduleFileUri)) {
        console.debug(`[VSCodeFileProvider] Resolved Python import: ${importPath} -> ${moduleFileUri.fsPath}`);
        return moduleFileUri;
      }

      // Try as a package (__init__.py)
      const packageUri = vscode.Uri.joinPath(this.workspaceUri, sourceDir, relativePath, '__init__.py');
      if (this.isWithinWorkspace(packageUri) && await this.fileExists(packageUri)) {
        console.debug(`[VSCodeFileProvider] Resolved Python import: ${importPath} -> ${packageUri.fsPath}`);
        return packageUri;
      }
    }

    // Fall back to workspace-wide search
    const moduleName = importPath.split('.').pop();
    if (moduleName) {
      const pattern = `**/${moduleName}.py`;
      const matchingFiles = await this.listFiles(pattern);
      
      if (matchingFiles.length > 0) {
        const resolvedUri = vscode.Uri.file(matchingFiles[0]);
        console.debug(`[VSCodeFileProvider] Resolved Python import via search: ${importPath} -> ${resolvedUri.fsPath}`);
        return resolvedUri;
      }
    }

    console.warn(`[VSCodeFileProvider] Failed to resolve Python import: ${importPath}`);
    return null;
  }

  /**
   * Resolve Python relative import (from . or from ..)
   */
  private async resolvePythonRelativeImport(fromUri: vscode.Uri, importPath: string): Promise<vscode.Uri | null> {
    // Count leading dots
    const dotMatch = importPath.match(/^\.+/);
    if (!dotMatch) return null;

    const dotCount = dotMatch[0].length;
    const modulePath = importPath.substring(dotCount);

    // Navigate up the directory tree
    let currentDir = this.getDirectoryUri(fromUri);
    for (let i = 1; i < dotCount; i++) {
      currentDir = this.getDirectoryUri(currentDir);
    }

    // Convert remaining module path
    const relativePath = modulePath ? modulePath.replace(/\./g, '/') : '';

    // Try as module file
    if (relativePath) {
      const moduleFileUri = vscode.Uri.joinPath(currentDir, relativePath + '.py');
      if (this.isWithinWorkspace(moduleFileUri) && await this.fileExists(moduleFileUri)) {
        return moduleFileUri;
      }

      // Try as package
      const packageUri = vscode.Uri.joinPath(currentDir, relativePath, '__init__.py');
      if (this.isWithinWorkspace(packageUri) && await this.fileExists(packageUri)) {
        return packageUri;
      }
    }

    return null;
  }

  /**
   * Check if import is from Python standard library
   */
  private isPythonStandardLibrary(importPath: string): boolean {
    const standardModules = [
      'os', 'sys', 'json', 'math', 'random', 'datetime', 'time', 'collections',
      'itertools', 're', 'unittest', 'typing', 'pathlib', 'functools', 'io',
      'logging', 'argparse', 'subprocess', 'threading', 'multiprocessing',
    ];
    
    const rootModule = importPath.split('.')[0];
    return standardModules.includes(rootModule);
  }
}
