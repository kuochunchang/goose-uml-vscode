/**
 * @code-review-goose/analysis-parser-java
 * Tree-sitter Java AST to UnifiedAST converter
 */

import type { SyntaxNode } from "tree-sitter";
import Parser from "tree-sitter";
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
} from "../../types/index.js";

/**
 * Converts Tree-sitter Java AST to UnifiedAST
 */
export class JavaASTConverter {
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
      // Extract package declaration
      if (node.type === "package_declaration") {
        // Package info can be stored in metadata if needed
      }

      // Extract imports
      if (node.type === "import_declaration") {
        const importInfo = this.extractImport(node);
        if (importInfo) {
          imports.push(importInfo);
        }
      }

      // Extract classes
      if (node.type === "class_declaration") {
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

      // Extract enums (treat as classes for now)
      if (node.type === "enum_declaration") {
        const enumInfo = this.extractEnum(node);
        if (enumInfo) {
          classes.push(enumInfo);
        }
      }
    });

    return {
      language: "java",
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
   * Extract class information
   */
  private extractClass(node: SyntaxNode): ClassInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const className = nameNode.text;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];
    let constructorParams: ParameterInfo[] | undefined;

    // Extract superclass (extends) - use superclass field
    let extendsClass: string | undefined;
    const superclassNode = node.childForFieldName("superclass");
    if (superclassNode) {
      // superclass node contains "extends Type", extract the type
      for (const child of superclassNode.children) {
        if (
          child.type === "type_identifier" ||
          child.type === "scoped_type_identifier" ||
          child.type === "generic_type"
        ) {
          extendsClass = this.extractTypeName(child);
          break;
        }
      }
    }

    // Extract implemented interfaces - look for super_interfaces node (direct child, not field)
    const implementsInterfaces: string[] = [];
    for (const child of node.children) {
      if (child.type === "super_interfaces") {
        // super_interfaces contains "implements Type1, Type2, ..."
        // Look for type_list node
        for (const typeChild of child.children) {
          if (typeChild.type === "type_list") {
            // type_list contains the actual types
            for (const typeNode of typeChild.children) {
              if (
                typeNode.type === "type_identifier" ||
                typeNode.type === "scoped_type_identifier" ||
                typeNode.type === "generic_type"
              ) {
                const typeName = this.extractTypeName(typeNode);
                if (typeName) {
                  implementsInterfaces.push(typeName);
                }
              }
            }
          } else if (
            typeChild.type === "type_identifier" ||
            typeChild.type === "scoped_type_identifier" ||
            typeChild.type === "generic_type"
          ) {
            // Direct type (no type_list wrapper)
            const typeName = this.extractTypeName(typeChild);
            if (typeName) {
              implementsInterfaces.push(typeName);
            }
          }
        }
        break;
      }
    }

    // Extract modifiers (public, private, protected, abstract, etc.)
    // Note: Class visibility is not stored in ClassInfo, only method/property visibility

    // Extract class body members - find body node (contains '{' and members)
    let bodyNode: SyntaxNode | null = null;
    for (const child of node.children) {
      if (child.type === "{" || child.type === "class_body") {
        bodyNode = child;
        break;
      }
    }

    if (bodyNode) {
      for (const member of bodyNode.children) {
        // Skip braces and other non-member nodes
        if (member.type === "{" || member.type === "}") continue;

        if (member.type === "field_declaration") {
          const fieldProperties = this.extractField(member);
          properties.push(...fieldProperties);
        } else if (member.type === "method_declaration") {
          const method = this.extractMethod(member);
          if (method) {
            methods.push(method);
            // Check if it's a constructor (method name matches class name)
            if (method.name === className) {
              constructorParams = method.parameters;
            }
          }
        } else if (member.type === "constructor_declaration") {
          const constructor = this.extractConstructor(member);
          if (constructor) {
            constructorParams = constructor.parameters;
            const constructorLineNumber = this.getLineNumber(member);
            methods.push({
              name: "constructor",
              parameters: constructor.parameters,
              returnType: "void",
              visibility: constructor.visibility,
              lineNumber: constructorLineNumber,
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
  private extractInterface(node: SyntaxNode): InterfaceInfo {
    const nameNode = node.childForFieldName("name");
    const interfaceName = nameNode?.text || "Unknown";

    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];

    // Extract extended interfaces
    const extendsInterfaces: string[] = [];
    const extendsNode = node.childForFieldName("extends_interfaces");
    if (extendsNode) {
      for (const child of extendsNode.children) {
        if (child.type === "type_list") {
          for (const typeChild of child.children) {
            const typeName = this.extractTypeName(typeChild);
            if (typeName) {
              extendsInterfaces.push(typeName);
            }
          }
        }
      }
    }

    // Extract interface body
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (const member of bodyNode.children) {
        if (member.type === "constant_declaration") {
          // Interface constants (public static final)
          const constantProperties = this.extractConstant(member);
          properties.push(...constantProperties);
        } else if (member.type === "method_declaration") {
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
    };
  }

  /**
   * Extract enum information (treat as class)
   */
  private extractEnum(node: SyntaxNode): ClassInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const enumName = nameNode.text;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];

    // Extract enum constants
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (const child of bodyNode.children) {
        if (child.type === "enum_constant") {
          const constantName = child.childForFieldName("name")?.text;
          if (constantName) {
            properties.push({
              name: constantName,
              type: enumName,
              visibility: "public",
              lineNumber: this.getLineNumber(child),
            });
          }
        } else if (child.type === "method_declaration") {
          const method = this.extractMethod(child);
          if (method) {
            methods.push(method);
          }
        }
      }
    }

    const lineNumber = this.getLineNumber(node);
    return {
      name: enumName,
      type: "class",
      properties,
      methods,
      lineNumber,
    };
  }

  /**
   * Extract field declaration
   */
  private extractField(node: SyntaxNode): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const modifiers = this.extractModifiers(node);
    const visibility = this.getVisibility(modifiers);

    // Extract type - first try the 'type' field, then search children
    let type: string | undefined;

    // Try field name 'type' first (tree-sitter may have a dedicated type field)
    const typeNode = node.childForFieldName("type");
    if (typeNode) {
      type = this.extractTypeName(typeNode);
    }

    // If not found, search children for type nodes
    if (!type) {
      for (const child of node.children) {
        if (
          child.type === "type_identifier" ||
          child.type === "primitive_type" ||
          child.type === "integral_type" ||
          child.type === "floating_point_type" ||
          child.type === "scoped_type_identifier" ||
          child.type === "generic_type" ||
          child.type === "array_type"
        ) {
          type = this.extractTypeName(child);
          break;
        }
      }
    }

    // Extract variable declarators - look for variable_declarator
    for (const child of node.children) {
      if (child.type === "variable_declarator") {
        const nameNode = child.childForFieldName("name");
        if (nameNode) {
          // Check if type is an array
          const isArray = type
            ? type.endsWith("[]") ||
              type.startsWith("Array<") ||
              type === "Array"
            : false;

          properties.push({
            name: nameNode.text,
            type,
            visibility,
            lineNumber: this.getLineNumber(child),
            isArray,
          });
        }
      }
    }

    return properties;
  }

  /**
   * Extract method declaration
   */
  private extractMethod(node: SyntaxNode): MethodInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const methodName = nameNode.text;
    const modifiers = this.extractModifiers(node);
    const visibility = this.getVisibility(modifiers);

    // Extract return type
    const returnTypeNode = node.childForFieldName("type");
    const returnType = returnTypeNode
      ? this.extractTypeName(returnTypeNode)
      : "void";

    // Extract parameters
    const parameters: ParameterInfo[] = [];
    const parametersNode = node.childForFieldName("parameters");
    if (parametersNode) {
      for (const param of parametersNode.children) {
        if (param.type === "formal_parameter") {
          const paramName = param.childForFieldName("name")?.text;
          const paramType = param.childForFieldName("type");
          const paramTypeName = paramType
            ? this.extractTypeName(paramType)
            : undefined;

          if (paramName) {
            parameters.push({
              name: paramName,
              type: paramTypeName,
            });
          }
        }
      }
    }

    return {
      name: methodName,
      parameters,
      returnType,
      visibility,
      lineNumber: this.getLineNumber(node),
    };
  }

  /**
   * Extract constructor declaration
   */
  private extractConstructor(node: SyntaxNode): {
    parameters: ParameterInfo[];
    visibility: "public" | "protected" | "private";
  } | null {
    const modifiers = this.extractModifiers(node);
    const visibility = this.getVisibility(modifiers);

    const parameters: ParameterInfo[] = [];
    const parametersNode = node.childForFieldName("parameters");
    if (parametersNode) {
      for (const param of parametersNode.children) {
        if (param.type === "formal_parameter") {
          const paramName = param.childForFieldName("name")?.text;
          const paramType = param.childForFieldName("type");
          const paramTypeName = paramType
            ? this.extractTypeName(paramType)
            : undefined;

          if (paramName) {
            parameters.push({
              name: paramName,
              type: paramTypeName,
            });
          }
        }
      }
    }

    return { parameters, visibility };
  }

  /**
   * Extract constant declaration (for interfaces)
   */
  private extractConstant(node: SyntaxNode): PropertyInfo[] {
    // Similar to extractField but for interface constants
    return this.extractField(node);
  }

  /**
   * Extract import statement
   */
  private extractImport(node: SyntaxNode): ImportInfo | null {
    // Check for wildcard import (ends with .*)
    let isWildcard = false;
    let scopedIdentifier: SyntaxNode | null = null;

    for (const child of node.children) {
      if (
        child.type === "scoped_identifier" ||
        child.type === "scoped_type_identifier"
      ) {
        scopedIdentifier = child;
      } else if (child.type === "*" || child.text === "*") {
        isWildcard = true;
      }
    }

    if (!scopedIdentifier) return null;

    const importPath = this.extractScopedIdentifier(scopedIdentifier);
    const specifiers: string[] = [];

    const lineNumber = this.getLineNumber(node) ?? 0;

    if (isWildcard) {
      // import package.*;
      return {
        source: importPath,
        specifiers: [],
        isDefault: false,
        isNamespace: true,
        isDynamic: false,
        lineNumber,
      };
    } else {
      // Extract class name from path
      const parts = importPath.split(".");
      const className = parts[parts.length - 1];
      specifiers.push(className);
    }

    return {
      source: importPath,
      specifiers,
      isDefault: false,
      isNamespace: false,
      isDynamic: false,
      lineNumber,
    };
  }

  /**
   * Extract type name from type node
   */
  private extractTypeName(node: SyntaxNode): string | undefined {
    if (node.type === "type_identifier") {
      return node.text;
    } else if (
      node.type === "primitive_type" ||
      node.type === "integral_type" ||
      node.type === "floating_point_type"
    ) {
      return node.text; // int, boolean, void, float, double, etc.
    } else if (node.type === "generic_type") {
      // generic_type structure: type_identifier (name) + type_arguments
      // Find the type identifier (could be type_identifier or scoped_type_identifier)
      let typeIdentifier: SyntaxNode | null = node.childForFieldName("name");

      // If no 'name' field, search children for type_identifier or scoped_type_identifier
      if (!typeIdentifier) {
        for (const child of node.children) {
          if (
            child.type === "type_identifier" ||
            child.type === "scoped_type_identifier"
          ) {
            typeIdentifier = child;
            break;
          }
        }
      }

      if (typeIdentifier) {
        // Handle scoped type identifier (e.g., java.util.List)
        let baseType: string;
        if (
          typeIdentifier.type === "scoped_type_identifier" ||
          typeIdentifier.type === "scoped_identifier"
        ) {
          baseType = this.extractScopedIdentifier(typeIdentifier);
        } else {
          baseType = typeIdentifier.text;
        }

        // Extract type arguments (e.g., List<Wheel> -> Wheel)
        let typeArguments: SyntaxNode | null =
          node.childForFieldName("type_arguments");

        // If no 'type_arguments' field, search children
        if (!typeArguments) {
          for (const child of node.children) {
            if (child.type === "type_arguments") {
              typeArguments = child;
              break;
            }
          }
        }

        if (typeArguments) {
          // Find the first type argument
          for (const child of typeArguments.children) {
            if (
              child.type === "type_identifier" ||
              child.type === "scoped_type_identifier" ||
              child.type === "generic_type"
            ) {
              const elementType = this.extractTypeName(child);
              if (elementType) {
                // For collection types (List, Set, etc.), convert to array notation
                // Check both simple name and scoped name (java.util.List -> List)
                const baseTypeName = baseType.split(".").pop() || baseType;
                const collectionTypes = [
                  "List",
                  "ArrayList",
                  "LinkedList",
                  "Set",
                  "HashSet",
                  "LinkedHashSet",
                ];
                if (collectionTypes.includes(baseTypeName)) {
                  return `${elementType}[]`; // List<Wheel> -> Wheel[]
                } else {
                  // For other generics, return baseType<elementType>
                  return `${baseType}<${elementType}>`;
                }
              }
            }
          }
        }

        // No type arguments, just return base type
        return baseType;
      }
    } else if (
      node.type === "scoped_type_identifier" ||
      node.type === "scoped_identifier"
    ) {
      // Check if it's a scoped generic type (e.g., java.util.List<Wheel>)
      // In tree-sitter, this might be structured as scoped_type_identifier with generic_type children
      // OR as generic_type with scoped_type_identifier as name
      for (const child of node.children) {
        if (child.type === "generic_type") {
          // This is a scoped generic, extract it
          return this.extractTypeName(child);
        }
      }

      // Check if parent is generic_type (scoped name is the base type)
      // This handles: generic_type -> name: scoped_type_identifier, type_arguments: ...
      // Regular scoped identifier (e.g., java.util.List without generics)
      return this.extractScopedIdentifier(node);
    } else if (node.type === "array_type") {
      const elementType = node.childForFieldName("element");
      if (elementType) {
        const elementTypeName = this.extractTypeName(elementType);
        return elementTypeName ? `${elementTypeName}[]` : undefined;
      }
    }

    return undefined;
  }

  /**
   * Extract scoped identifier (e.g., java.util.List)
   */
  private extractScopedIdentifier(node: SyntaxNode): string {
    const parts: string[] = [];
    this.traverseScopedIdentifier(node, parts);
    return parts.join(".");
  }

  /**
   * Traverse scoped identifier recursively
   */
  private traverseScopedIdentifier(node: SyntaxNode, parts: string[]): void {
    if (node.type === "identifier") {
      parts.push(node.text);
    } else if (
      node.type === "scoped_type_identifier" ||
      node.type === "scoped_identifier"
    ) {
      for (const child of node.children) {
        if (child.type === "identifier") {
          parts.push(child.text);
        } else {
          this.traverseScopedIdentifier(child, parts);
        }
      }
    }
  }

  /**
   * Extract modifiers (public, private, protected, static, final, etc.)
   */
  private extractModifiers(node: SyntaxNode): string[] {
    const modifiers: string[] = [];

    // Look for modifiers node (it's a direct child, not a field)
    for (const child of node.children) {
      if (child.type === "modifiers") {
        // modifiers node contains modifier keywords (private, public, protected, static, final, etc.)
        for (const modifierChild of child.children) {
          // Modifier keywords are their own type (private, public, protected, static, final, abstract, etc.)
          if (
            modifierChild.type === "private" ||
            modifierChild.type === "public" ||
            modifierChild.type === "protected" ||
            modifierChild.type === "static" ||
            modifierChild.type === "final" ||
            modifierChild.type === "abstract" ||
            modifierChild.type === "modifier"
          ) {
            modifiers.push(modifierChild.text);
          }
        }
        break;
      } else if (
        child.type === "private" ||
        child.type === "public" ||
        child.type === "protected" ||
        child.type === "static" ||
        child.type === "final" ||
        child.type === "abstract" ||
        child.type === "modifier"
      ) {
        // Direct modifier keyword (less common)
        modifiers.push(child.text);
      } else if (
        child.type === "type_identifier" ||
        child.type === "primitive_type" ||
        child.type === "integral_type" ||
        child.type === "floating_point_type" ||
        child.type === "field_declaration" ||
        child.type === "method_declaration" ||
        child.type === "class_declaration" ||
        child.type === "identifier"
      ) {
        // Stop when we hit the actual declaration
        break;
      }
    }

    return modifiers;
  }

  /**
   * Get visibility from modifiers
   */
  private getVisibility(
    modifiers: string[],
  ): "public" | "protected" | "private" {
    if (modifiers.includes("public")) return "public";
    if (modifiers.includes("protected")) return "protected";
    if (modifiers.includes("private")) return "private";
    return "public"; // Default package-private is treated as public
  }

  /**
   * Get line number from node
   */
  private getLineNumber(node: SyntaxNode): number | undefined {
    return node.startPosition.row + 1; // tree-sitter uses 0-based, we use 1-based
  }
}
