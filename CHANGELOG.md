# Changelog

All notable changes to the "Goose UML" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2025-12-02

### Added

- Auto-follow active editor in UML Panel: When the panel is open, switching to another supported file automatically updates the diagram
- New `updateFile()` method in DiagramPanel for dynamic file switching
- Comprehensive tests for auto-follow functionality

### Changed

- Changed class diagram default mode from "bidirectional" to "forward" for more intuitive dependency visualization
- Improved toolbar layout: moved depth control to row 2 for better visibility
- Removed activation notification to reduce notification spam

### Fixed

- Enhanced panel visibility tracking with `isVisible` getter

## [0.3.1] - 2025-12-02

### Changed

- Documentation formatting improvements

## [0.2.6] - 2025-12-01

### Fixed

- Resolved marketplace publishing issue with v0.2.5

## [0.2.5] - 2025-12-01

### Fixed

- Improved extension activation and error handling
- Corrected Prettier formatting for import statements
- Resolved all ESLint warnings about 'any' types

### Changed

- Enhanced code quality with stricter TypeScript linting

## [0.2.4] - 2024-11-XX

### Fixed

- Improved extension activation and error handling

### Changed

- Code quality improvements with Prettier formatting

## [0.2.3] - 2024-11-XX

### Added

- Activity diagram generation support
- Comprehensive test coverage for diagram generation

### Fixed

- Escape special characters in flowchart labels using Mermaid format
- Replace empty Mermaid nodes with labeled nodes in activity diagrams
- Improve reverse dependency chain analysis in class diagram

### Changed

- Migrated TypeScript/JavaScript parser from Babel to tree-sitter for better performance
- Enhanced diagram generation with better node labeling

## [0.2.0] - 2024-11-XX

### Added

- CrossFileAnalyzer for multi-file dependency analysis
- ImportIndex for fast class diagram generation
- UML level support for controlling diagram complexity

### Changed

- Improved class diagram generation with cross-file analysis

## [0.1.0] - 2024-11-XX

### Added

- Initial release
- Generate UML class diagrams for TypeScript, JavaScript, Java, and Python
- Generate sequence diagrams
- Generate flowcharts
- Interactive diagram panel with Mermaid rendering
- Keyboard shortcut (Ctrl+Shift+U / Cmd+Shift+U)
- Context menu integration
- Editor toolbar button

[0.3.2]: https://github.com/kuochunchang/goose-uml-vscode/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/kuochunchang/goose-uml-vscode/compare/v0.2.6...v0.3.1
[0.2.6]: https://github.com/kuochunchang/goose-uml-vscode/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/kuochunchang/goose-uml-vscode/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/kuochunchang/goose-uml-vscode/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/kuochunchang/goose-uml-vscode/compare/v0.2.0...v0.2.3
[0.2.0]: https://github.com/kuochunchang/goose-uml-vscode/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kuochunchang/goose-uml-vscode/releases/tag/v0.1.0
