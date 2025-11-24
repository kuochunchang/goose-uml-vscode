/**
 * @code-review-goose/analysis-parser-python
 * Tree-sitter Python AST to UnifiedAST converter
 */

import type { SyntaxNode } from 'tree-sitter';
import Parser from 'tree-sitter';
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

/**
 * Converts Tree-sitter Python AST to UnifiedAST
 */
export class PythonASTConverter {
  /**
   * Convert Tree-sitter AST to UnifiedAST
   */
  convert(rootNode: SyntaxNode, filePath: string, originalTree?: Parser.Tree): UnifiedAST {
    const classes: ClassInfo[] = [];
    const interfaces: InterfaceInfo[] = [];
    const functions: FunctionInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];

    // Traverse the AST
    this.traverse(rootNode, (node) => {
      // Extract imports
      if (node.type === 'import_statement' || node.type === 'import_from_statement') {
        const importInfos = this.extractImport(node);
        imports.push(...importInfos);
      }

      // Extract classes
      if (node.type === 'class_definition') {
        const classInfo = this.extractClass(node);
        if (classInfo) {
          classes.push(classInfo);
        }
      }

      // Extract functions (top-level)
      if (node.type === 'function_definition' && this.isTopLevel(node, rootNode)) {
        const functionInfo = this.extractFunction(node);
        if (functionInfo) {
          functions.push(functionInfo);
        }
      }
    });

    return {
      language: 'python',
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
  private traverse(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
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
      if (current.type === 'class_definition' || current.type === 'function_definition') {
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
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const className = nameNode.text;
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];

    // Extract superclasses (inheritance)
    let extendsClass: string | undefined;
    const superclassesNode = node.childForFieldName('superclasses');
    if (superclassesNode) {
      // superclasses contains argument_list with base classes
      const firstBase = superclassesNode.children.find(
        (child) => child.type === 'identifier' || child.type === 'attribute'
      );
      if (firstBase) {
        extendsClass = this.extractIdentifierOrAttribute(firstBase);
      }
    }

    // Extract class body
    const bodyNode = node.childForFieldName('body');
    if (bodyNode) {
      for (const member of bodyNode.children) {
        if (member.type === 'function_definition') {
          const method = this.extractMethod(member);
          if (method) {
            methods.push(method);
            // Check if it's __init__ (constructor)
            if (method.name === '__init__') {
              // Extract instance variables from __init__ (self.xxx = ...)
              const initProperties = this.extractInstanceVariablesFromInit(member);
              properties.push(...initProperties);
            }
          }
        } else if (member.type === 'expression_statement') {
          // Class variables (e.g., name: str = "default")
          const assignment = member.children.find((c) => c.type === 'assignment');
          if (assignment) {
            const varProperties = this.extractClassVariable(assignment, member);
            properties.push(...varProperties);
          }
        } else if (member.type === 'decorated_definition') {
          // Decorated method (e.g., @property, @staticmethod)
          const funcDef = member.children.find((c) => c.type === 'function_definition');
          if (funcDef) {
            const method = this.extractMethod(funcDef);
            if (method) {
              methods.push(method);
            }
          }
        }
      }
    }

    return {
      name: className,
      type: 'class',
      properties,
      methods,
      extends: extendsClass,
      lineNumber: this.getLineNumber(node),
    };
  }

  /**
   * Extract method information
   */
  private extractMethod(node: SyntaxNode): MethodInfo | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const methodName = nameNode.text;

    // Extract return type annotation
    let returnType: string | undefined;
    const returnTypeNode = node.childForFieldName('return_type');
    if (returnTypeNode) {
      returnType = this.extractTypeAnnotation(returnTypeNode);
    }

    // Extract parameters
    const parameters: ParameterInfo[] = [];
    const parametersNode = node.childForFieldName('parameters');
    if (parametersNode) {
      // parameters node contains: ( typed_parameter, ... )
      // We need to iterate through children and find typed_parameter nodes
      for (const child of parametersNode.children) {
        if (child.type === 'typed_parameter') {
          const paramInfo = this.extractParameter(child);
          if (paramInfo) {
            parameters.push(paramInfo);
          }
        } else if (child.type === 'identifier') {
          // Simple parameter without type annotation
          const paramInfo = this.extractParameter(child);
          if (paramInfo) {
            parameters.push(paramInfo);
          }
        }
      }
    }

    // Python methods are public by default (no private/protected)
    return {
      name: methodName,
      parameters,
      returnType: returnType || 'Any',
      visibility: 'public',
      lineNumber: this.getLineNumber(node),
    };
  }

  /**
   * Extract function information (top-level)
   */
  private extractFunction(node: SyntaxNode): FunctionInfo | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const functionName = nameNode.text;

    // Extract return type annotation
    let returnType: string = 'Any';
    const returnTypeNode = node.childForFieldName('return_type');
    if (returnTypeNode) {
      const extractedType = this.extractTypeAnnotation(returnTypeNode);
      if (extractedType) {
        returnType = extractedType;
      }
    }

    // Extract parameters
    const parameters: ParameterInfo[] = [];
    const parametersNode = node.childForFieldName('parameters');
    if (parametersNode) {
      // parameters node contains: ( typed_parameter, ... )
      // We need to iterate through children and find typed_parameter nodes
      for (const child of parametersNode.children) {
        if (child.type === 'typed_parameter') {
          const paramInfo = this.extractParameter(child);
          if (paramInfo) {
            parameters.push(paramInfo);
          }
        } else if (child.type === 'identifier') {
          // Simple parameter without type annotation
          const paramInfo = this.extractParameter(child);
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
   * Extract parameter information
   */
  private extractParameter(node: SyntaxNode): ParameterInfo | null {
    let paramName: string | undefined;
    let paramType: string | undefined;

    if (node.type === 'typed_parameter') {
      // typed_parameter has identifier as first child and type as a child
      const identifierNode = node.children.find((c) => c.type === 'identifier');
      const typeNode = node.childForFieldName('type');
      
      paramName = identifierNode?.text;
      if (typeNode) {
        paramType = this.extractTypeAnnotation(typeNode);
      }
    } else if (node.type === 'identifier') {
      paramName = node.text;
    }

    if (!paramName) return null;

    return {
      name: paramName,
      type: paramType,
    };
  }

  /**
   * Extract class variable (property)
   */
  private extractClassVariable(assignmentNode: SyntaxNode, parentNode: SyntaxNode): PropertyInfo[] {
    const properties: PropertyInfo[] = [];

    // Find left side (variable name)
    const leftNode = assignmentNode.childForFieldName('left');
    if (!leftNode) return properties;

    let varName: string | undefined;
    let varType: string | undefined;

    if (leftNode.type === 'identifier') {
      varName = leftNode.text;
    } else if (leftNode.type === 'typed_default_parameter') {
      const nameNode = leftNode.childForFieldName('name');
      const typeNode = leftNode.childForFieldName('type');
      varName = nameNode?.text;
      if (typeNode) {
        varType = this.extractTypeAnnotation(typeNode);
      }
    }

    if (!varName) return properties;

    // Check if type is an array
    const isArray = varType ? (varType.endsWith('[]') || varType.startsWith('Array<') || varType === 'Array') : false;

    properties.push({
      name: varName,
      type: varType,
      visibility: 'public', // Python doesn't have private/protected
      lineNumber: this.getLineNumber(parentNode),
      isArray,
    });

    return properties;
  }

  /**
   * Extract import statement
   */
  private extractImport(node: SyntaxNode): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lineNumber = this.getLineNumber(node) ?? 0;

    if (node.type === 'import_statement') {
      // import module
      // import module as alias
      const importList = node.childForFieldName('name');
      if (importList) {
        const modulePath = this.extractDottedName(importList);
        const aliasNode = node.children.find((c) => c.type === 'aliased_import');
        
        if (aliasNode) {
          const alias = aliasNode.childForFieldName('alias')?.text;
          imports.push({
            source: modulePath,
            specifiers: alias ? [alias] : [],
            isDefault: false,
            isNamespace: false,
            namespaceAlias: alias,
            isDynamic: false,
            lineNumber,
          });
        } else {
          imports.push({
            source: modulePath,
            specifiers: [],
            isDefault: true,
            isNamespace: false,
            isDynamic: false,
            lineNumber,
          });
        }
      }
    } else if (node.type === 'import_from_statement') {
      // from module import name1, name2
      // from module import name as alias
      // from .relative import name (relative import)
      
      // Check for relative imports (leading dots)
      let relativeDots = '';
      let moduleNameNode: SyntaxNode | null = null;
      
      // Parse children to find relative_import or module_name
      for (const child of node.children) {
        if (child.type === 'relative_import') {
          // relative_import contains both dots and module name
          // Example: ".layer_2" -> text = ".layer_2"
          const text = child.text;
          const dotsMatch = text.match(/^\.+/);
          if (dotsMatch) {
            relativeDots = dotsMatch[0];
            // Get the module name after dots
            const moduleName = text.substring(dotsMatch[0].length);
            if (moduleName) {
              // Create a synthetic node-like object for module name
              moduleNameNode = child;
            }
          }
          break;
        }
      }
      
      // If no relative_import found, check for direct module_name
      if (!moduleNameNode) {
        moduleNameNode = node.childForFieldName('module_name');
      }
      
      const importList = node.childForFieldName('name');

      // Extract module path
      let modulePath = '';
      if (relativeDots) {
        // For relative imports, extract the module name from relative_import node
        for (const child of node.children) {
          if (child.type === 'relative_import') {
            const text = child.text;
            const dotsMatch = text.match(/^\.+/);
            if (dotsMatch) {
              modulePath = text.substring(dotsMatch[0].length);
              if (modulePath) {
                modulePath = relativeDots + modulePath;
              } else {
                modulePath = relativeDots;
              }
            }
            break;
          }
        }
      } else if (moduleNameNode) {
        modulePath = this.extractDottedName(moduleNameNode);
      }

      if (importList) {
        for (const importItem of importList.children) {
          if (importItem.type === 'dotted_name' || importItem.type === 'identifier') {
            const name = importItem.text;
            imports.push({
              source: modulePath,
              specifiers: [name],
              isDefault: false,
              isNamespace: false,
              isDynamic: false,
              lineNumber,
            });
          } else if (importItem.type === 'aliased_import') {
            const nameNode = importItem.childForFieldName('name');
            const aliasNode = importItem.childForFieldName('alias');
            const name = nameNode?.text || '';
            const alias = aliasNode?.text;
            imports.push({
              source: modulePath,
              specifiers: [name],
              isDefault: false,
              isNamespace: false,
              namespaceAlias: alias,
              isDynamic: false,
              lineNumber,
            });
          }
        }
      } else {
        // from module import *
        imports.push({
          source: modulePath,
          specifiers: [],
          isDefault: false,
          isNamespace: true,
          isDynamic: false,
          lineNumber,
        });
      }
    }

    return imports;
  }

  /**
   * Extract type annotation
   */
  private extractTypeAnnotation(node: SyntaxNode): string | undefined {
    if (node.type === 'type') {
      // Type annotation node - find the actual type child
      const typeChild = node.children.find(
        (c) =>
          c.type === 'identifier' ||
          c.type === 'generic_type' ||
          c.type === 'subscript' ||
          c.type === 'attribute' ||
          c.type === 'string'
      );
      if (typeChild) {
        return this.extractTypeString(typeChild);
      }
    } else if (node.type === 'identifier') {
      return node.text;
    } else if (node.type === 'generic_type') {
      // Generic types like List[str], Dict[str, int]
      return this.extractTypeString(node);
    } else if (node.type === 'subscript') {
      // Also handle subscript for compatibility
      return this.extractTypeString(node);
    } else if (node.type === 'attribute') {
      return this.extractIdentifierOrAttribute(node);
    }

    return undefined;
  }

  /**
   * Extract type string from type node
   */
  private extractTypeString(node: SyntaxNode): string | undefined {
    if (node.type === 'identifier') {
      return node.text;
    } else if (node.type === 'generic_type') {
      // Generic types like List[str], Dict[str, int], Optional[str], etc.
      // generic_type has identifier as first child and type_parameter as second child
      const identifierNode = node.children.find((c) => c.type === 'identifier');
      const typeParamNode = node.children.find((c) => c.type === 'type_parameter');

      if (identifierNode) {
        const baseType = identifierNode.text;
        if (typeParamNode) {
          // Extract type parameters (e.g., [str, int])
          const typeParams: string[] = [];
          for (const child of typeParamNode.children) {
            if (child.type === 'type') {
              const typeStr = this.extractTypeString(child);
              if (typeStr) {
                typeParams.push(typeStr);
              }
            } else if (child.type === 'identifier') {
              typeParams.push(child.text);
            }
          }
          if (typeParams.length > 0) {
            return `${baseType}[${typeParams.join(', ')}]`;
          }
        }
        return baseType;
      }
    } else if (node.type === 'subscript') {
      // Also handle subscript for compatibility
      const valueNode = node.childForFieldName('value');
      const indexNode = node.childForFieldName('subscript');

      if (valueNode && indexNode) {
        const baseType = this.extractTypeString(valueNode);
        const indexType = this.extractTypeString(indexNode);
        if (baseType && indexType) {
          return `${baseType}[${indexType}]`;
        }
        return baseType;
      }
    } else if (node.type === 'attribute') {
      return this.extractIdentifierOrAttribute(node);
    } else if (node.type === 'string') {
      // Forward reference (e.g., 'User')
      return node.text.replace(/['"]/g, '');
    }

    return undefined;
  }

  /**
   * Extract identifier or attribute (e.g., typing.List, Optional)
   */
  private extractIdentifierOrAttribute(node: SyntaxNode): string {
    if (node.type === 'identifier') {
      return node.text;
    } else if (node.type === 'attribute') {
      const objectNode = node.childForFieldName('object');
      const attributeNode = node.childForFieldName('attribute');
      if (objectNode && attributeNode) {
        const objectName = this.extractIdentifierOrAttribute(objectNode);
        const attrName = attributeNode.text;
        return `${objectName}.${attrName}`;
      }
    }
    return node.text;
  }

  /**
   * Extract dotted name (e.g., "typing.List", "os.path")
   */
  private extractDottedName(node: SyntaxNode): string {
    const parts: string[] = [];
    this.traverseDottedName(node, parts);
    return parts.join('.');
  }

  /**
   * Traverse dotted name recursively
   */
  private traverseDottedName(node: SyntaxNode, parts: string[]): void {
    if (node.type === 'identifier') {
      parts.push(node.text);
    } else if (node.type === 'dotted_name') {
      for (const child of node.children) {
        if (child.type === 'identifier') {
          parts.push(child.text);
        } else {
          this.traverseDottedName(child, parts);
        }
      }
    } else if (node.type === 'attribute') {
      const objectNode = node.childForFieldName('object');
      const attributeNode = node.childForFieldName('attribute');
      if (objectNode) {
        this.traverseDottedName(objectNode, parts);
      }
      if (attributeNode) {
        parts.push(attributeNode.text);
      }
    }
  }

  /**
   * Get line number from node
   */
  private getLineNumber(node: SyntaxNode): number | undefined {
    return node.startPosition.row + 1; // tree-sitter uses 0-based, we use 1-based
  }

  /**
   * Extract instance variables from __init__ method
   * Looks for patterns like: self.property = value or self.property: Type = value
   */
  private extractInstanceVariablesFromInit(initNode: SyntaxNode): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const processedProperties = new Set<string>(); // Avoid duplicates
    
    // Get the function body
    const bodyNode = initNode.childForFieldName('body');
    if (!bodyNode) return properties;

    // Traverse the body to find assignments
    // Only process direct assignment nodes, not nested ones
    for (const statement of bodyNode.children) {
      if (statement.type === 'expression_statement') {
        // expression_statement contains assignment
        const assignment = statement.children.find((c) => c.type === 'assignment');
        if (assignment) {
          const prop = this.extractPropertyFromAssignment(assignment);
          if (prop && !processedProperties.has(prop.name)) {
            properties.push(prop);
            processedProperties.add(prop.name);
          }
        }
      } else if (statement.type === 'assignment') {
        // Direct assignment (less common)
        const prop = this.extractPropertyFromAssignment(statement);
        if (prop && !processedProperties.has(prop.name)) {
          properties.push(prop);
          processedProperties.add(prop.name);
        }
      }
    }

    return properties;
  }

  /**
   * Extract property information from an assignment node
   */
  private extractPropertyFromAssignment(assignmentNode: SyntaxNode): PropertyInfo | null {
    const leftNode = assignmentNode.childForFieldName('left');
    const rightNode = assignmentNode.childForFieldName('right');
    
    if (!leftNode || leftNode.type !== 'attribute') {
      return null;
    }

    const objectNode = leftNode.childForFieldName('object');
    const attributeNode = leftNode.childForFieldName('attribute');
    
    // Check if it's self.xxx
    if (!objectNode || objectNode.text !== 'self' || !attributeNode) {
      return null;
    }

    const propertyName = attributeNode.text;
    
    // Try to infer type from the right side
    let propertyType: string | undefined;
    if (rightNode) {
      propertyType = this.inferTypeFromValue(rightNode);
    }
    
    // Check if type is an array
    const isArray = propertyType ? (propertyType.endsWith('[]') || propertyType.startsWith('Array<') || propertyType === 'Array') : false;
    
    return {
      name: propertyName,
      type: propertyType,
      visibility: 'public',
      lineNumber: this.getLineNumber(assignmentNode),
      isArray,
    };
  }

  /**
   * Infer type from value node
   */
  private inferTypeFromValue(node: SyntaxNode): string | undefined {
    if (node.type === 'call') {
      // Constructor call: ClassName(args) -> type is ClassName
      const functionNode = node.childForFieldName('function');
      if (functionNode) {
        if (functionNode.type === 'identifier') {
          return functionNode.text;
        } else if (functionNode.type === 'attribute') {
          return this.extractIdentifierOrAttribute(functionNode);
        }
      }
    } else if (node.type === 'list_comprehension') {
      // List comprehension: [Wheel() for _ in range(4)] -> Wheel[]
      // Extract the expression inside the comprehension
      // The structure is: list_comprehension -> expression (the value being generated)
      for (const child of node.children) {
        if (child.type === 'call' || child.type === 'identifier' || child.type === 'attribute') {
          // This is the expression being generated
          const elementType = this.inferTypeFromValue(child);
          if (elementType && elementType !== 'list' && elementType !== 'dict') {
            return `${elementType}[]`; // Mark as array type
          }
        } else if (child.type === 'expression') {
          // Some parsers wrap the expression in an 'expression' node
          const elementType = this.inferTypeFromValue(child);
          if (elementType && elementType !== 'list' && elementType !== 'dict') {
            return `${elementType}[]`;
          }
        }
      }
      return 'list';
    } else if (node.type === 'list') {
      // Regular list literal: [item1, item2, ...]
      // Try to infer type from first element
      const firstElement = node.children.find(
        (c) => c.type !== '[' && c.type !== ']' && c.type !== ','
      );
      if (firstElement) {
        const elementType = this.inferTypeFromValue(firstElement);
        if (elementType && elementType !== 'list' && elementType !== 'dict') {
          return `${elementType}[]`; // Mark as array type
        }
      }
      return 'list';
    } else if (node.type === 'identifier') {
      return node.text;
    } else if (node.type === 'string') {
      return 'str';
    } else if (node.type === 'integer' || node.type === 'float') {
      return 'int';
    } else if (node.type === 'dictionary') {
      return 'dict';
    }
    
    return undefined;
  }
}
