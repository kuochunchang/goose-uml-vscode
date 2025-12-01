import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock vscode module before importing anything that uses it
vi.mock("vscode", async () => {
  const { createMockVSCode } = await import(
    "../__tests__/helpers/vscode-mock.js"
  );
  return createMockVSCode();
});

// Mock DiagramPanel
vi.mock("../views/diagram-panel.js", () => ({
  DiagramPanel: {
    createOrShow: vi.fn(() => ({
      generateDiagram: vi.fn(),
    })),
  },
}));

import { GenerateSequenceDiagramCommand } from "./generate-sequence-diagram.js";
import type * as vscode from "vscode";

describe("GenerateSequenceDiagramCommand", () => {
  let mockContext: vscode.ExtensionContext;
  let mockWindow: any;
  let mockWorkspace: any;

  beforeEach(async () => {
    const vscode = await import("vscode");
    const mock = vscode as any;
    mockContext = mock.__mockExtensionContext as any;
    mockWindow = mock.__mockWindow;
    mockWorkspace = mock.__mockWorkspace;

    vi.clearAllMocks();
  });

  it("should show error when no active editor", async () => {
    mockWindow.activeTextEditor = undefined;

    const command = new GenerateSequenceDiagramCommand(mockContext);
    await command.execute();

    expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
      "No active editor found",
    );
  });

  it("should show warning for unsupported diagram type", async () => {
    const mockEditor = {
      document: {
        uri: { fsPath: "/test/file.java" },
        languageId: "java",
      },
    };
    mockWindow.activeTextEditor = mockEditor;

    const command = new GenerateSequenceDiagramCommand(mockContext);
    await command.execute();

    expect(mockWindow.showWarningMessage).toHaveBeenCalled();
  });

  it("should show error when file is not in workspace", async () => {
    const mockEditor = {
      document: {
        uri: { fsPath: "/test/file.ts" },
        languageId: "typescript",
      },
    };
    mockWindow.activeTextEditor = mockEditor;
    mockWorkspace.getWorkspaceFolder.mockReturnValue(null);

    const command = new GenerateSequenceDiagramCommand(mockContext);
    await command.execute();

    expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
      "File is not in a workspace",
    );
  });

  it("should open panel and generate sequence diagram for supported language", async () => {
    const mockEditor = {
      document: {
        uri: { fsPath: "/test/file.ts" },
        languageId: "typescript",
      },
    };
    const mockWorkspaceFolder = {
      uri: { fsPath: "/workspace" },
      name: "workspace",
    };
    mockWindow.activeTextEditor = mockEditor;
    mockWorkspace.getWorkspaceFolder.mockReturnValue(mockWorkspaceFolder);

    const { DiagramPanel } = await import("../views/diagram-panel.js");
    vi.mocked(DiagramPanel.createOrShow).mockReturnValue({
      generateDiagram: vi.fn(),
    } as any);

    const command = new GenerateSequenceDiagramCommand(mockContext);
    await command.execute();

    expect(DiagramPanel.createOrShow).toHaveBeenCalled();
    expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
      "Sequence diagram panel opened",
    );
  });

  it("should handle errors gracefully", async () => {
    const mockEditor = {
      document: {
        uri: { fsPath: "/test/file.ts" },
        languageId: "typescript",
      },
    };
    mockWindow.activeTextEditor = mockEditor;
    mockWorkspace.getWorkspaceFolder.mockReturnValue({
      uri: { fsPath: "/workspace" },
    });

    const { DiagramPanel } = await import("../views/diagram-panel.js");
    vi.mocked(DiagramPanel.createOrShow).mockImplementation(() => {
      throw new Error("Test error");
    });

    const command = new GenerateSequenceDiagramCommand(mockContext);
    await command.execute();

    expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("Failed to open UML panel"),
    );
  });
});
