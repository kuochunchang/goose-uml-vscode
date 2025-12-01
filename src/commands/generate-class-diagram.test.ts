import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock vscode module before importing anything that uses it
vi.mock("vscode", async () => {
  const { createMockVSCode } =
    await import("../__tests__/helpers/vscode-mock.js");
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

import { GenerateClassDiagramCommand } from "./generate-class-diagram.js";
import type * as vscode from "vscode";

interface MockWindow {
  activeTextEditor?: vscode.TextEditor;
  showErrorMessage: ReturnType<typeof vi.fn>;
  showWarningMessage: ReturnType<typeof vi.fn>;
  showInformationMessage: ReturnType<typeof vi.fn>;
}

interface MockWorkspace {
  getWorkspaceFolder: ReturnType<typeof vi.fn>;
}

interface MockVSCode {
  __mockWindow: MockWindow;
  __mockWorkspace: MockWorkspace;
  __mockExtensionContext: vscode.ExtensionContext;
}

describe("GenerateClassDiagramCommand", () => {
  let mockContext: vscode.ExtensionContext;
  let mockWindow: MockWindow;
  let mockWorkspace: MockWorkspace;

  beforeEach(async () => {
    const vscode = (await import("vscode")) as unknown as MockVSCode;
    mockContext = vscode.__mockExtensionContext;
    mockWindow = vscode.__mockWindow;
    mockWorkspace = vscode.__mockWorkspace;

    // Reset mocks
    vi.clearAllMocks();
  });

  it("should show error when no active editor", async () => {
    mockWindow.activeTextEditor = undefined;

    const command = new GenerateClassDiagramCommand(mockContext);
    await command.execute();

    expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
      "No active editor found",
    );
  });

  it("should show warning for unsupported language", async () => {
    const mockEditor = {
      document: {
        uri: { fsPath: "/test/file.cs" },
        languageId: "csharp",
      },
    };
    mockWindow.activeTextEditor = mockEditor;

    const command = new GenerateClassDiagramCommand(mockContext);
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

    const command = new GenerateClassDiagramCommand(mockContext);
    await command.execute();

    expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
      "File is not in a workspace",
    );
  });

  it("should open panel and generate diagram for supported language", async () => {
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
    const mockGenerateDiagram = vi.fn();
    vi.mocked(DiagramPanel.createOrShow).mockReturnValue({
      generateDiagram: mockGenerateDiagram,
    } as ReturnType<typeof DiagramPanel.createOrShow>);

    const command = new GenerateClassDiagramCommand(mockContext);
    await command.execute();

    expect(DiagramPanel.createOrShow).toHaveBeenCalled();
    expect(mockGenerateDiagram).toHaveBeenCalledWith(
      mockEditor.document.uri,
      "class",
      { depth: 0, mode: "forward" },
    );
    expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
      "Class diagram panel opened",
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

    const command = new GenerateClassDiagramCommand(mockContext);
    await command.execute();

    expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("Failed to open UML panel"),
    );
  });
});
