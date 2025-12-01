/**
 * Command: Generate Class Diagram
 * Generates UML class diagram for the current file
 */

import * as vscode from "vscode";
import { DiagramPanel } from "../views/diagram-panel.js";
import {
  isSupportedLanguage,
  getSupportedLanguagesList,
} from "../utils/language-support.js";

export class GenerateClassDiagramCommand {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async execute(): Promise<void> {
    try {
      // Get active editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      // Validate file type
      const document = editor.document;
      if (!isSupportedLanguage(document.languageId)) {
        vscode.window.showWarningMessage(
          `Class diagram generation is only supported for ${getSupportedLanguagesList()} files`,
        );
        return;
      }

      // Get workspace folder
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("File is not in a workspace");
        return;
      }

      // Open unified panel and generate class diagram
      const panel = DiagramPanel.createOrShow(
        this.context.extensionUri,
        document.uri,
      );

      // Generate class diagram with default settings (depth=0, mode=forward)
      await panel.generateDiagram(document.uri, "class", {
        depth: 0,
        mode: "forward",
      });

      vscode.window.showInformationMessage("Class diagram panel opened");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Failed to open UML panel: ${errorMessage}`,
      );
      console.error("Class diagram generation error:", error);
    }
  }
}
