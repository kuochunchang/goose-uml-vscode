/**
 * Command: Generate Activity Diagram
 * Generates UML activity diagram (flowchart) for the current file
 */

import * as vscode from "vscode";
import {
  getSupportedLanguagesList,
  isSupportedLanguage,
} from "../utils/language-support.js";
import { DiagramPanel } from "../views/diagram-panel.js";

export class GenerateActivityDiagramCommand {
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
          `Activity diagram generation is only supported for ${getSupportedLanguagesList()} files`,
        );
        return;
      }

      // Get workspace folder
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("File is not in a workspace");
        return;
      }

      // Open unified panel and generate activity diagram
      const panel = DiagramPanel.createOrShow(
        this.context.extensionUri,
        document.uri,
      );

      // Generate activity diagram
      await panel.generateDiagram(document.uri, "activity", {
        depth: 0,
        mode: "bidirectional", // Default mode, though activity diagram ignores it for now
      });

      vscode.window.showInformationMessage("Activity diagram panel opened");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Failed to open UML panel: ${errorMessage}`,
      );
      console.error("Activity diagram generation error:", error);
    }
  }
}
