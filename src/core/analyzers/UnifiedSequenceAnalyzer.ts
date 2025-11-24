/**
 * Unified Sequence Analysis Service
 * Analyzes class interactions and method calls for sequence diagrams
 * Supports UnifiedAST (Java, Python, etc.) with tree-sitter AST
 */

import type { SyntaxNode } from 'tree-sitter';
import Parser from 'tree-sitter';
import type { UnifiedAST } from '../types/index.js';
import type {
  SequenceParticipant,
  SequenceInteraction,
  SequenceAnalysisResult,
} from './SequenceAnalyzer.js';

/**
 * Unified Sequence Analysis Service for extracting class interactions from UnifiedAST
 */
export class UnifiedSequenceAnalyzer {
  private participants: Map<string, SequenceParticipant> = new Map();
  private interactions: SequenceInteraction[] = [];
  private classes: Map<string, Set<string>> = new Map(); // className -> methods
  private topLevelFunctions: Set<string> = new Set(); // Top-level function names
  private propertyTypes: Map<string, string> = new Map(); // propertyName -> className
  private importedClasses: Set<string> = new Set(); // Imported class names
  private classStack: string[] = []; // Stack to track nested classes
  private methodStack: string[] = []; // Stack to track nested methods
  private entryPoints: Set<string> = new Set();

  private get currentClass(): string | null {
    return this.classStack.length > 0 ? this.classStack[this.classStack.length - 1] : null;
  }

  private get currentMethod(): string | null {
    return this.methodStack.length > 0 ? this.methodStack[this.methodStack.length - 1] : null;
  }

  /**
   * Analyze UnifiedAST and extract sequence diagram information
   */
  analyze(ast: UnifiedAST): SequenceAnalysisResult {
    // Reset state
    this.participants.clear();
    this.interactions = [];
    this.classes.clear();
    this.topLevelFunctions.clear();
    this.propertyTypes.clear();
    this.importedClasses.clear();
    this.classStack = [];
    this.methodStack = [];
    this.entryPoints.clear();

    // First pass: identify imports, classes and top-level functions from UnifiedAST
    this.identifyImportsClassesAndFunctions(ast);

    // If no classes and no top-level functions found, add a "Module" participant as fallback
    if (this.classes.size === 0 && this.topLevelFunctions.size === 0) {
      this.addParticipant('Module', 'module');
    }

    // Second pass: track property assignments from UnifiedAST
    this.trackPropertyAssignments(ast);

    // Third pass: analyze method calls from original AST if available
    if (ast.originalAST) {
      this.analyzeMethodCallsFromTreeSitter(ast.originalAST as Parser.Tree, ast.language);
    } else {
      // Fallback: infer interactions from class structure
      this.inferInteractionsFromStructure(ast);
    }

    return {
      participants: Array.from(this.participants.values()),
      interactions: this.interactions,
      entryPoints: Array.from(this.entryPoints),
    };
  }

  /**
   * First pass: identify imports, classes, their methods, and top-level functions from UnifiedAST
   */
  private identifyImportsClassesAndFunctions(ast: UnifiedAST): void {
    // Track imports
    for (const importInfo of ast.imports) {
      for (const specifier of importInfo.specifiers) {
        this.importedClasses.add(specifier);
      }
    }

    // Track classes and their methods
    for (const classInfo of ast.classes) {
      this.classes.set(classInfo.name, new Set());
      this.addParticipant(classInfo.name, 'class', classInfo.lineNumber);

      // Extract methods
      for (const method of classInfo.methods) {
        this.classes.get(classInfo.name)?.add(method.name);
      }
    }

    // Track interfaces (treat as classes for sequence diagram)
    for (const interfaceInfo of ast.interfaces) {
      this.classes.set(interfaceInfo.name, new Set());
      this.addParticipant(interfaceInfo.name, 'class', interfaceInfo.lineNumber);

      for (const method of interfaceInfo.methods) {
        this.classes.get(interfaceInfo.name)?.add(method.name);
      }
    }

    // Track top-level functions
    for (const functionInfo of ast.functions) {
      this.topLevelFunctions.add(functionInfo.name);
      this.addParticipant(functionInfo.name, 'function', functionInfo.lineNumber);
    }
  }

  /**
   * Second pass: track property assignments from UnifiedAST
   */
  private trackPropertyAssignments(ast: UnifiedAST): void {
    for (const classInfo of ast.classes) {
      // Track constructor parameters
      if (classInfo.constructorParams) {
        for (const param of classInfo.constructorParams) {
          if (param.type && this.isClassType(param.type)) {
            // Infer property assignment from constructor parameter
            // This is a heuristic: if constructor has a parameter of type T,
            // we assume it might be assigned to a property
            const propertyName = param.name;
            const className = this.extractClassName(param.type);
            if (className) {
              this.propertyTypes.set(propertyName, className);
            }
          }
        }
      }

      // Track class properties
      for (const property of classInfo.properties) {
        if (property.type && this.isClassType(property.type)) {
          const className = this.extractClassName(property.type);
          if (className) {
            this.propertyTypes.set(property.name, className);
          }
        }
      }
    }
  }

  /**
   * Third pass: analyze method calls from tree-sitter AST
   */
  private analyzeMethodCallsFromTreeSitter(tree: Parser.Tree, language: string): void {
    const rootNode = tree.rootNode;
    
    if (language === 'java') {
      this.analyzeJavaMethodCalls(rootNode);
    } else if (language === 'python') {
      this.analyzePythonMethodCalls(rootNode);
    }
  }

  /**
   * Analyze Java method calls from tree-sitter AST
   */
  private analyzeJavaMethodCalls(rootNode: SyntaxNode): void {
    this.traverseTreeSitterWithContext(rootNode, {
      enter: (node) => {
        // Track current class and method context
        if (node.type === 'class_declaration') {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            this.classStack.push(nameNode.text);
          }
        }

        if (node.type === 'method_declaration' || node.type === 'constructor_declaration') {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            this.methodStack.push(nameNode.text);
            
            // Mark as entry point if it's a public method
            if (this.currentClass && this.isPublicMethod(node)) {
              this.entryPoints.add(`${this.currentClass}.${nameNode.text}`);
            }
          }
        }

        // Analyze method invocations
        if (node.type === 'method_invocation') {
          this.analyzeJavaMethodInvocation(node);
        }
      },
      exit: (node) => {
        // Reset context when exiting method/constructor/class
        if (node.type === 'method_declaration' || node.type === 'constructor_declaration') {
          this.methodStack.pop();
        }
        if (node.type === 'class_declaration') {
          this.classStack.pop();
        }
      },
    });
  }

  /**
   * Analyze Python method calls from tree-sitter AST
   */
  private analyzePythonMethodCalls(rootNode: SyntaxNode): void {
    this.traverseTreeSitterWithContext(rootNode, {
      enter: (node) => {
        // Track current class and method context
        if (node.type === 'class_definition') {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            this.classStack.push(nameNode.text);
          }
        }

        if (node.type === 'function_definition') {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            this.methodStack.push(nameNode.text);
            
            // Check if it's a top-level function or class method
            const isTopLevel = this.isTopLevelFunction(node, rootNode);
            if (isTopLevel && this.classStack.length === 0) {
              this.classStack.push(nameNode.text);
              this.entryPoints.add(nameNode.text);
            } else if (this.currentClass) {
              this.entryPoints.add(`${this.currentClass}.${nameNode.text}`);
            }
          }
        }

        // Analyze function calls
        if (node.type === 'call') {
          this.analyzePythonCall(node);
        }
      },
      exit: (node) => {
        // Reset context when exiting function/class
        if (node.type === 'function_definition') {
          this.methodStack.pop();
          // If it was a top-level function, also pop from class stack
          if (this.classStack.length > 0 && this.classStack[this.classStack.length - 1] === node.childForFieldName('name')?.text) {
            this.classStack.pop();
          }
        }
        if (node.type === 'class_definition') {
          this.classStack.pop();
        }
      },
    });
  }

  /**
   * Analyze Java method invocation
   */
  private analyzeJavaMethodInvocation(node: SyntaxNode): void {
    if (!this.currentClass || !this.currentMethod) return;

    // Extract method name
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    let methodName = nameNode.text;

    // Extract object (the thing being called on)
    const objectNode = node.childForFieldName('object');
    let targetClass: string | null = null;

    // Case 5: new ClassName() - constructor call (check parent first)
    const parent = node.parent;
    if (parent && parent.type === 'object_creation_expression') {
      const typeNode = parent.childForFieldName('type');
      if (typeNode) {
        targetClass = this.extractTypeName(typeNode);
        methodName = 'constructor';
      }
    }

    if (!targetClass) {
      if (objectNode) {
        // Case 1: this.method() - same class
        if (objectNode.text === 'this') {
          targetClass = this.currentClass;
        } else {
          // Case 2: obj.method() - need to resolve obj's type
          const objectName = this.extractIdentifier(objectNode);
          if (objectName) {
            targetClass = this.findClassForObject(objectName);
          }
        }
      } else {
        // Case 3: method() - might be a static call or same class method
        // Check if it's a known method in current class
        if (this.classes.has(this.currentClass) && 
            this.classes.get(this.currentClass)?.has(methodName)) {
          targetClass = this.currentClass;
        }
      }

      // Case 4: ClassName.method() - static method call
      if (!targetClass && objectNode) {
        const className = this.extractClassNameFromExpression(objectNode);
        if (className && this.classes.has(className)) {
          targetClass = className;
        }
      }
    }

    if (!targetClass) {
      // Try to infer from method name or skip
      return;
    }

    // Skip built-in methods
    if (this.isBuiltInMethod(targetClass, methodName)) {
      return;
    }

    // Add target class as participant if not already present
    if (!this.participants.has(targetClass)) {
      const participantType = this.topLevelFunctions.has(targetClass) ? 'function' : 'class';
      this.addParticipant(targetClass, participantType);
    }

    // Extract arguments for message
    const argsNode = node.childForFieldName('arguments');
    const args = argsNode ? this.extractArguments(argsNode) : '';

    // Create interaction
    const message = args ? `${methodName}(${args})` : `${methodName}()`;
    this.addInteraction(
      this.currentClass,
      targetClass,
      message,
      'sync',
      this.getLineNumber(node)
    );

    // Add return interaction
    this.addInteraction(targetClass, this.currentClass, 'return', 'return', this.getLineNumber(node));
  }

  /**
   * Analyze Python function call
   */
  private analyzePythonCall(node: SyntaxNode): void {
    if (!this.currentClass) return;

    // Extract function name
    const functionNode = node.childForFieldName('function');
    if (!functionNode) return;

    let targetClass: string | null = null;
    let methodName: string | null = null;

    // Check different call patterns
    if (functionNode.type === 'attribute') {
      // Case 1: obj.method() - attribute access
      const objectNode = functionNode.childForFieldName('object');
      const attributeNode = functionNode.childForFieldName('attribute');

      if (objectNode && attributeNode) {
        methodName = attributeNode.text;

        // Check if it's self.method()
        if (objectNode.text === 'self') {
          targetClass = this.currentClass;
        } else {
          // Resolve object type
          const objectName = this.extractIdentifier(objectNode);
          if (objectName) {
            targetClass = this.findClassForObject(objectName);
          }
        }
      }
    } else if (functionNode.type === 'identifier') {
      // Case 2: method() - might be same class method or top-level function
      methodName = functionNode.text;

      // Check if it's a method in current class
      if (this.classes.has(this.currentClass) && 
          this.classes.get(this.currentClass)?.has(methodName)) {
        targetClass = this.currentClass;
      } else if (this.topLevelFunctions.has(methodName)) {
        targetClass = methodName;
      }
    }

    // If we couldn't determine method name or target class, skip
    if (!methodName || !targetClass) {
      return;
    }

    // Skip built-in methods
    if (this.isBuiltInMethod(targetClass, methodName)) {
      return;
    }

    // Add target class/function as participant if not already present
    if (!this.participants.has(targetClass)) {
      const participantType = this.topLevelFunctions.has(targetClass) ? 'function' : 'class';
      this.addParticipant(targetClass, participantType);
    }

    // Extract arguments
    const argsNode = node.childForFieldName('arguments');
    const args = argsNode ? this.extractPythonArguments(argsNode) : '';

    // Create interaction
    const message = args ? `${methodName}(${args})` : `${methodName}()`;
    this.addInteraction(
      this.currentClass,
      targetClass,
      message,
      'sync',
      this.getLineNumber(node)
    );

    // Add return interaction
    this.addInteraction(targetClass, this.currentClass, 'return', 'return', this.getLineNumber(node));
  }

  /**
   * Infer interactions from class structure (fallback when no original AST)
   */
  private inferInteractionsFromStructure(ast: UnifiedAST): void {
    // This is a simplified fallback that infers interactions from:
    // 1. Constructor parameters (dependency injection)
    // 2. Method parameters (usage)
    
    for (const classInfo of ast.classes) {
      // Mark public methods as entry points
      for (const method of classInfo.methods) {
        if (method.visibility === 'public' && !method.isStatic) {
          this.entryPoints.add(`${classInfo.name}.${method.name}`);
        }
      }

      // Infer interactions from constructor parameters
      if (classInfo.constructorParams) {
        for (const param of classInfo.constructorParams) {
          if (param.type && this.isClassType(param.type)) {
            const targetClass = this.extractClassName(param.type);
            if (targetClass && this.classes.has(targetClass)) {
              this.addInteraction(
                classInfo.name,
                targetClass,
                'constructor',
                'sync'
              );
            }
          }
        }
      }

      // Infer interactions from method parameters
      for (const method of classInfo.methods) {
        for (const param of method.parameters) {
          if (param.type && this.isClassType(param.type)) {
            const targetClass = this.extractClassName(param.type);
            if (targetClass && this.classes.has(targetClass)) {
              this.addInteraction(
                classInfo.name,
                targetClass,
                method.name,
                'sync'
              );
            }
          }
        }
      }
    }
  }

  /**
   * Traverse tree-sitter AST with enter/exit callbacks
   */
  private traverseTreeSitterWithContext(
    node: SyntaxNode,
    callbacks: {
      enter?: (node: SyntaxNode) => void;
      exit?: (node: SyntaxNode) => void;
    }
  ): void {
    if (callbacks.enter) {
      callbacks.enter(node);
    }
    for (const child of node.children) {
      this.traverseTreeSitterWithContext(child, callbacks);
    }
    if (callbacks.exit) {
      callbacks.exit(node);
    }
  }

  /**
   * Extract identifier from node
   */
  private extractIdentifier(node: SyntaxNode): string | null {
    if (node.type === 'identifier') {
      return node.text;
    }
    // Try to find identifier in children
    for (const child of node.children) {
      if (child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }

  /**
   * Extract class name from type expression
   */
  private extractClassNameFromExpression(node: SyntaxNode): string | null {
    if (node.type === 'type_identifier' || node.type === 'identifier') {
      return node.text;
    }
    // For scoped identifiers (e.g., java.util.List)
    if (node.type === 'scoped_type_identifier' || node.type === 'scoped_identifier') {
      // Return the last part (class name)
      const parts = node.text.split('.');
      return parts[parts.length - 1];
    }
    return null;
  }

  /**
   * Extract type name from type node (Java)
   */
  private extractTypeName(node: SyntaxNode): string | null {
    if (node.type === 'type_identifier') {
      return node.text;
    }
    if (node.type === 'scoped_type_identifier') {
      const parts = node.text.split('.');
      return parts[parts.length - 1];
    }
    if (node.type === 'generic_type') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        return this.extractTypeName(nameNode);
      }
    }
    return null;
  }

  /**
   * Extract arguments from arguments node (Java)
   */
  private extractArguments(node: SyntaxNode): string {
    const args: string[] = [];
    for (const child of node.children) {
      if (child.type === 'expression' || child.type === 'identifier' || child.type === 'literal') {
        args.push(child.text);
      }
    }
    return args.join(', ');
  }

  /**
   * Extract arguments from arguments node (Python)
   */
  private extractPythonArguments(node: SyntaxNode): string {
    const args: string[] = [];
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'string' || child.type === 'integer' || 
          child.type === 'float' || child.type === 'true' || child.type === 'false' ||
          child.type === 'none') {
        args.push(child.text);
      }
    }
    return args.join(', ');
  }

  /**
   * Check if method is public (Java)
   */
  private isPublicMethod(node: SyntaxNode): boolean {
    for (const child of node.children) {
      if (child.type === 'modifiers') {
        for (const modifier of child.children) {
          if (modifier.type === 'public') {
            return true;
          }
        }
      } else if (child.type === 'public') {
        return true;
      }
    }
    return false; // Default to false for Java (package-private)
  }

  /**
   * Check if function is top-level (Python)
   */
  private isTopLevelFunction(node: SyntaxNode, rootNode: SyntaxNode): boolean {
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
   * Extract class name from type string
   */
  private extractClassName(typeString: string): string | null {
    // Remove array brackets and generic parameters
    const baseType = typeString.replace(/\[\]/g, '').replace(/<.*>/g, '').trim();
    
    // For scoped types (e.g., java.util.List), return the last part
    const parts = baseType.split('.');
    return parts[parts.length - 1];
  }

  /**
   * Check if type is a class type (not primitive)
   */
  private isClassType(typeString: string): boolean {
    const primitives = new Set([
      'int', 'long', 'short', 'byte', 'char', 'float', 'double', 'boolean', 'void',
      'str', 'int', 'float', 'bool', 'None', 'list', 'dict', 'tuple', 'set',
      'string', 'number', 'boolean', 'null', 'undefined', 'void', 'any',
    ]);
    
    const baseType = typeString.replace(/\[\]/g, '').replace(/<.*>/g, '').trim().toLowerCase();
    return !primitives.has(baseType);
  }

  /**
   * Try to find the class type of an object variable
   */
  private findClassForObject(objectName: string): string | null {
    // First, check if we tracked this property assignment
    if (this.propertyTypes.has(objectName)) {
      return this.propertyTypes.get(objectName)!;
    }

    // Check if it's a known class name (capitalized)
    if (objectName[0] === objectName[0].toUpperCase() && this.classes.has(objectName)) {
      return objectName;
    }

    return null;
  }

  /**
   * Check if a method call is on a built-in type
   */
  private isBuiltInMethod(targetClass: string, _methodName: string): boolean {
    // Don't filter out known user-defined classes
    if (this.classes.has(targetClass) || this.importedClasses.has(targetClass) || 
        this.topLevelFunctions.has(targetClass)) {
      return false;
    }

    // Common built-in type names
    const builtInTypeNames = new Set([
      'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character',
      'List', 'ArrayList', 'LinkedList', 'Map', 'HashMap', 'Set', 'HashSet',
      'str', 'int', 'float', 'bool', 'list', 'dict', 'tuple', 'set',
      'Array', 'Object', 'console', 'Math', 'JSON', 'Date', 'RegExp',
    ]);

    if (builtInTypeNames.has(targetClass)) {
      return true;
    }

    // Filter out single-letter variable names
    if (targetClass.length === 1) {
      return true;
    }

    return false;
  }

  /**
   * Get line number from node
   */
  private getLineNumber(node: SyntaxNode): number | undefined {
    return node.startPosition.row + 1; // tree-sitter uses 0-based, we use 1-based
  }

  /**
   * Add a participant to the map
   */
  private addParticipant(
    name: string,
    type: 'class' | 'function' | 'module',
    lineNumber?: number
  ): void {
    if (!this.participants.has(name)) {
      this.participants.set(name, { name, type, lineNumber });
    }
  }

  /**
   * Add an interaction to the list
   */
  private addInteraction(
    from: string,
    to: string,
    message: string,
    type: 'sync' | 'async' | 'return',
    lineNumber?: number
  ): void {
    this.interactions.push({
      from,
      to,
      message,
      type,
      lineNumber,
    });
  }
}

