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
// eslint-disable-next-line @typescript-eslint/require-await
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  console.log("Goose UML extension is now active");

  // Initialize and register all language parsers
  const parserService = ParserService.getInstance();
  parserService.registerParser(new JavaParser());
  parserService.registerParser(new PythonParser());
  parserService.registerParser(new TypeScriptParser());
  parserService.registerParser(new JavaScriptParser());
  console.log(
    "Registered parsers for:",
    parserService.getSupportedLanguages().join(", "),
  );

  // Register UML Panel command
  const openUMLPanel = vscode.commands.registerCommand(
    "gooseUML.openPanel",
    () => {
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
    },
  );

  // Register legacy commands for backward compatibility
  const generateClassDiagram = new GenerateClassDiagramCommand(context);
  const generateSequenceDiagram = new GenerateSequenceDiagramCommand(context);

  context.subscriptions.push(
    openUMLPanel,
    vscode.commands.registerCommand("gooseUML.generateClassDiagram", () =>
      generateClassDiagram.execute(),
    ),
    vscode.commands.registerCommand("gooseUML.generateSequenceDiagram", () =>
      generateSequenceDiagram.execute(),
    ),
    vscode.commands.registerCommand("gooseUML.generateFlowchart", () =>
      new GenerateFlowchartCommand(context).execute(),
    ),
  );

  vscode.window.showInformationMessage("Goose UML is ready! 📊");
}

export function deactivate(): void {
  console.log("Goose UML extension is now deactivated");
}
