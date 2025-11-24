/**
 * Sequence Analysis Service
 * Analyzes class interactions and method calls for sequence diagrams
 * Participants are classes/objects, messages are method calls
 *
 * This analyzer is platform-agnostic and works with parsed AST data.
 */

import * as t from '@babel/types';
import traverseModule from '@babel/traverse';

// Correct way to import @babel/traverse
const traverse = (traverseModule as any).default || traverseModule;

/**
 * Represents a participant in the sequence diagram (class, function, or module)
 */
export interface SequenceParticipant {
  name: string;
  type: 'class' | 'function' | 'module'; // Classes are objects, function is for top-level functions, module is fallback
  lineNumber?: number;
}

/**
 * Represents an interaction/message in the sequence diagram
 */
export interface SequenceInteraction {
  from: string; // Calling class/module
  to: string; // Called class/module
  message: string; // Method name with arguments
  type: 'sync' | 'async' | 'return';
  lineNumber?: number;
}

/**
 * Result of sequence analysis
 */
export interface SequenceAnalysisResult {
  participants: SequenceParticipant[];
  interactions: SequenceInteraction[];
  entryPoints: string[]; // Entry point methods
}

/**
 * Sequence Analysis Service for extracting class interactions
 */
export class SequenceAnalyzer {
  private participants: Map<string, SequenceParticipant> = new Map();
  private interactions: SequenceInteraction[] = [];
  private classes: Map<string, Set<string>> = new Map(); // className -> methods
  private topLevelFunctions: Set<string> = new Set(); // Top-level function names
  private propertyTypes: Map<string, string> = new Map(); // propertyName -> className (for tracking this.prop = new Class())
  private importedClasses: Set<string> = new Set(); // Imported class names from other files
  private currentClass: string | null = null; // Current class/function being analyzed
  private currentMethod: string | null = null; // Current method being analyzed
  private entryPoints: Set<string> = new Set();

  /**
   * Analyze AST and extract sequence diagram information
   */
  analyze(ast: t.File): SequenceAnalysisResult {
    // Reset state
    this.participants.clear();
    this.interactions = [];
    this.classes.clear();
    this.topLevelFunctions.clear();
    this.propertyTypes.clear();
    this.importedClasses.clear();
    this.currentClass = null;
    this.currentMethod = null;
    this.entryPoints.clear();

    // First pass: identify imports, classes and top-level functions
    this.identifyImportsClassesAndFunctions(ast);

    // If no classes and no top-level functions found, add a "Module" participant as fallback
    if (this.classes.size === 0 && this.topLevelFunctions.size === 0) {
      this.addParticipant('Module', 'module');
    }

    // Second pass: track property assignments (this.prop = new Class())
    this.trackPropertyAssignments(ast);

    // Third pass: analyze method calls and interactions
    this.analyzeMethodCalls(ast);

    return {
      participants: Array.from(this.participants.values()),
      interactions: this.interactions,
      entryPoints: Array.from(this.entryPoints),
    };
  }

  /**
   * First pass: identify imports, classes, their methods, and top-level functions
   */
  private identifyImportsClassesAndFunctions(ast: t.File): void {
    traverse(ast, {
      // Track imports to detect imported classes
      ImportDeclaration: (path: any) => {
        const node = path.node as t.ImportDeclaration;
        // Extract imported class names
        node.specifiers.forEach((specifier) => {
          if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
            // Named import: import { ClassName } from '...'
            this.importedClasses.add(specifier.imported.name);
          } else if (t.isImportDefaultSpecifier(specifier) && t.isIdentifier(specifier.local)) {
            // Default import: import ClassName from '...'
            this.importedClasses.add(specifier.local.name);
          }
        });
      },
      ClassDeclaration: (path: any) => {
        const node = path.node as t.ClassDeclaration;
        if (node.id) {
          const className = node.id.name;
          this.classes.set(className, new Set());
          this.addParticipant(className, 'class', node.loc?.start.line);

          // Extract methods
          node.body.body.forEach((member) => {
            if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
              this.classes.get(className)?.add(member.key.name);
            }
          });
        }
      },
      FunctionDeclaration: (path: any) => {
        const node = path.node as t.FunctionDeclaration;
        // Only process top-level functions (not nested in classes)
        // Check if function is at program level
        const isTopLevel = path.parent.type === 'Program' || path.getFunctionParent() === null;
        if (node.id && isTopLevel) {
          const functionName = node.id.name;
          this.topLevelFunctions.add(functionName);
          this.addParticipant(functionName, 'function', node.loc?.start.line);
        }
      },
    });
  }

  /**
   * Second pass: track property and variable assignments to infer types
   * e.g., this.db = new Database() => propertyTypes.set('db', 'Database')
   * e.g., const db = new Database() => propertyTypes.set('db', 'Database')
   * e.g., constructor(db: Database) { this.db = db; } => propertyTypes.set('db', 'Database')
   */
  private trackPropertyAssignments(ast: t.File): void {
    traverse(ast, {
      // Track constructor parameters and their assignments
      ClassMethod: (path: any) => {
        const node = path.node as t.ClassMethod;

        // Check if this is a constructor
        if (t.isIdentifier(node.key) && node.key.name === 'constructor') {
          // Build a map of parameter names to their types
          const paramTypes = new Map<string, string>();

          node.params.forEach((param) => {
            if (t.isTSParameterProperty(param)) {
              const parameter = param.parameter;
              if (
                t.isIdentifier(parameter) &&
                parameter.typeAnnotation &&
                t.isTSTypeAnnotation(parameter.typeAnnotation)
              ) {
                const paramName = parameter.name;
                const typeNode = parameter.typeAnnotation.typeAnnotation;

                // Extract type name from TypeScript type annotation
                if (t.isTSTypeReference(typeNode) && t.isIdentifier(typeNode.typeName)) {
                  // Implicit assignment for parameter properties: this.paramName = paramName
                  this.propertyTypes.set(paramName, typeNode.typeName.name);
                  console.log(`[SequenceAnalyzer] Tracked property (TSParameterProperty): ${paramName} -> ${typeNode.typeName.name}`);
                }
              }
            }

            if (
              t.isIdentifier(param) &&
              param.typeAnnotation &&
              t.isTSTypeAnnotation(param.typeAnnotation)
            ) {
              const paramName = param.name;
              const typeNode = param.typeAnnotation.typeAnnotation;

              // Extract type name from TypeScript type annotation
              if (t.isTSTypeReference(typeNode) && t.isIdentifier(typeNode.typeName)) {
                paramTypes.set(paramName, typeNode.typeName.name);
                console.log(`[SequenceAnalyzer] Tracked param type: ${paramName} -> ${typeNode.typeName.name}`);
              }
            }
          });

          // Now look for assignments like: this.property = paramName
          if (node.body && t.isBlockStatement(node.body)) {
            node.body.body.forEach((statement) => {
              if (
                t.isExpressionStatement(statement) &&
                t.isAssignmentExpression(statement.expression)
              ) {
                const assignment = statement.expression;

                // Check for: this.property = paramName
                if (
                  t.isMemberExpression(assignment.left) &&
                  t.isThisExpression(assignment.left.object) &&
                  t.isIdentifier(assignment.left.property) &&
                  t.isIdentifier(assignment.right)
                ) {
                  const propertyName = assignment.left.property.name;
                  const paramName = assignment.right.name;

                  // If the param has a type annotation, track it
                  if (paramTypes.has(paramName)) {
                    this.propertyTypes.set(propertyName, paramTypes.get(paramName)!);
                  }
                }
              }
            });
          }
        }
      },

      // Track class property declarations: db: Database
      ClassProperty: (path: any) => {
        const node = path.node as t.ClassProperty;
        if (
          t.isIdentifier(node.key) &&
          node.typeAnnotation &&
          t.isTSTypeAnnotation(node.typeAnnotation)
        ) {
          const propertyName = node.key.name;
          const typeNode = node.typeAnnotation.typeAnnotation;

          if (t.isTSTypeReference(typeNode) && t.isIdentifier(typeNode.typeName)) {
            this.propertyTypes.set(propertyName, typeNode.typeName.name);
          }
        }
      },

      // Track: this.property = new ClassName()
      AssignmentExpression: (path: any) => {
        const node = path.node as t.AssignmentExpression;

        if (
          t.isMemberExpression(node.left) &&
          t.isThisExpression(node.left.object) &&
          t.isIdentifier(node.left.property) &&
          t.isNewExpression(node.right) &&
          t.isIdentifier(node.right.callee)
        ) {
          const propertyName = node.left.property.name;
          const className = node.right.callee.name;

          // Track the type even if class is imported (not in this.classes)
          // We'll validate it later when creating participants
          this.propertyTypes.set(propertyName, className);
        }
      },

      // Track: const/let/var variable = new ClassName()
      VariableDeclarator: (path: any) => {
        const node = path.node as t.VariableDeclarator;

        if (
          t.isIdentifier(node.id) &&
          node.init &&
          t.isNewExpression(node.init) &&
          t.isIdentifier(node.init.callee)
        ) {
          const variableName = node.id.name;
          const className = node.init.callee.name;

          // Track the type even if class is imported (not in this.classes)
          // We'll validate it later when creating participants
          this.propertyTypes.set(variableName, className);
        }
      },
    });
  }

  /**
   * Third pass: analyze method calls between classes
   */
  private analyzeMethodCalls(ast: t.File): void {
    traverse(ast, {
      // Track class methods
      ClassMethod: {
        enter: (path: any) => {
          const node = path.node as t.ClassMethod;
          const classPath = path.findParent((p: any) => p.isClassDeclaration());

          if (classPath && t.isClassDeclaration(classPath.node) && classPath.node.id) {
            this.currentClass = classPath.node.id.name;
            this.currentMethod = t.isIdentifier(node.key) ? node.key.name : null;

            // Mark as entry point if it's a public method
            if (this.currentMethod && node.kind === 'method') {
              this.entryPoints.add(`${this.currentClass}.${this.currentMethod}`);
            }
          }
        },
        exit: () => {
          this.currentClass = null;
          this.currentMethod = null;
        },
      },

      // Track top-level functions
      FunctionDeclaration: {
        enter: (path: any) => {
          const node = path.node as t.FunctionDeclaration;
          // Only process top-level functions (when there are no classes)
          // Check if function is at program level (not nested in other functions or classes)
          const isTopLevel = path.parent.type === 'Program' || path.getFunctionParent() === null;
          if (this.classes.size === 0 && node.id && isTopLevel) {
            this.currentClass = node.id.name; // Use function name as "class"
            this.currentMethod = null; // Top-level, not a method
            this.entryPoints.add(node.id.name);
          }
        },
        exit: (path: any) => {
          const node = path.node as t.FunctionDeclaration;
          const isTopLevel = path.parent.type === 'Program' || path.getFunctionParent() === null;
          if (
            this.classes.size === 0 &&
            node.id &&
            isTopLevel &&
            this.currentClass === node.id.name
          ) {
            this.currentClass = null;
            this.currentMethod = null;
          }
        },
      },

      // Analyze function/method calls
      CallExpression: (path: any) => {
        const node = path.node as t.CallExpression;
        if (this.currentClass && this.currentMethod) {
          // Class method calls
          this.analyzeCallExpression(node, false);
        } else if (this.currentClass && this.classes.size === 0) {
          // Top-level function calls (currentMethod is null for top-level functions)
          this.analyzeCallExpression(node, false);
        }
      },

      // Analyze await expressions (async calls)
      AwaitExpression: (path: any) => {
        const node = path.node as t.AwaitExpression;
        if (t.isCallExpression(node.argument)) {
          if (this.currentClass && this.currentMethod) {
            // Class method async calls
            this.analyzeCallExpression(node.argument, true);
          } else if (this.currentClass && this.classes.size === 0) {
            // Top-level async function calls
            this.analyzeCallExpression(node.argument, true);
          }
        }
      },

      // Analyze new expressions (constructor calls)
      NewExpression: (path: any) => {
        const node = path.node as t.NewExpression;
        if (this.currentClass && this.currentMethod) {
          // Class method constructor calls
          this.analyzeCallExpression(node as any, false);
        } else if (this.currentClass && this.classes.size === 0) {
          // Top-level constructor calls
          this.analyzeCallExpression(node as any, false);
        }
      },
    });
  }

  /**
   * Analyze a call expression and record the interaction
   */
  private analyzeCallExpression(node: t.CallExpression | t.NewExpression, isAsync: boolean): void {
    // For classes, we need both currentClass and currentMethod
    // For top-level functions, we only need currentClass (currentMethod is null)
    if (!this.currentClass) return;
    if (this.classes.size > 0 && !this.currentMethod) return; // In class mode, must have a method

    // For NewExpression, we pass the node itself because getCallInfo expects it for Case 4
    // For CallExpression, we pass the callee
    const expressionToAnalyze = t.isNewExpression(node) ? node : node.callee;
    const callInfo = this.getCallInfo(expressionToAnalyze);
    if (!callInfo) {
      // console.log(`[SequenceAnalyzer] getCallInfo returned null for callee type: ${node.callee.type}`);
      return;
    }

    const { targetClass, methodName } = callInfo;
    // console.log(`[SequenceAnalyzer] Analyzing call: ${targetClass}.${methodName}`);

    // Skip built-in methods on built-in types (Array, Map, Set, etc.)
    if (this.isBuiltInMethod(targetClass, methodName)) {
      // console.log(`[SequenceAnalyzer] Skipped built-in method: ${targetClass}.${methodName}`);
      return;
    }

    // Add target class/function as participant if not already present
    if (!this.participants.has(targetClass)) {
      const participantType = this.topLevelFunctions.has(targetClass) ? 'function' : 'class';
      this.addParticipant(targetClass, participantType, node.loc?.start.line);
      // console.log(`[SequenceAnalyzer] Added participant: ${targetClass}`);
    }

    // Create interaction message (method call)
    const args = node.arguments ? node.arguments.map((arg) => this.getExpressionLabel(arg)).join(', ') : '';
    const message = args ? `${methodName}(${args})` : `${methodName}()`;

    const interactionType = isAsync ? 'async' : 'sync';

    // Add interaction from current class to target class
    this.addInteraction(
      this.currentClass,
      targetClass,
      message,
      interactionType,
      node.loc?.start.line
    );

    // Add return interaction
    this.addInteraction(targetClass, this.currentClass, 'return', 'return', node.loc?.start.line);
  }

  /**
   * Get call information (target class and method name)
   */
  private getCallInfo(
    callee: t.Expression | t.V8IntrinsicIdentifier | t.NewExpression
  ): { targetClass: string; methodName: string } | null {
    // Case 1: this.method() - call within same class
    if (t.isMemberExpression(callee)) {
      if (t.isThisExpression(callee.object)) {
        // this.method() - stays in same class
        if (t.isIdentifier(callee.property)) {
          return {
            targetClass: this.currentClass!,
            methodName: callee.property.name,
          };
        }
      } else if (t.isMemberExpression(callee.object)) {
        // this.property.method() - chained member expression
        // e.g., this.db.query()
        if (t.isThisExpression(callee.object.object) && t.isIdentifier(callee.object.property)) {
          const propertyName = callee.object.property.name;
          const methodName = t.isIdentifier(callee.property) ? callee.property.name : 'method';

          // Try to find the class of this property
          const targetClass = this.findClassForObject(propertyName);

          // If we can resolve to a known class (local, imported, or tracked property), use it
          if (targetClass) {
            return {
              targetClass,
              methodName,
            };
          }

          // Otherwise, use property name if it looks like a class name (starts with uppercase)
          // This will be filtered later by isBuiltInMethod if it's a built-in type
          if (propertyName[0] === propertyName[0].toUpperCase()) {
            return {
              targetClass: propertyName,
              methodName,
            };
          }

          // Lowercase property name - likely not a class, skip
          return null;
        } else if (
          t.isMemberExpression(callee.object.object) &&
          t.isThisExpression(callee.object.object.object) &&
          t.isIdentifier(callee.object.object.property)
        ) {
          // this.prop1.prop2.method() - depth 3
          // e.g. this.db.connection.execute()
          const propertyName = callee.object.object.property.name; // 'db'
          const methodName = t.isIdentifier(callee.property) ? callee.property.name : 'method';

          // Try to find the class of this property
          const targetClass = this.findClassForObject(propertyName);

          if (targetClass) {
            return {
              targetClass,
              methodName,
            };
          }
        }
      } else if (t.isIdentifier(callee.object)) {
        // someObject.method() - call to another class instance
        const objectName = callee.object.name;
        const methodName = t.isIdentifier(callee.property) ? callee.property.name : 'method';

        // Try to find the class of this object
        const targetClass = this.findClassForObject(objectName);

        // If we can resolve to a known class (local, imported, or tracked property), use it
        if (targetClass) {
          return {
            targetClass,
            methodName,
          };
        }

        // Otherwise, use object name if it looks like a class name (starts with uppercase)
        // This will be filtered later by isBuiltInMethod if it's a built-in type
        if (objectName[0] === objectName[0].toUpperCase()) {
          return {
            targetClass: objectName,
            methodName,
          };
        }

        // Lowercase object name - likely not a class, skip
        return null;
      }
    }

    // Case 2: ClassName.staticMethod() - static method call
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.object)) {
      const className = callee.object.name;
      const methodName = t.isIdentifier(callee.property) ? callee.property.name : 'method';

      // Check if this is a known class
      if (this.classes.has(className)) {
        return {
          targetClass: className,
          methodName,
        };
      }
    }

    // Case 3: functionName() - top-level function call
    if (t.isIdentifier(callee) && this.classes.size === 0) {
      // If this is a known top-level function, use it as the target
      if (this.topLevelFunctions.has(callee.name)) {
        return {
          targetClass: callee.name,
          methodName: callee.name, // For top-level functions, the function name is both the class and method
        };
      }
      // Fallback to Module if not a known function
      return {
        targetClass: 'Module',
        methodName: callee.name,
      };
    }

    // Case 4: new ClassName() - constructor call
    if (t.isNewExpression(callee) && t.isIdentifier(callee.callee)) {
      return {
        targetClass: callee.callee.name,
        methodName: 'constructor',
      };
    }

    return null;
  }

  /**
   * Check if a method call is on a built-in type
   * Returns true for built-in JavaScript/TypeScript types and their methods
   */
  private isBuiltInMethod(targetClass: string, methodName: string): boolean {
    // Don't filter out known user-defined classes (local or imported) or top-level functions
    if (
      this.classes.has(targetClass) ||
      this.importedClasses.has(targetClass) ||
      this.topLevelFunctions.has(targetClass)
    ) {
      return false;
    }

    // Check if target class can be resolved to a known class (e.g., "db" -> "Database")
    const resolvedClass = this.findClassForObject(targetClass);
    if (
      resolvedClass &&
      (this.classes.has(resolvedClass) || this.importedClasses.has(resolvedClass))
    ) {
      return false;
    }

    // Internal property names that should never create participants
    // These are common property names used in internal implementation
    const internalPropertyNames = new Set([
      'participants',
      'interactions',
      'classes',
      'entryPoints',
      'metadata',
      'properties',
      'methods',
      'relationships',
      'imports',
      'exports',
      'specifiers',
      'elements',
      'items',
      'nodes',
      'children',
      'child',
      'parent',
      'args',
      'params',
      'options',
      'config',
      'settings',
    ]);

    // Filter out internal property names immediately
    if (internalPropertyNames.has(targetClass.toLowerCase())) {
      return true;
    }

    // Common built-in methods that should be ignored
    const builtInMethods = new Set([
      'push',
      'pop',
      'shift',
      'unshift',
      'slice',
      'splice',
      'concat',
      'join',
      'map',
      'filter',
      'reduce',
      'forEach',
      'find',
      'findIndex',
      'some',
      'every',
      'includes',
      'indexOf',
      'lastIndexOf',
      'sort',
      'reverse',
      'set',
      'get',
      'has',
      'delete',
      'clear',
      'add',
      'values',
      'keys',
      'entries',
      'toString',
      'valueOf',
      'toJSON',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
    ]);

    // Common built-in type names (both lowercase and capitalized)
    const builtInTypeNames = new Set([
      'array',
      'Array',
      'map',
      'Map',
      'set',
      'Set',
      'console',
      'Console',
      'math',
      'Math',
      'json',
      'JSON',
      'date',
      'Date',
      'regexp',
      'RegExp',
      'promise',
      'Promise',
      'error',
      'Error',
      'arraybuffer',
      'ArrayBuffer',
      'dataview',
      'DataView',
      'weakmap',
      'WeakMap',
      'weakset',
      'WeakSet',
      'string',
      'String',
      'number',
      'Number',
      'boolean',
      'Boolean',
      'object',
      'Object',
    ]);

    // Check if target is a known built-in type (case-sensitive check first)
    if (builtInTypeNames.has(targetClass)) {
      return true;
    }

    // Also check lowercase version with built-in methods
    const lowerTarget = targetClass.toLowerCase();
    if (builtInTypeNames.has(lowerTarget) && builtInMethods.has(methodName)) {
      return true;
    }

    // Filter out single-letter variable names (like 't', 'i', 'x', etc.)
    // These are almost never class names
    if (targetClass.length === 1) {
      return true;
    }

    // Filter out TypeScript/JavaScript type names that are commonly used as variables
    const commonVariableNames = new Set([
      'typeann',
      'typeannotation',
      'typename',
      'typeName',
      'node',
      'element',
      'item',
      'result',
      'data',
      'value',
      'obj',
      'arr',
      'str',
      'num',
      'bool',
      'fn',
      'func',
      'callback',
      'arg',
      'args',
      'param',
      'params',
      'opt',
      'opts',
      'primitiveTypes',
      'primitivetypes',
      'builtInTypes',
      'builtintypes',
      'types',
      'type',
    ]);

    if (commonVariableNames.has(lowerTarget) || commonVariableNames.has(targetClass)) {
      return true;
    }

    return false;
  }

  /**
   * Try to find the class type of an object variable
   * Looks for tracked assignments like: this.obj = new ClassName()
   */
  private findClassForObject(objectName: string): string | null {
    // First, check if we tracked this property assignment
    if (this.propertyTypes.has(objectName)) {
      return this.propertyTypes.get(objectName)!;
    }

    // Fallback: try capitalizing the object name
    const capitalized = objectName.charAt(0).toUpperCase() + objectName.slice(1);
    if (this.classes.has(capitalized)) {
      return capitalized;
    }

    return null;
  }

  /**
   * Get a simple label for an expression
   */
  private getExpressionLabel(node: t.Node): string {
    if (t.isIdentifier(node)) {
      return node.name;
    }
    if (t.isStringLiteral(node)) {
      return `"${node.value}"`;
    }
    if (t.isNumericLiteral(node)) {
      return node.value.toString();
    }
    if (t.isBooleanLiteral(node)) {
      return node.value.toString();
    }
    if (t.isNullLiteral(node)) {
      return 'null';
    }
    if (t.isArrayExpression(node)) {
      return '[...]';
    }
    if (t.isObjectExpression(node)) {
      return '{...}';
    }
    if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
      return '() => {}';
    }
    if (t.isCallExpression(node)) {
      return 'fn()';
    }
    if (t.isMemberExpression(node)) {
      if (t.isIdentifier(node.object) && t.isIdentifier(node.property)) {
        return `${node.object.name}.${node.property.name}`;
      }
      return 'obj.prop';
    }
    return '...';
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
