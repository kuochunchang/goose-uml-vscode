/**
 * Command: Generate Flowchart
 * Generates UML flowchart for the current file
 */

import * as vscode from "vscode";
import {
  getSupportedLanguagesList,
  isSupportedLanguage,
} from "../utils/language-support.js";
import { DiagramPanel } from "../views/diagram-panel.js";

export class GenerateFlowchartCommand {
  constructor(private readonly context: vscode.ExtensionContext) { }

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
          `Flowchart generation is only supported for ${getSupportedLanguagesList()} files`,
        );
        return;
      }

      // Get workspace folder
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("File is not in a workspace");
        return;
      }

      // Open unified panel and generate flowchart
      const panel = DiagramPanel.createOrShow(
        this.context.extensionUri,
        document.uri,
      );

      // Generate flowchart
      await panel.generateDiagram(document.uri, "flowchart", {
        depth: 0,
        mode: "bidirectional", // Default mode, though flowchart ignores it for now
      });

      vscode.window.showInformationMessage("Flowchart panel opened");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Failed to open UML panel: ${errorMessage}`,
      );
      console.error("Flowchart generation error:", error);
    }
  }
}
