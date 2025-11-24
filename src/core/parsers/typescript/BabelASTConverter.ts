/**
 * @code-review-goose/analysis-parser-typescript
 * Babel AST to UnifiedAST converter
 */

import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type {
  UnifiedAST,
  ClassInfo,
  InterfaceInfo,
  FunctionInfo,
  ImportInfo,
  ExportInfo,
  PropertyInfo,
  MethodInfo,
  ParameterInfo,
} from '../../types/index.js';

// Correct way to import @babel/traverse
const traverse = (traverseModule as any).default || traverseModule;

/**
 * Converts Babel AST to UnifiedAST
 */
export class BabelASTConverter {
  /**
   * Convert Babel AST to UnifiedAST
   */
  convert(ast: t.File, filePath: string): UnifiedAST {
    const classes: ClassInfo[] = [];
    const interfaces: InterfaceInfo[] = [];
    const functions: FunctionInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];

    // Traverse AST to extract all information
    traverse(ast, {
      // Extract classes
      ClassDeclaration: (path: NodePath<t.ClassDeclaration>) => {
        const classInfo = this.extractClassInfo(path.node);
        if (classInfo) {
          classes.push(classInfo);
        }
      },

      // Extract interfaces
      TSInterfaceDeclaration: (path: NodePath<t.TSInterfaceDeclaration>) => {
        const interfaceInfo = this.extractInterfaceInfo(path.node);
        if (interfaceInfo) {
          interfaces.push(interfaceInfo);
        }
      },

      // Extract functions
      FunctionDeclaration: (path: NodePath<t.FunctionDeclaration>) => {
        const functionInfo = this.extractFunctionInfo(path.node);
        if (functionInfo) {
          functions.push(functionInfo);
        }
      },

      // Extract imports
      ImportDeclaration: (path: NodePath<t.ImportDeclaration>) => {
        const importInfo = this.extractImportInfo(path.node);
        if (importInfo) {
          imports.push(importInfo);
        }
      },

      // Extract exports
      ExportNamedDeclaration: (path: NodePath<t.ExportNamedDeclaration>) => {
        const exportInfos = this.extractNamedExports(path.node);
        exports.push(...exportInfos);
      },

      ExportDefaultDeclaration: (path: NodePath<t.ExportDefaultDeclaration>) => {
        const exportInfo = this.extractDefaultExport(path.node);
        if (exportInfo) {
          exports.push(exportInfo);
        }
      },
    });

    // Detect language from file path
    const language = this.detectLanguage(filePath);

    return {
      language,
      filePath,
      classes,
      interfaces,
      functions,
      imports,
      exports,
      dependencies: [], // Will be populated by OOAnalyzer
    };
  }

  /**
   * Extract class information from Babel AST node
   */
  private extractClassInfo(node: t.ClassDeclaration): ClassInfo | null {
    if (!node.id) return null;

    const className = node.id.name;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];
    let constructorParams: ParameterInfo[] | undefined;

    // Extract inheritance relationship
    let extendsClass: string | undefined;
    if (node.superClass && t.isIdentifier(node.superClass)) {
      extendsClass = node.superClass.name;
    }

    // Extract implemented interfaces
    const implementsInterfaces: string[] = [];
    if (node.implements) {
      node.implements.forEach((impl) => {
        if (t.isTSExpressionWithTypeArguments(impl) && t.isIdentifier(impl.expression)) {
          implementsInterfaces.push(impl.expression.name);
        }
      });
    }

    // Traverse class members
    node.body.body.forEach((member) => {
      if (t.isClassProperty(member)) {
        const prop = this.extractProperty(member);
        if (prop) properties.push(prop);
      } else if (t.isClassMethod(member)) {
        const method = this.extractMethod(member);
        if (method) {
          methods.push(method);
          // Extract constructor parameters
          if (method.name === 'constructor') {
            constructorParams = method.parameters;
          }
        }
      }
    });

    return {
      name: className,
      type: 'class',
      properties,
      methods,
      extends: extendsClass,
      implements: implementsInterfaces.length > 0 ? implementsInterfaces : undefined,
      lineNumber: node.loc?.start.line,
      constructorParams,
    };
  }

  /**
   * Extract interface information from Babel AST node
   */
  private extractInterfaceInfo(node: t.TSInterfaceDeclaration): InterfaceInfo {
    const interfaceName = node.id.name;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];

    // Extract extended interfaces
    const extendsInterfaces: string[] = [];
    if (node.extends) {
      node.extends.forEach((ext) => {
        if (t.isIdentifier(ext.expression)) {
          extendsInterfaces.push(ext.expression.name);
        }
      });
    }

    // Traverse interface members
    node.body.body.forEach((member) => {
      if (t.isTSPropertySignature(member)) {
        if (t.isIdentifier(member.key)) {
          properties.push({
            name: member.key.name,
            type: this.getTypeAnnotation(member.typeAnnotation),
            visibility: 'public',
          });
        }
      } else if (t.isTSMethodSignature(member)) {
        if (t.isIdentifier(member.key)) {
          methods.push({
            name: member.key.name,
            parameters: this.extractParameters(member.parameters as any),
            returnType: this.getTypeAnnotation(member.typeAnnotation),
            visibility: 'public',
          });
        }
      }
    });

    return {
      name: interfaceName,
      type: 'interface',
      properties,
      methods,
      extends: extendsInterfaces.length > 0 ? extendsInterfaces : undefined,
    };
  }

  /**
   * Extract function information
   */
  private extractFunctionInfo(node: t.FunctionDeclaration): FunctionInfo | null {
    if (!node.id) return null;

    const returnType = this.getTypeAnnotation(node.returnType);
    return {
      name: node.id.name,
      parameters: this.extractParameters(node.params),
      returnType: returnType || 'void',
      isExported: false, // Will be determined during export extraction
      lineNumber: node.loc?.start.line,
    };
  }

  /**
   * Extract property information
   */
  private extractProperty(node: t.ClassProperty): PropertyInfo | null {
    if (!t.isIdentifier(node.key)) return null;

    const typeStr = this.getTypeAnnotation(node.typeAnnotation);
    const isArray = typeStr
      ? typeStr.endsWith('[]') || typeStr.startsWith('Array<') || typeStr === 'Array'
      : false;
    const isClassType = typeStr ? this.isClassTypeName(typeStr) : false;

    return {
      name: node.key.name,
      type: typeStr,
      visibility: this.getVisibility(node),
      lineNumber: node.loc?.start.line,
      isArray,
      isClassType,
    };
  }

  /**
   * Extract method information
   */
  private extractMethod(node: t.ClassMethod): MethodInfo | null {
    if (!t.isIdentifier(node.key)) return null;

    return {
      name: node.key.name,
      parameters: this.extractParameters(node.params),
      returnType: this.getTypeAnnotation(node.returnType),
      visibility: this.getVisibility(node),
      lineNumber: node.loc?.start.line,
    };
  }

  /**
   * Extract parameter information
   */
  private extractParameters(params: any[]): ParameterInfo[] {
    return params.map((param) => {
      if (t.isIdentifier(param)) {
        return {
          name: param.name,
          type: this.getTypeAnnotation(param.typeAnnotation),
        };
      }
      return { name: 'unknown' };
    });
  }

  /**
   * Extract import information
   */
  private extractImportInfo(node: t.ImportDeclaration): ImportInfo {
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

    return {
      source,
      specifiers,
      isDefault,
      isNamespace,
      namespaceAlias,
      isDynamic: false,
      lineNumber: node.loc?.start.line ?? 0,
      isTypeOnly,
    };
  }

  /**
   * Extract named exports
   */
  private extractNamedExports(node: t.ExportNamedDeclaration): ExportInfo[] {
    const exports: ExportInfo[] = [];

    if (node.declaration) {
      // Export const/let/var
      if (t.isVariableDeclaration(node.declaration)) {
        node.declaration.declarations.forEach((decl) => {
          if (t.isIdentifier(decl.id)) {
            exports.push({
              name: decl.id.name,
              isDefault: false,
              isReExport: false,
              exportType: 'variable',
              lineNumber: node.loc?.start.line ?? 0,
            });
          }
        });
      }
      // Export function
      else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
        exports.push({
          name: node.declaration.id.name,
          isDefault: false,
          isReExport: false,
          exportType: 'function',
          lineNumber: node.loc?.start.line ?? 0,
        });
      }
      // Export class
      else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
        exports.push({
          name: node.declaration.id.name,
          isDefault: false,
          isReExport: false,
          exportType: 'class',
          lineNumber: node.loc?.start.line ?? 0,
        });
      }
    }

    // Export specifiers (export { foo, bar } from './module')
    if (node.specifiers) {
      node.specifiers.forEach((spec) => {
        if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
          exports.push({
            name: spec.exported.name,
            isDefault: false,
            isReExport: !!node.source,
            source: node.source?.value,
            exportType: 'variable',
            lineNumber: node.loc?.start.line ?? 0,
          });
        }
      });
    }

    return exports;
  }

  /**
   * Extract default export
   */
  private extractDefaultExport(node: t.ExportDefaultDeclaration): ExportInfo | null {
    if (t.isIdentifier(node.declaration)) {
      return {
        name: node.declaration.name,
        isDefault: true,
        isReExport: false,
        exportType: 'variable',
        lineNumber: node.loc?.start.line ?? 0,
      };
    } else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
      return {
        name: node.declaration.id.name,
        isDefault: true,
        isReExport: false,
        exportType: 'function',
        lineNumber: node.loc?.start.line ?? 0,
      };
    } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
      return {
        name: node.declaration.id.name,
        isDefault: true,
        isReExport: false,
        exportType: 'class',
        lineNumber: node.loc?.start.line ?? 0,
      };
    }

    return null;
  }

  /**
   * Get type annotation from TypeScript type annotation node
   */
  private getTypeAnnotation(typeAnnotation: any): string | undefined {
    if (!typeAnnotation) return undefined;

    if (t.isTSTypeAnnotation(typeAnnotation)) {
      return this.getTSTypeString(typeAnnotation.typeAnnotation);
    }

    return undefined;
  }

  /**
   * Get string representation of TypeScript type
   */
  private getTSTypeString(tsType: any): string | undefined {
    if (!tsType) return undefined;

    // Primitive types
    if (t.isTSStringKeyword(tsType)) return 'string';
    if (t.isTSNumberKeyword(tsType)) return 'number';
    if (t.isTSBooleanKeyword(tsType)) return 'boolean';
    if (t.isTSVoidKeyword(tsType)) return 'void';
    if (t.isTSAnyKeyword(tsType)) return 'any';
    if (t.isTSNullKeyword(tsType)) return 'null';
    if (t.isTSUndefinedKeyword(tsType)) return 'undefined';

    // Type reference (e.g., Wheel, Engine, Array<T>)
    if (t.isTSTypeReference(tsType) && t.isIdentifier(tsType.typeName)) {
      const typeName = tsType.typeName.name;
      if (tsType.typeParameters && tsType.typeParameters.params.length > 0) {
        const params = tsType.typeParameters.params
          .map((p: any) => this.getTSTypeString(p))
          .filter((p: any) => p)
          .join(', ');
        return `${typeName}<${params}>`;
      }
      return typeName;
    }

    // Array type (T[])
    if (t.isTSArrayType(tsType)) {
      const elementType = this.getTSTypeString(tsType.elementType);
      return elementType ? `${elementType}[]` : 'Array';
    }

    // Union type (A | B)
    if (t.isTSUnionType(tsType)) {
      const types = tsType.types.map((t: any) => this.getTSTypeString(t)).filter((t: any) => t);
      return types.length > 0 ? types.join(' | ') : undefined;
    }

    // Intersection type (A & B)
    if (t.isTSIntersectionType(tsType)) {
      const types = tsType.types.map((t: any) => this.getTSTypeString(t)).filter((t: any) => t);
      return types.length > 0 ? types.join(' & ') : undefined;
    }

    return undefined;
  }

  /**
   * Get visibility modifier from class member
   */
  private getVisibility(node: t.ClassProperty | t.ClassMethod): 'public' | 'protected' | 'private' {
    if (node.accessibility === 'private') return 'private';
    if (node.accessibility === 'protected') return 'protected';
    return 'public';
  }

  /**
   * Check if type name is a class type
   */
  private isClassTypeName(typeName: string): boolean {
    // Simple heuristic: if it starts with uppercase, it's likely a class
    return /^[A-Z]/.test(typeName) && !['Array', 'Object', 'String', 'Number', 'Boolean'].includes(typeName);
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(filePath: string): 'typescript' | 'javascript' {
    if (/\.tsx?$/.test(filePath) || /\.mts$/.test(filePath) || /\.cts$/.test(filePath)) {
      return 'typescript';
    }
    return 'javascript';
  }
}
