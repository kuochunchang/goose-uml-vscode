/**
 * Object-Oriented Analysis Service
 * Analyzes OO relationships: inheritance, composition, aggregation, dependency, association, injection
 *
 * This analyzer is platform-agnostic and works with parsed AST data.
 */

import * as t from '@babel/types';
import type {
  ImportInfo,
  ExportInfo,
  DependencyInfo,
  ResolvedTypeInfo,
  ClassInfo,
  OOAnalysisResult,
} from '../types/index.js';

/**
 * OO Analysis Service for extracting object-oriented relationships
 */
export class OOAnalyzer {
  /**
   * Extract all import statements from AST
   */
  extractImports(ast: t.File): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const getLineNumber = (node: t.Node): number => {
      return node.loc?.start.line ?? 0;
    };

    // Traverse AST for import declarations
    const traverseNode = (node: t.Node) => {
      if (t.isImportDeclaration(node)) {
        const source = node.source.value;
        const specifiers: string[] = [];
        let isDefault = false;
        let isNamespace = false;
        let namespaceAlias: string | undefined;
        const isTypeOnly = node.importKind === 'type';

        node.specifiers.forEach((spec) => {
          if (t.isImportDefaultSpecifier(spec)) {
            isDefault = true;
            specifiers.push(spec.local.name);
          } else if (t.isImportNamespaceSpecifier(spec)) {
            isNamespace = true;
            namespaceAlias = spec.local.name;
            specifiers.push(spec.local.name);
          } else if (t.isImportSpecifier(spec)) {
            if (t.isIdentifier(spec.imported)) {
              specifiers.push(spec.imported.name);
            }
          }
        });

        imports.push({
          source,
          specifiers,
          isDefault,
          isNamespace,
          namespaceAlias,
          isDynamic: false,
          lineNumber: getLineNumber(node),
          isTypeOnly,
        });
      }

      // Handle dynamic imports: import('module')
      if (t.isCallExpression(node) && t.isImport(node.callee)) {
        if (t.isStringLiteral(node.arguments[0])) {
          imports.push({
            source: node.arguments[0].value,
            specifiers: [],
            isDefault: false,
            isNamespace: false,
            isDynamic: true,
            lineNumber: getLineNumber(node),
          });
        }
      }

      // Handle require() calls
      if (
        t.isCallExpression(node) &&
        t.isIdentifier(node.callee) &&
        node.callee.name === 'require'
      ) {
        if (t.isStringLiteral(node.arguments[0])) {
          imports.push({
            source: node.arguments[0].value,
            specifiers: [],
            isDefault: true,
            isNamespace: false,
            isDynamic: true,
            lineNumber: getLineNumber(node),
          });
        }
      }

      // Recursively traverse child nodes
      for (const key in node) {
        const child = (node as any)[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach((c) => {
              if (c && typeof c.type === 'string') {
                traverseNode(c);
              }
            });
          } else if (child.type) {
            traverseNode(child);
          }
        }
      }
    };

    traverseNode(ast.program);
    return imports;
  }

  /**
   * Extract all export statements from AST
   */
  extractExports(ast: t.File): ExportInfo[] {
    const exports: ExportInfo[] = [];

    const getLineNumber = (node: t.Node): number => {
      return node.loc?.start.line ?? 0;
    };

    const traverseNode = (node: t.Node) => {
      // Default export
      if (t.isExportDefaultDeclaration(node)) {
        let name = 'default';
        let exportType: ExportInfo['exportType'] = 'variable';

        const decl = node.declaration;
        if (t.isClassDeclaration(decl) && decl.id) {
          name = decl.id.name;
          exportType = 'class';
        } else if (t.isFunctionDeclaration(decl) && decl.id) {
          name = decl.id.name;
          exportType = 'function';
        }
        // Note: TSInterfaceDeclaration cannot be default exported in TypeScript

        exports.push({
          name,
          isDefault: true,
          isReExport: false,
          exportType,
          lineNumber: getLineNumber(node),
          visibility: 'public',
        });
      }

      // Named exports
      if (t.isExportNamedDeclaration(node)) {
        const isReExport = !!node.source;
        const source = node.source?.value;

        // export { foo, bar }
        if (node.specifiers.length > 0) {
          node.specifiers.forEach((spec) => {
            if (t.isExportSpecifier(spec)) {
              const name = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;

              exports.push({
                name,
                isDefault: false,
                isReExport,
                source,
                exportType: 'variable',
                lineNumber: getLineNumber(node),
                visibility: 'public',
              });
            }
          });
        }

        // export const/let/var
        if (node.declaration) {
          const decl = node.declaration;
          if (t.isVariableDeclaration(decl)) {
            decl.declarations.forEach((varDecl) => {
              if (t.isIdentifier(varDecl.id)) {
                exports.push({
                  name: varDecl.id.name,
                  isDefault: false,
                  isReExport: false,
                  exportType: decl.kind === 'const' ? 'const' : 'variable',
                  lineNumber: getLineNumber(node),
                  visibility: 'public',
                });
              }
            });
          }

          // export class
          if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
            exports.push({
              name: node.declaration.id.name,
              isDefault: false,
              isReExport: false,
              exportType: 'class',
              lineNumber: getLineNumber(node),
              visibility: 'public',
            });
          }

          // export function
          if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
            exports.push({
              name: node.declaration.id.name,
              isDefault: false,
              isReExport: false,
              exportType: 'function',
              lineNumber: getLineNumber(node),
              visibility: 'public',
            });
          }

          // export interface
          if (t.isTSInterfaceDeclaration(node.declaration)) {
            exports.push({
              name: node.declaration.id.name,
              isDefault: false,
              isReExport: false,
              exportType: 'interface',
              lineNumber: getLineNumber(node),
              visibility: 'public',
            });
          }

          // export type
          if (t.isTSTypeAliasDeclaration(node.declaration)) {
            exports.push({
              name: node.declaration.id.name,
              isDefault: false,
              isReExport: false,
              exportType: 'type',
              lineNumber: getLineNumber(node),
              visibility: 'public',
            });
          }

          // export enum
          if (t.isTSEnumDeclaration(node.declaration)) {
            exports.push({
              name: node.declaration.id.name,
              isDefault: false,
              isReExport: false,
              exportType: 'enum',
              lineNumber: getLineNumber(node),
              visibility: 'public',
            });
          }
        }
      }

      // export * from 'module'
      if (t.isExportAllDeclaration(node)) {
        exports.push({
          name: '*',
          isDefault: false,
          isReExport: true,
          source: node.source.value,
          exportType: 'variable',
          lineNumber: getLineNumber(node),
          visibility: 'public',
        });
      }

      // Recursively traverse child nodes
      for (const key in node) {
        const child = (node as any)[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach((c) => {
              if (c && typeof c.type === 'string') {
                traverseNode(c);
              }
            });
          } else if (child.type) {
            traverseNode(child);
          }
        }
      }
    };

    traverseNode(ast.program);
    return exports;
  }

  /**
   * Resolve type information from type annotation
   */
  resolveTypeInfo(
    typeAnnotation: string | undefined,
    imports: ImportInfo[]
  ): ResolvedTypeInfo | undefined {
    if (!typeAnnotation || typeAnnotation === 'any' || typeAnnotation === 'unknown') {
      return undefined;
    }

    const primitiveTypes = [
      'string',
      'number',
      'boolean',
      'null',
      'undefined',
      'void',
      'never',
      'bigint',
      'symbol',
    ];

    const builtInTypes = [
      'Array',
      'Map',
      'Set',
      'WeakMap',
      'WeakSet',
      'Promise',
      'Date',
      'RegExp',
      'Error',
    ];

    // Check if it's an array type
    const isArray =
      typeAnnotation.endsWith('[]') ||
      typeAnnotation.startsWith('Array<') ||
      typeAnnotation === 'Array';

    // Extract base type name
    let typeName = typeAnnotation.replace(/\[\]/g, '').trim();

    // Handle generic types like Array<Person>
    const genericMatch = typeName.match(/^(\w+)<(.+)>$/);
    let genericArgs: string[] | undefined;

    if (genericMatch) {
      typeName = genericMatch[1];
      genericArgs = genericMatch[2].split(',').map((arg) => arg.trim());
    }

    const isPrimitive = primitiveTypes.includes(typeName.toLowerCase());
    const isBuiltIn = builtInTypes.includes(typeName);
    const isClassType = !isPrimitive && !isBuiltIn && typeName[0] === typeName[0].toUpperCase();
    const isInterfaceType =
      !isPrimitive &&
      !isBuiltIn &&
      typeName.startsWith('I') &&
      typeName[1] === typeName[1].toUpperCase();

    // Check if type is imported
    const importedFrom = imports.find((imp) => imp.specifiers.includes(typeName));
    const isExternal = !!importedFrom;
    const sourceModule = importedFrom?.source;

    return {
      typeName,
      isArray,
      isPrimitive,
      isClassType,
      isInterfaceType,
      isExternal,
      sourceModule,
      genericArgs,
    };
  }

  /**
   * Extract composition relationships (strong ownership, solid diamond ◆)
   * A owns B, B's lifecycle is controlled by A
   * 
   * Composition is detected when:
   * - Property is private (Java/C# style: strong encapsulation)
   * - OR property is an instance variable (non-static, typically initialized in constructor)
   * - AND property type is a class (not primitive or built-in)
   * - AND property is not an array (arrays are typically aggregation)
   * 
   * Examples:
   * - Java: class Car { private Engine engine; } -> composition
   * - Python: class Car { def __init__(self): self.engine = Engine() } -> composition
   * - TypeScript: class Car { private engine: Engine; } -> composition
   */
  extractComposition(classes: ClassInfo[], imports: ImportInfo[]): DependencyInfo[] {
    const compositions: DependencyInfo[] = [];

    for (const cls of classes) {
      for (const prop of cls.properties) {
        const resolvedType = this.resolveTypeInfo(prop.type, imports);

        if (
          resolvedType &&
          resolvedType.isClassType &&
          !resolvedType.isPrimitive &&
          !resolvedType.isArray && // Arrays are typically aggregation, not composition
          // Composition if: private (strong encapsulation) OR instance variable (non-static)
          (prop.visibility === 'private' || !prop.isStatic)
        ) {
          compositions.push({
            from: cls.name,
            to: resolvedType.typeName,
            type: 'composition',
            cardinality: '1',
            lineNumber: prop.lineNumber ?? 0,
            context: prop.name,
            isExternal: resolvedType.isExternal,
            sourceModule: resolvedType.sourceModule,
          });
        }
      }
    }

    return compositions;
  }

  /**
   * Extract aggregation relationships (weak ownership, hollow diamond ◇)
   * A uses B, but B can exist independently
   * 
   * Aggregation is detected when:
   * - Property type is an array/collection of a class type
   * - Arrays/collections typically represent "has many" relationships (aggregation)
   * - Visibility can be any (private arrays are still aggregation, not composition)
   * 
   * Examples:
   * - Java: private List<Wheel> wheels; -> aggregation
   * - TypeScript: private wheels: Wheel[]; -> aggregation
   * - Python: self.wheels = [Wheel() for _ in range(4)] -> aggregation
   */
  extractAggregation(classes: ClassInfo[], imports: ImportInfo[]): DependencyInfo[] {
    const aggregations: DependencyInfo[] = [];

    for (const cls of classes) {
      for (const prop of cls.properties) {
        const resolvedType = this.resolveTypeInfo(prop.type, imports);

        if (
          resolvedType &&
          resolvedType.isClassType &&
          !resolvedType.isPrimitive &&
          resolvedType.isArray // Arrays/collections are aggregation
        ) {
          aggregations.push({
            from: cls.name,
            to: resolvedType.typeName,
            type: 'aggregation',
            cardinality: '*',
            lineNumber: prop.lineNumber ?? 0,
            context: prop.name,
            isExternal: resolvedType.isExternal,
            sourceModule: resolvedType.sourceModule,
          });
        }
      }
    }

    return aggregations;
  }

  /**
   * Extract dependency relationships (uses/depends on, dashed arrow)
   * Method uses other class as parameter or return type
   * Example: processData(input: DataModel): Result
   */
  extractDependency(classes: ClassInfo[], imports: ImportInfo[]): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];

    for (const cls of classes) {
      for (const method of cls.methods) {
        // Check parameters
        for (const param of method.parameters) {
          const resolvedType = this.resolveTypeInfo(param.type, imports);

          if (resolvedType && resolvedType.isClassType && !resolvedType.isPrimitive) {
            dependencies.push({
              from: cls.name,
              to: resolvedType.typeName,
              type: 'dependency',
              lineNumber: method.lineNumber ?? 0,
              context: `${method.name}(${param.name})`,
              isExternal: resolvedType.isExternal,
              sourceModule: resolvedType.sourceModule,
            });
          }
        }

        // Check return type
        const returnTypeResolved = this.resolveTypeInfo(method.returnType, imports);

        if (
          returnTypeResolved &&
          returnTypeResolved.isClassType &&
          !returnTypeResolved.isPrimitive
        ) {
          dependencies.push({
            from: cls.name,
            to: returnTypeResolved.typeName,
            type: 'dependency',
            lineNumber: method.lineNumber ?? 0,
            context: `${method.name}() returns ${returnTypeResolved.typeName}`,
            isExternal: returnTypeResolved.isExternal,
            sourceModule: returnTypeResolved.sourceModule,
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Extract association relationships (references, solid arrow)
   * A uses/references B
   * Example: class User { public profile: Profile }
   */
  extractAssociation(classes: ClassInfo[], imports: ImportInfo[]): DependencyInfo[] {
    const associations: DependencyInfo[] = [];

    for (const cls of classes) {
      for (const prop of cls.properties) {
        const resolvedType = this.resolveTypeInfo(prop.type, imports);

        if (
          resolvedType &&
          resolvedType.isClassType &&
          !resolvedType.isPrimitive &&
          prop.visibility === 'public' &&
          !resolvedType.isArray
        ) {
          associations.push({
            from: cls.name,
            to: resolvedType.typeName,
            type: 'association',
            cardinality: '1',
            lineNumber: prop.lineNumber ?? 0,
            context: prop.name,
            isExternal: resolvedType.isExternal,
            sourceModule: resolvedType.sourceModule,
          });
        }
      }
    }

    return associations;
  }

  /**
   * Extract dependency injection patterns (constructor injection)
   * Example: constructor(private service: UserService)
   */
  extractDependencyInjection(classes: ClassInfo[], imports: ImportInfo[]): DependencyInfo[] {
    const injections: DependencyInfo[] = [];

    for (const cls of classes) {
      if (cls.constructorParams) {
        for (const param of cls.constructorParams) {
          const resolvedType = this.resolveTypeInfo(param.type, imports);

          if (resolvedType && resolvedType.isClassType && !resolvedType.isPrimitive) {
            injections.push({
              from: cls.name,
              to: resolvedType.typeName,
              type: 'injection',
              lineNumber: cls.lineNumber ?? 0,
              context: `constructor(${param.name})`,
              isExternal: resolvedType.isExternal,
              sourceModule: resolvedType.sourceModule,
            });
          }
        }
      }
    }

    return injections;
  }

  /**
   * Analyze all OO relationships in the code
   */
  analyze(classes: ClassInfo[], imports: ImportInfo[]): OOAnalysisResult {
    const compositions = this.extractComposition(classes, imports);
    const aggregations = this.extractAggregation(classes, imports);
    const dependencies = this.extractDependency(classes, imports);
    const associations = this.extractAssociation(classes, imports);
    const injections = this.extractDependencyInjection(classes, imports);

    const relationships: DependencyInfo[] = [
      ...compositions,
      ...aggregations,
      ...dependencies,
      ...associations,
      ...injections,
    ];

    // Build inheritance tree
    const inheritanceTree = new Map<string, string[]>();
    for (const cls of classes) {
      if (cls.extends) {
        if (!inheritanceTree.has(cls.extends)) {
          inheritanceTree.set(cls.extends, []);
        }
        inheritanceTree.get(cls.extends)!.push(cls.name);
      }
    }

    return {
      relationships,
      inheritanceTree,
      compositions,
      aggregations,
      dependencies,
      associations,
      injections,
    };
  }
}
