/**
 * Command: Generate Sequence Diagram
 * Generates UML sequence diagram for the current file
 */

import * as vscode from "vscode";
import { DiagramPanel } from "../views/diagram-panel.js";
import {
  isDiagramTypeSupported,
  getUnsupportedDiagramTypeMessage,
} from "../utils/language-support.js";

export class GenerateSequenceDiagramCommand {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async execute(): Promise<void> {
    try {
      // Get active editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      // Validate file type and diagram type support
      const document = editor.document;
      if (!isDiagramTypeSupported(document.languageId, "sequence")) {
        vscode.window.showWarningMessage(
          getUnsupportedDiagramTypeMessage(document.languageId, "sequence"),
        );
        return;
      }

      // Get workspace folder
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("File is not in a workspace");
        return;
      }

      // Open unified panel and generate sequence diagram
      const panel = DiagramPanel.createOrShow(
        this.context.extensionUri,
        document.uri,
      );

      // Generate sequence diagram
      await panel.generateDiagram(document.uri, "sequence");

      vscode.window.showInformationMessage("Sequence diagram panel opened");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Failed to open UML panel: ${errorMessage}`,
      );
      console.error("Sequence diagram generation error:", error);
    }
  }
}
