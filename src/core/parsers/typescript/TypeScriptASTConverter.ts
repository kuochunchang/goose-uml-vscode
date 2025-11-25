/**
 * @code-review-goose/analysis-parser-typescript
 * Tree-sitter TypeScript AST to UnifiedAST converter
 */

import type { SyntaxNode } from "tree-sitter";
import Parser from "tree-sitter";
import type {
  ClassInfo,
  ExportInfo,
  FunctionInfo,
  ImportInfo,
  InterfaceInfo,
  MethodInfo,
  ParameterInfo,
  PropertyInfo,
  UnifiedAST,
} from "../../types/index.js";

/**
 * Converts Tree-sitter TypeScript AST to UnifiedAST
 */
export class TypeScriptASTConverter {
  /**
   * Convert Tree-sitter AST to UnifiedAST
   */
  convert(
    rootNode: SyntaxNode,
    filePath: string,
    originalTree?: Parser.Tree,
  ): UnifiedAST {
    const classes: ClassInfo[] = [];
    const interfaces: InterfaceInfo[] = [];
    const functions: FunctionInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];

    // Traverse the AST
    this.traverse(rootNode, (node) => {
      // Extract imports
      if (node.type === "import_statement") {
        const importInfo = this.extractImport(node);
        if (importInfo) {
          imports.push(importInfo);
        }
      }

      // Extract classes
      if (
        node.type === "class_declaration" ||
        node.type === "abstract_class_declaration"
      ) {
        const classInfo = this.extractClass(node);
        if (classInfo) {
          classes.push(classInfo);
        }
      }

      // Extract interfaces
      if (node.type === "interface_declaration") {
        const interfaceInfo = this.extractInterface(node);
        if (interfaceInfo) {
          interfaces.push(interfaceInfo);
        }
      }

      // Extract functions (top-level)
      if (
        node.type === "function_declaration" &&
        this.isTopLevel(node, rootNode)
      ) {
        const functionInfo = this.extractFunction(node);
        if (functionInfo) {
          functions.push(functionInfo);
        }
      }

      // Extract exports
      if (node.type === "export_statement") {
        const exportInfos = this.extractExport(node);
        exports.push(...exportInfos);
      }
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
      originalAST: originalTree, // Preserve original tree-sitter AST for sequence analysis
    };
  }

  /**
   * Traverse AST nodes recursively
   */
  private traverse(
    node: SyntaxNode,
    callback: (node: SyntaxNode) => void,
  ): void {
    callback(node);
    for (const child of node.children) {
      this.traverse(child, callback);
    }
  }

  /**
   * Check if node is at top level (not inside a class or function)
   */
  private isTopLevel(node: SyntaxNode, rootNode: SyntaxNode): boolean {
    let current: SyntaxNode | null = node.parent;
    while (current && current !== rootNode) {
      if (
        current.type === "class_declaration" ||
        current.type === "function_declaration" ||
        current.type === "method_definition"
      ) {
        return false;
      }
      current = current.parent;
    }
    return true;
  }

  /**
   * Extract class information
   */
  private extractClass(node: SyntaxNode): ClassInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const className = nameNode.text;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];
    let constructorParams: ParameterInfo[] | undefined;

    // Extract superclass (extends)
    let extendsClass: string | undefined;

    // Extract implemented interfaces
    const implementsInterfaces: string[] = [];

    // Find class_heritage node
    const heritageNode = node.children.find((c) => c.type === "class_heritage");

    if (heritageNode) {
      // Extract extends
      const extendsClause = heritageNode.children.find(
        (c) => c.type === "extends_clause",
      );
      if (extendsClause) {
        const extendsNode = extendsClause.children.find(
          (c) =>
            c.type === "identifier" ||
            c.type === "type_identifier" ||
            c.type === "nested_type_identifier" ||
            c.type === "generic_type" ||
            c.type === "member_expression" ||
            c.type === "call_expression",
        );

        if (extendsNode) {
          if (
            extendsNode.type === "identifier" ||
            extendsNode.type === "member_expression" ||
            extendsNode.type === "call_expression"
          ) {
            extendsClass = extendsNode.text;
          } else {
            extendsClass = this.extractTypeName(extendsNode);
          }
        }
      }

      // Extract implements
      const implementsClause = heritageNode.children.find(
        (c) => c.type === "implements_clause",
      );
      if (implementsClause) {
        for (const child of implementsClause.children) {
          if (
            child.type === "type_identifier" ||
            child.type === "nested_type_identifier" ||
            child.type === "generic_type"
          ) {
            const typeName = this.extractTypeName(child);
            if (typeName) {
              implementsInterfaces.push(typeName);
            }
          }
        }
      }
    }

    // Extract class body members
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (const member of bodyNode.children) {
        if (
          member.type === "property_signature" ||
          member.type === "public_field_definition" ||
          member.type === "private_field_definition" ||
          member.type === "protected_field_definition" ||
          member.type === "abstract_field_signature"
        ) {
          const prop = this.extractProperty(member);
          if (prop) properties.push(prop);
        } else if (
          member.type === "method_definition" ||
          member.type === "method_signature"
        ) {
          const method = this.extractMethod(member);
          if (method) {
            methods.push(method);
            // Check if it's a constructor
            if (method.name === "constructor") {
              constructorParams = method.parameters;
            }
          }
        } else if (member.type === "constructor") {
          const constructor = this.extractConstructor(member);
          if (constructor) {
            constructorParams = constructor.parameters;
            methods.push({
              name: "constructor",
              parameters: constructor.parameters,
              returnType: "void",
              visibility: "public",
              lineNumber: this.getLineNumber(member),
            });
          }
        }
      }
    }

    return {
      name: className,
      type: "class",
      properties,
      methods,
      extends: extendsClass,
      implements:
        implementsInterfaces.length > 0 ? implementsInterfaces : undefined,
      lineNumber: this.getLineNumber(node),
      constructorParams,
    };
  }

  /**
   * Extract interface information
   */
  private extractInterface(node: SyntaxNode): InterfaceInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const interfaceName = nameNode.text;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];

    // Extract extended interfaces
    const extendsInterfaces: string[] = [];

    // Find extends_type_clause
    const extendsClause = node.children.find(
      (c) => c.type === "extends_type_clause",
    );

    if (extendsClause) {
      for (const child of extendsClause.children) {
        if (
          child.type === "type_identifier" ||
          child.type === "nested_type_identifier" ||
          child.type === "generic_type"
        ) {
          const typeName = this.extractTypeName(child);
          if (typeName) {
            extendsInterfaces.push(typeName);
          }
        }
      }
    }

    // Extract interface body
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (const member of bodyNode.children) {
        if (member.type === "property_signature") {
          const prop = this.extractProperty(member);
          if (prop) properties.push(prop);
        } else if (member.type === "method_signature") {
          const method = this.extractMethod(member);
          if (method) {
            methods.push(method);
          }
        }
      }
    }

    return {
      name: interfaceName,
      type: "interface",
      properties,
      methods,
      extends: extendsInterfaces.length > 0 ? extendsInterfaces : undefined,
      lineNumber: this.getLineNumber(node),
    };
  }

  /**
   * Extract function information (top-level)
   */
  private extractFunction(node: SyntaxNode): FunctionInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const functionName = nameNode.text;

    // Extract return type
    let returnType: string = "void";
    const returnTypeNode = node.childForFieldName("return_type");
    if (returnTypeNode) {
      const extractedType = this.extractTypeName(returnTypeNode);
      if (extractedType) {
        returnType = extractedType;
      }
    }

    // Extract parameters
    const parameters: ParameterInfo[] = [];
    const parametersNode = node.childForFieldName("parameters");
    if (parametersNode) {
      for (const param of parametersNode.children) {
        if (
          param.type === "required_parameter" ||
          param.type === "optional_parameter"
        ) {
          const paramInfo = this.extractParameter(param);
          if (paramInfo) {
            parameters.push(paramInfo);
          }
        }
      }
    }

    return {
      name: functionName,
      parameters,
      returnType,
      isExported: false, // Will be determined during export extraction
      lineNumber: this.getLineNumber(node),
    };
  }

  /**
   * Extract method information
   */
  private extractMethod(node: SyntaxNode): MethodInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const methodName = nameNode.text;

    // Extract return type
    let returnType: string | undefined;
    const returnTypeNode = node.childForFieldName("return_type");
    if (returnTypeNode) {
      returnType = this.extractTypeName(returnTypeNode);
    }

    // Extract parameters
    const parameters: ParameterInfo[] = [];
    const parametersNode = node.childForFieldName("parameters");
    if (parametersNode) {
      for (const param of parametersNode.children) {
        if (
          param.type === "required_parameter" ||
          param.type === "optional_parameter"
        ) {
          const paramInfo = this.extractParameter(param);
          if (paramInfo) {
            parameters.push(paramInfo);
          }
        }
      }
    }

    // Extract visibility
    const visibility = this.getVisibility(node);

    return {
      name: methodName,
      parameters,
      returnType,
      visibility,
      lineNumber: this.getLineNumber(node),
    };
  }

  /**
   * Extract constructor information
   */
  private extractConstructor(node: SyntaxNode): {
    parameters: ParameterInfo[];
  } | null {
    const parameters: ParameterInfo[] = [];
    const parametersNode = node.childForFieldName("parameters");
    if (parametersNode) {
      for (const param of parametersNode.children) {
        if (
          param.type === "required_parameter" ||
          param.type === "optional_parameter"
        ) {
          const paramInfo = this.extractParameter(param);
          if (paramInfo) {
            parameters.push(paramInfo);
          }
        }
      }
    }

    return { parameters };
  }

  /**
   * Extract property information
   */
  private extractProperty(node: SyntaxNode): PropertyInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const propertyName = nameNode.text;

    // Extract type
    let typeStr: string | undefined;
    // Try field "type" first (for property_signature)
    const typeNode: SyntaxNode | null = node.childForFieldName("type");

    // If type field returns type_annotation (which includes the colon), extract the actual type from it
    if (typeNode && typeNode.type === "type_annotation") {
      // type_annotation has children: [':', type_identifier/predefined_type/etc]
      // Find the actual type node (skip the ':' token)
      const actualTypeNode = typeNode.children.find(
        (child) =>
          child.type === "type_identifier" ||
          child.type === "predefined_type" ||
          child.type === "generic_type" ||
          child.type === "array_type" ||
          child.type === "union_type" ||
          child.type === "intersection_type" ||
          child.type === "nested_type_identifier",
      );
      if (actualTypeNode) {
        typeStr = this.extractTypeName(actualTypeNode);
      }
    } else if (typeNode) {
      // Direct type node (for property_signature)
      typeStr = this.extractTypeName(typeNode);
    } else {
      // If not found via field, try finding type_annotation in children
      const typeAnnotationNode =
        node.children.find((child) => child.type === "type_annotation") ||
        node.namedChildren.find((child) => child.type === "type_annotation");
      if (typeAnnotationNode) {
        // Find the type node (skip the ':' token)
        const actualTypeNode =
          typeAnnotationNode.children.find(
            (child) =>
              child.type === "type_identifier" ||
              child.type === "predefined_type" ||
              child.type === "generic_type" ||
              child.type === "array_type" ||
              child.type === "union_type" ||
              child.type === "intersection_type" ||
              child.type === "nested_type_identifier",
          ) ||
          typeAnnotationNode.namedChildren.find(
            (child) =>
              child.type === "type_identifier" ||
              child.type === "predefined_type" ||
              child.type === "generic_type" ||
              child.type === "array_type" ||
              child.type === "union_type" ||
              child.type === "intersection_type" ||
              child.type === "nested_type_identifier",
          );
        if (actualTypeNode) {
          typeStr = this.extractTypeName(actualTypeNode);
        }
      }
    }

    // Extract visibility
    const visibility = this.getVisibility(node);

    // Check if type is an array
    const isArray = typeStr
      ? typeStr.endsWith("[]") ||
        typeStr.startsWith("Array<") ||
        typeStr === "Array"
      : false;

    // Check if type is a class type
    const isClassType = typeStr ? this.isClassTypeName(typeStr) : false;

    return {
      name: propertyName,
      type: typeStr,
      visibility,
      lineNumber: this.getLineNumber(node),
      isArray,
      isClassType,
    };
  }

  /**
   * Extract parameter information
   */
  private extractParameter(node: SyntaxNode): ParameterInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const paramName = nameNode.text;

    // Extract type
    let paramType: string | undefined;
    const typeNode = node.childForFieldName("type");

    // If type field returns type_annotation, extract the actual type from it
    if (typeNode && typeNode.type === "type_annotation") {
      // type_annotation has children: [':', type_identifier/predefined_type/etc]
      const actualTypeNode = typeNode.children.find(
        (child) =>
          child.type === "type_identifier" ||
          child.type === "predefined_type" ||
          child.type === "generic_type" ||
          child.type === "array_type" ||
          child.type === "union_type" ||
          child.type === "intersection_type" ||
          child.type === "nested_type_identifier",
      );
      if (actualTypeNode) {
        paramType = this.extractTypeName(actualTypeNode);
      }
    } else if (typeNode) {
      paramType = this.extractTypeName(typeNode);
    } else {
      // Try finding type_annotation in children
      const typeAnnotationNode = node.children.find(
        (child) => child.type === "type_annotation",
      );
      if (typeAnnotationNode) {
        const actualTypeNode = typeAnnotationNode.children.find(
          (child) =>
            child.type === "type_identifier" ||
            child.type === "predefined_type" ||
            child.type === "generic_type" ||
            child.type === "array_type" ||
            child.type === "union_type" ||
            child.type === "intersection_type" ||
            child.type === "nested_type_identifier",
        );
        if (actualTypeNode) {
          paramType = this.extractTypeName(actualTypeNode);
        }
      }
    }

    // Check if optional
    const isOptional = node.type === "optional_parameter";

    return {
      name: paramName,
      type: paramType,
      isOptional,
    };
  }

  /**
   * Extract import statement
   */
  private extractImport(node: SyntaxNode): ImportInfo | null {
    const sourceNode = node.childForFieldName("source");
    if (!sourceNode) return null;

    const source = sourceNode.text.replace(/['"`]/g, ""); // Remove quotes
    const specifiers: string[] = [];
    let isDefault = false;
    let isNamespace = false;
    let namespaceAlias: string | undefined;
    let isTypeOnly = false;

    // Check for type-only import
    if (node.children.some((child) => child.type === "type")) {
      isTypeOnly = true;
    }

    // Extract import specifiers
    // Note: childForFieldName("import") doesn't work for tree-sitter-typescript
    // We need to find import_clause in children
    const importClauseNode = node.children.find(
      (child) => child.type === "import_clause",
    );

    if (importClauseNode) {
      // Check for named_imports child
      const namedImportsNode = importClauseNode.children.find(
        (child) => child.type === "named_imports",
      );

      if (namedImportsNode) {
        // Named imports: import { A, B } from './module'
        for (const child of namedImportsNode.children) {
          if (child.type === "import_specifier") {
            // import_specifier has an identifier child
            const identifierNode = child.children.find(
              (c) => c.type === "identifier",
            );
            if (identifierNode) {
              specifiers.push(identifierNode.text);
            }
          }
        }
      } else {
        // Check for default import or namespace import
        for (const child of importClauseNode.children) {
          if (child.type === "identifier") {
            // Default import: import Foo from './module'
            isDefault = true;
            specifiers.push(child.text);
          } else if (child.type === "namespace_import") {
            // Namespace import: import * as Foo from './module'
            isNamespace = true;
            const aliasNode = child.childForFieldName("alias");
            if (aliasNode) {
              namespaceAlias = aliasNode.text;
              specifiers.push(aliasNode.text);
            }
          }
        }
      }
    }

    return {
      source,
      specifiers,
      isDefault,
      isNamespace,
      namespaceAlias,
      isDynamic: false,
      lineNumber: this.getLineNumber(node) ?? 0,
      isTypeOnly,
    };
  }

  /**
   * Extract export statement
   */
  private extractExport(node: SyntaxNode): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lineNumber = this.getLineNumber(node) ?? 0;

    // Check for default export
    const defaultNode = node.childForFieldName("default");
    if (defaultNode) {
      // Default export
      const declaration = node.children.find(
        (child) =>
          child.type === "class_declaration" ||
          child.type === "abstract_class_declaration" ||
          child.type === "function_declaration" ||
          child.type === "identifier",
      );
      if (declaration) {
        let name = "";
        let exportType: ExportInfo["exportType"] = "variable";

        if (
          declaration.type === "class_declaration" ||
          declaration.type === "abstract_class_declaration"
        ) {
          const nameNode = declaration.childForFieldName("name");
          name = nameNode?.text || "default";
          exportType = "class";
        } else if (declaration.type === "function_declaration") {
          const nameNode = declaration.childForFieldName("name");
          name = nameNode?.text || "default";
          exportType = "function";
        } else if (declaration.type === "identifier") {
          name = declaration.text;
        }

        if (name) {
          exports.push({
            name,
            isDefault: true,
            isReExport: false,
            exportType,
            lineNumber,
          });
        }
      }
    } else {
      // Named export
      const declaration = node.children.find(
        (child) =>
          child.type === "class_declaration" ||
          child.type === "abstract_class_declaration" ||
          child.type === "function_declaration" ||
          child.type === "variable_declaration",
      );

      if (declaration) {
        let name = "";
        let exportType: ExportInfo["exportType"] = "variable";

        if (
          declaration.type === "class_declaration" ||
          declaration.type === "abstract_class_declaration"
        ) {
          const nameNode = declaration.childForFieldName("name");
          name = nameNode?.text || "";
          exportType = "class";
        } else if (declaration.type === "function_declaration") {
          const nameNode = declaration.childForFieldName("name");
          name = nameNode?.text || "";
          exportType = "function";
        } else if (declaration.type === "variable_declaration") {
          const nameNode = declaration.childForFieldName("name");
          name = nameNode?.text || "";
          exportType = "variable";
        }

        if (name) {
          exports.push({
            name,
            isDefault: false,
            isReExport: false,
            exportType,
            lineNumber,
          });
        }
      } else {
        // Export specifiers (export { foo, bar })
        const exportClause = node.childForFieldName("export");
        if (exportClause) {
          for (const spec of exportClause.children) {
            if (spec.type === "export_specifier") {
              const nameNode = spec.childForFieldName("name");
              if (nameNode) {
                exports.push({
                  name: nameNode.text,
                  isDefault: false,
                  isReExport: false,
                  exportType: "variable",
                  lineNumber,
                });
              }
            }
          }
        }
      }
    }

    return exports;
  }

  /**
   * Extract type name from type node
   */
  private extractTypeName(node: SyntaxNode): string | undefined {
    if (node.type === "type_identifier") {
      return node.text;
    } else if (node.type === "predefined_type") {
      return node.text; // string, number, boolean, void, any, etc.
    } else if (node.type === "nested_type_identifier") {
      // Extract nested type (e.g., A.B)
      const parts: string[] = [];
      this.traverseNestedType(node, parts);
      return parts.join(".");
    } else if (node.type === "generic_type") {
      // Generic type (e.g., Array<T>, Promise<string>)
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        const baseType = this.extractTypeName(nameNode);
        const typeArguments = node.childForFieldName("type_arguments");
        if (typeArguments) {
          const args: string[] = [];
          for (const arg of typeArguments.children) {
            if (
              arg.type === "type_identifier" ||
              arg.type === "predefined_type"
            ) {
              const argType = this.extractTypeName(arg);
              if (argType) {
                args.push(argType);
              }
            }
          }
          if (args.length > 0) {
            return `${baseType}<${args.join(", ")}>`;
          }
        }
        return baseType;
      }
    } else if (node.type === "array_type") {
      // Array type (e.g., string[])
      const elementType = node.childForFieldName("element");
      if (elementType) {
        const elementTypeName = this.extractTypeName(elementType);
        return elementTypeName ? `${elementTypeName}[]` : undefined;
      }
    } else if (node.type === "union_type") {
      // Union type (e.g., string | number)
      const types: string[] = [];
      for (const child of node.children) {
        if (
          child.type === "type_identifier" ||
          child.type === "predefined_type"
        ) {
          const typeName = this.extractTypeName(child);
          if (typeName) {
            types.push(typeName);
          }
        }
      }
      return types.length > 0 ? types.join(" | ") : undefined;
    } else if (node.type === "intersection_type") {
      // Intersection type (e.g., A & B)
      const types: string[] = [];
      for (const child of node.children) {
        if (
          child.type === "type_identifier" ||
          child.type === "predefined_type"
        ) {
          const typeName = this.extractTypeName(child);
          if (typeName) {
            types.push(typeName);
          }
        }
      }
      return types.length > 0 ? types.join(" & ") : undefined;
    }

    return undefined;
  }

  /**
   * Traverse nested type identifier
   */
  private traverseNestedType(node: SyntaxNode, parts: string[]): void {
    if (node.type === "type_identifier" || node.type === "identifier") {
      parts.push(node.text);
    } else if (node.type === "nested_type_identifier") {
      for (const child of node.children) {
        if (child.type === "type_identifier" || child.type === "identifier") {
          parts.push(child.text);
        } else {
          this.traverseNestedType(child, parts);
        }
      }
    }
  }

  /**
   * Get visibility modifier from node
   */
  private getVisibility(node: SyntaxNode): "public" | "protected" | "private" {
    // Check for accessibility modifiers
    for (const child of node.children) {
      if (child.type === "accessibility_modifier") {
        const text = child.text;
        if (text === "private") return "private";
        if (text === "protected") return "protected";
        if (text === "public") return "public";
      } else if (
        child.type === "private" ||
        child.type === "protected" ||
        child.type === "public"
      ) {
        return child.type;
      }
    }
    return "public"; // Default is public in TypeScript
  }

  /**
   * Check if type name is a class type
   */
  private isClassTypeName(typeName: string): boolean {
    // Simple heuristic: if it starts with uppercase, it's likely a class
    return (
      /^[A-Z]/.test(typeName) &&
      !["Array", "Object", "String", "Number", "Boolean", "Promise"].includes(
        typeName,
      )
    );
  }

  /**
   * Get line number from node
   */
  private getLineNumber(node: SyntaxNode): number | undefined {
    return node.startPosition.row + 1; // tree-sitter uses 0-based, we use 1-based
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(filePath: string): "typescript" | "javascript" {
    if (
      /\.tsx?$/.test(filePath) ||
      /\.mts$/.test(filePath) ||
      /\.cts$/.test(filePath)
    ) {
      return "typescript";
    }
    return "javascript";
  }
}
