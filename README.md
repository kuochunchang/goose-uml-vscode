# Goose UML for VS Code

## Overview

**Goose UML** is a VS Code extension that automatically generates UML diagrams from your source code. It supports multiple programming languages and provides an interactive, real-time visualization experience right within your editor.

Whether you're documenting existing code, understanding complex systems, or planning new architectures, Goose UML helps you visualize code structure and behavior with ease.

## Key Features

### Multiple Diagram Types

- **Class Diagrams** - Visualize class structures, inheritance hierarchies, and relationships
- **Sequence Diagrams** - Understand method call flows and object interactions
- **Activity Diagrams** - Map out control flow and business logic

### Multi-Language Support

- **TypeScript** & **JavaScript** (including React/JSX)
- **Java** - Full OOP support with interfaces and abstract classes
- **Python** - Classes, functions, and inheritance

### Intelligent Analysis

- **Cross-File Analysis** - Automatically traces dependencies across multiple files
- **Configurable Depth** - Control how deep the analysis goes (1-5 levels)
- **Analysis Modes**:
  - **Full Mode** - Complete analysis with all relationships
  - **Focused Mode** - Concentrate on specific classes or methods
  - **Simplified Mode** - High-level overview without implementation details

### Interactive Experience

- **Real-Time Preview** - See diagrams update as you adjust settings
- **Zoom & Pan** - Navigate large diagrams with ease
- **Export Options** - Save diagrams as SVG or PNG images
- **Syntax Highlighting** - View Mermaid source code with proper formatting

## Getting Started

### Quick Start

1. **Open a supported file** (TypeScript, JavaScript, Java, or Python)
2. **Press `Ctrl+Shift+U`** (or `Cmd+Shift+U` on Mac)
3. **Select diagram type** from the dropdown
4. **Adjust settings** as needed (depth, mode, etc.)
5. **View and export** your diagram

### Alternative Access Methods

- **Command Palette**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P`) and search for "Goose UML"
- **Editor Title Bar**: Click the UML icon when viewing supported files
- **Right-Click Menu**: Right-click in the editor and select "Goose UML" options

## Usage Guide

### Class Diagrams

Class diagrams show the static structure of your code, including:

- Classes, interfaces, and abstract classes
- Properties and methods (with visibility modifiers)
- Inheritance and implementation relationships
- Associations and dependencies

**Example Use Cases:**
- Understanding existing codebases
- Documenting API designs
- Planning refactoring efforts
- Code reviews and presentations

### Sequence Diagrams

Sequence diagrams illustrate how objects interact over time:

- Method call sequences
- Object lifelines
- Message passing between objects
- Return values and control flow

**Example Use Cases:**
- Debugging complex workflows
- Understanding async operations
- API interaction documentation
- Performance analysis

### Activity Diagrams

Activity diagrams map out the flow of control:

- Conditional branches (if/else)
- Loops and iterations
- Function calls and returns
- Error handling paths

**Example Use Cases:**
- Business logic documentation
- Algorithm visualization
- Process flow mapping
- Testing scenario planning

## Configuration

### Analysis Depth

Control how many levels of dependencies to analyze:

- **Level 1** - Current file only
- **Level 2** - Direct imports
- **Level 3** - Imports of imports (recommended)
- **Level 4-5** - Deep dependency analysis

### Analysis Modes

- **Full Mode** - Complete analysis with all details
- **Focused Mode** - Specific classes/methods only
- **Simplified Mode** - High-level overview


## Commands

Access these commands via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description | Shortcut |
|---------|-------------|----------|
| `Goose UML: Open UML Panel` | Open interactive diagram panel | `Ctrl+Shift+U` / `Cmd+Shift+U` |
| `Goose UML: Generate Class Diagram` | Generate class diagram for current file | - |
| `Goose UML: Generate Sequence Diagram` | Generate sequence diagram for current file | - |
| `Goose UML: Generate Activity Diagram` | Generate activity diagram for current file | - |

## License

MIT License - see [LICENSE](LICENSE) for details

## Links

- [GitHub Repository](https://github.com/kuochunchang/goose-uml-vscode)
- [VS Code Marketplace](https://marketplace.visualstudio.com/)

