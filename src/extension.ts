/**
 * Goose UML VS Code Extension
 * Generate UML diagrams for TypeScript, JavaScript, Java, and Python
 */

import * as vscode from "vscode";
import { GenerateFlowchartCommand } from "./commands/generate-flowchart.js";
import { GenerateClassDiagramCommand } from "./commands/generate-class-diagram.js";
import { GenerateSequenceDiagramCommand } from "./commands/generate-sequence-diagram.js";
import { JavaParser } from "./core/parsers/java/JavaParser.js";
import { PythonParser } from "./core/parsers/python/PythonParser.js";
import { JavaScriptParser } from "./core/parsers/typescript/JavaScriptParser.js";
import { TypeScriptParser } from "./core/parsers/typescript/TypeScriptParser.js";
import { ParserService } from "./core/services/ParserService.js";
import {
  getSupportedLanguagesList,
  isSupportedLanguage,
} from "./utils/language-support.js";
import { DiagramPanel } from "./views/diagram-panel.js";

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  try {
    console.log("Goose UML extension is now active");

    // Initialize and register all language parsers
    try {
      const parserService = ParserService.getInstance();
      parserService.registerParser(new JavaParser());
      parserService.registerParser(new PythonParser());
      parserService.registerParser(new TypeScriptParser());
      parserService.registerParser(new JavaScriptParser());
      console.log(
        "Registered parsers for:",
        parserService.getSupportedLanguages().join(", "),
      );
    } catch (error) {
      console.error("Failed to register parsers:", error);
      vscode.window.showWarningMessage(
        "Goose UML: Some parsers failed to load, but basic functionality is available.",
      );
    }

    // Register UML Panel command
    const openUMLPanel = vscode.commands.registerCommand(
      "gooseUML.openPanel",
      () => {
        try {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
          }

          const document = editor.document;
          if (!isSupportedLanguage(document.languageId)) {
            vscode.window.showWarningMessage(
              `UML diagram generation is only supported for ${getSupportedLanguagesList()} files`,
            );
            return;
          }

          DiagramPanel.createOrShow(context.extensionUri, document.uri);
        } catch (error) {
          console.error("Error in openPanel command:", error);
          vscode.window.showErrorMessage(
            `Failed to open UML panel: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    );

    // Register legacy commands for backward compatibility
    const generateClassDiagram = new GenerateClassDiagramCommand(context);
    const generateSequenceDiagram = new GenerateSequenceDiagramCommand(context);

    context.subscriptions.push(
      openUMLPanel,
      vscode.commands.registerCommand("gooseUML.generateClassDiagram", () => {
        try {
          return generateClassDiagram.execute();
        } catch (error) {
          console.error("Error in generateClassDiagram:", error);
          vscode.window.showErrorMessage(
            `Failed to generate class diagram: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
      vscode.commands.registerCommand(
        "gooseUML.generateSequenceDiagram",
        () => {
          try {
            return generateSequenceDiagram.execute();
          } catch (error) {
            console.error("Error in generateSequenceDiagram:", error);
            vscode.window.showErrorMessage(
              `Failed to generate sequence diagram: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
      ),
      vscode.commands.registerCommand("gooseUML.generateFlowchart", () => {
        try {
          return new GenerateFlowchartCommand(context).execute();
        } catch (error) {
          console.error("Error in generateFlowchart:", error);
          vscode.window.showErrorMessage(
            `Failed to generate flowchart: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );

    console.log("Goose UML: All commands registered successfully");
  } catch (error) {
    console.error("Fatal error during Goose UML activation:", error);
    vscode.window.showErrorMessage(
      `Goose UML failed to activate: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function deactivate(): void {
  console.log("Goose UML extension is now deactivated");
}
