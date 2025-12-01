import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock vscode module before importing anything that uses it
vi.mock("vscode", async () => {
  const { createMockVSCode } =
    await import("../__tests__/helpers/vscode-mock.js");
  return createMockVSCode();
});

// Mock the UMLAnalyzer
vi.mock("../core/analyzers/UMLAnalyzer.js", () => ({
  UMLAnalyzer: vi.fn().mockImplementation(() => ({
    generateUnifiedDiagram: vi.fn().mockResolvedValue({
      mermaidCode: "classDiagram\nClass01 <|-- Class02",
    }),
  })),
}));

// Mock the VSCodeFileProvider
vi.mock("../core/services/vscode-file-provider.js", () => ({
  VSCodeFileProvider: vi.fn().mockImplementation(() => ({})),
}));

import * as vscode from "vscode";
import { DiagramPanel } from "./diagram-panel.js";

interface MockWindow {
  activeTextEditor?: vscode.TextEditor;
  showErrorMessage: ReturnType<typeof vi.fn>;
  showWarningMessage: ReturnType<typeof vi.fn>;
  showInformationMessage: ReturnType<typeof vi.fn>;
  createWebviewPanel: ReturnType<typeof vi.fn>;
}

interface MockWorkspace {
  getWorkspaceFolder: ReturnType<typeof vi.fn>;
  asRelativePath: ReturnType<typeof vi.fn>;
}

interface MockWebviewPanel {
  webview: {
    html: string;
    onDidReceiveMessage: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
  };
  onDidDispose: ReturnType<typeof vi.fn>;
  reveal: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  visible: boolean;
}

interface MockVSCode {
  window: MockWindow;
  workspace: MockWorkspace;
  __mockWindow: MockWindow;
  __mockWorkspace: MockWorkspace;
  __mockWebviewPanel: MockWebviewPanel;
  ViewColumn: {
    Beside: number;
  };
}

describe("DiagramPanel", () => {
  let mockVSCode: MockVSCode;
  let mockPanel: MockWebviewPanel;

  beforeEach(async () => {
    mockVSCode = (await import("vscode")) as unknown as MockVSCode;
    mockPanel = mockVSCode.__mockWebviewPanel;

    // Reset panel state
    mockPanel.webview.html = "";
    mockPanel.visible = true;

    // Mock workspace functions
    mockVSCode.__mockWorkspace.getWorkspaceFolder.mockReturnValue({
      uri: { fsPath: "/workspace" },
      name: "workspace",
      index: 0,
    });

    // Reset the currentPanel before each test
    DiagramPanel.currentPanel = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    DiagramPanel.currentPanel?.dispose();
    DiagramPanel.currentPanel = undefined;
  });

  describe("createOrShow", () => {
    it("should create a new panel when none exists", () => {
      const extensionUri = { fsPath: "/extension" } as vscode.Uri;
      const fileUri = { fsPath: "/workspace/test.ts" } as vscode.Uri;

      const panel = DiagramPanel.createOrShow(extensionUri, fileUri);

      expect(panel).toBeDefined();
      expect(DiagramPanel.currentPanel).toBe(panel);
      expect(mockVSCode.__mockWindow.createWebviewPanel).toHaveBeenCalled();
    });

    it("should reuse existing panel when one exists", () => {
      const extensionUri = { fsPath: "/extension" } as vscode.Uri;
      const fileUri1 = { fsPath: "/workspace/test1.ts" } as vscode.Uri;
      const fileUri2 = { fsPath: "/workspace/test2.ts" } as vscode.Uri;

      const panel1 = DiagramPanel.createOrShow(extensionUri, fileUri1);
      const panel2 = DiagramPanel.createOrShow(extensionUri, fileUri2);

      expect(panel1).toBe(panel2);
      expect(mockVSCode.__mockWindow.createWebviewPanel).toHaveBeenCalledTimes(
        1,
      );
      expect(mockPanel.reveal).toHaveBeenCalled();
    });
  });

  describe("updateFile", () => {
    it("should update the current file and regenerate diagram", async () => {
      const extensionUri = { fsPath: "/extension" } as vscode.Uri;
      const fileUri1 = { fsPath: "/workspace/test1.ts" } as vscode.Uri;
      const fileUri2 = { fsPath: "/workspace/test2.ts" } as vscode.Uri;

      const panel = DiagramPanel.createOrShow(extensionUri, fileUri1);

      // Wait for initial diagram generation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update to new file
      panel.updateFile(fileUri2);

      // Panel should show loading state (empty mermaid code)
      expect(mockPanel.webview.html).toContain("Generating");
    });

    it("should not regenerate if same file is provided", async () => {
      const extensionUri = { fsPath: "/extension" } as vscode.Uri;
      const fileUri = { fsPath: "/workspace/test.ts" } as vscode.Uri;

      const panel = DiagramPanel.createOrShow(extensionUri, fileUri);

      // Wait for initial diagram generation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const htmlBeforeUpdate = mockPanel.webview.html;

      // Update with same file
      panel.updateFile(fileUri);

      // HTML should not change (no regeneration triggered)
      expect(mockPanel.webview.html).toBe(htmlBeforeUpdate);
    });
  });

  describe("isVisible", () => {
    it("should return true when panel is visible", () => {
      const extensionUri = { fsPath: "/extension" } as vscode.Uri;
      const fileUri = { fsPath: "/workspace/test.ts" } as vscode.Uri;

      mockPanel.visible = true;
      const panel = DiagramPanel.createOrShow(extensionUri, fileUri);

      expect(panel.isVisible).toBe(true);
    });

    it("should return false when panel is not visible", () => {
      const extensionUri = { fsPath: "/extension" } as vscode.Uri;
      const fileUri = { fsPath: "/workspace/test.ts" } as vscode.Uri;

      const panel = DiagramPanel.createOrShow(extensionUri, fileUri);
      mockPanel.visible = false;

      expect(panel.isVisible).toBe(false);
    });
  });

  describe("dispose", () => {
    it("should clear currentPanel on dispose", () => {
      const extensionUri = { fsPath: "/extension" } as vscode.Uri;
      const fileUri = { fsPath: "/workspace/test.ts" } as vscode.Uri;

      const panel = DiagramPanel.createOrShow(extensionUri, fileUri);
      expect(DiagramPanel.currentPanel).toBe(panel);

      panel.dispose();
      expect(DiagramPanel.currentPanel).toBeUndefined();
    });
  });
});
