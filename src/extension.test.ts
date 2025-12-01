import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Store the editor change callback
let onEditorChangeCallback:
  | ((
      editor: { document: { languageId: string; uri: unknown } } | undefined,
    ) => void)
  | null = null;

// Mock vscode module before importing anything that uses it
vi.mock("vscode", async () => {
  const { createMockVSCode } =
    await import("./__tests__/helpers/vscode-mock.js");
  const mockVscode = createMockVSCode();

  // Override onDidChangeActiveTextEditor to capture the callback
  mockVscode.window.onDidChangeActiveTextEditor = vi.fn(
    (
      callback: (
        editor: { document: { languageId: string; uri: unknown } } | undefined,
      ) => void,
    ) => {
      onEditorChangeCallback = callback;
      return { dispose: vi.fn() };
    },
  );

  return mockVscode;
});

// Create mock objects before vi.mock to avoid hoisting issues
const mockUpdateFile = vi.fn();
let mockCurrentPanel: {
  isVisible: boolean;
  updateFile: typeof mockUpdateFile;
} | null = null;

// Mock DiagramPanel - use a getter for currentPanel
vi.mock("./views/diagram-panel.js", () => ({
  DiagramPanel: {
    get currentPanel() {
      return mockCurrentPanel;
    },
    set currentPanel(value) {
      mockCurrentPanel = value;
    },
  },
}));

// Mock ParserService
vi.mock("./core/services/ParserService.js", () => ({
  ParserService: {
    getInstance: vi.fn(() => ({
      registerParser: vi.fn(),
      getSupportedLanguages: vi.fn(() => ["typescript", "javascript"]),
    })),
  },
}));

// Mock parsers
vi.mock("./core/parsers/java/JavaParser.js", () => ({
  JavaParser: vi.fn(),
}));
vi.mock("./core/parsers/python/PythonParser.js", () => ({
  PythonParser: vi.fn(),
}));
vi.mock("./core/parsers/typescript/JavaScriptParser.js", () => ({
  JavaScriptParser: vi.fn(),
}));
vi.mock("./core/parsers/typescript/TypeScriptParser.js", () => ({
  TypeScriptParser: vi.fn(),
}));

import type * as vscode from "vscode";
import { activate } from "./extension.js";

interface MockExtensionContext {
  subscriptions: Array<{ dispose: () => void }>;
  extensionUri: vscode.Uri;
}

interface MockVSCode {
  __mockExtensionContext: MockExtensionContext;
  window: {
    onDidChangeActiveTextEditor: ReturnType<typeof vi.fn>;
  };
}

describe("Extension", () => {
  let mockContext: MockExtensionContext;

  beforeEach(async () => {
    const vscode = (await import("vscode")) as unknown as MockVSCode;
    mockContext = vscode.__mockExtensionContext;
    mockContext.subscriptions = [];

    // Reset mocks
    onEditorChangeCallback = null;
    mockCurrentPanel = null;
    mockUpdateFile.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("activate", () => {
    it("should register onDidChangeActiveTextEditor listener", async () => {
      const vscode = (await import("vscode")) as unknown as MockVSCode;

      activate(mockContext as unknown as vscode.ExtensionContext);

      expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
    });

    it("should add editor change listener to subscriptions", () => {
      activate(mockContext as unknown as vscode.ExtensionContext);

      // Should have multiple subscriptions including the editor change listener
      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });
  });

  describe("onDidChangeActiveTextEditor listener", () => {
    beforeEach(() => {
      activate(mockContext as unknown as vscode.ExtensionContext);
    });

    it("should not update panel if no current panel exists", () => {
      mockCurrentPanel = null;

      const mockEditor = {
        document: {
          languageId: "typescript",
          uri: { fsPath: "/test/file.ts" },
        },
      };

      onEditorChangeCallback?.(mockEditor);

      expect(mockUpdateFile).not.toHaveBeenCalled();
    });

    it("should not update panel if panel is not visible", () => {
      mockCurrentPanel = {
        isVisible: false,
        updateFile: mockUpdateFile,
      };

      const mockEditor = {
        document: {
          languageId: "typescript",
          uri: { fsPath: "/test/file.ts" },
        },
      };

      onEditorChangeCallback?.(mockEditor);

      expect(mockUpdateFile).not.toHaveBeenCalled();
    });

    it("should not update panel for unsupported language", () => {
      mockCurrentPanel = {
        isVisible: true,
        updateFile: mockUpdateFile,
      };

      const mockEditor = {
        document: {
          languageId: "csharp", // unsupported
          uri: { fsPath: "/test/file.cs" },
        },
      };

      onEditorChangeCallback?.(mockEditor);

      expect(mockUpdateFile).not.toHaveBeenCalled();
    });

    it("should update panel for supported TypeScript file", () => {
      mockCurrentPanel = {
        isVisible: true,
        updateFile: mockUpdateFile,
      };

      const mockUri = { fsPath: "/test/file.ts" };
      const mockEditor = {
        document: {
          languageId: "typescript",
          uri: mockUri,
        },
      };

      onEditorChangeCallback?.(mockEditor);

      expect(mockUpdateFile).toHaveBeenCalledWith(mockUri);
    });

    it("should update panel for supported JavaScript file", () => {
      mockCurrentPanel = {
        isVisible: true,
        updateFile: mockUpdateFile,
      };

      const mockUri = { fsPath: "/test/file.js" };
      const mockEditor = {
        document: {
          languageId: "javascript",
          uri: mockUri,
        },
      };

      onEditorChangeCallback?.(mockEditor);

      expect(mockUpdateFile).toHaveBeenCalledWith(mockUri);
    });

    it("should update panel for supported Java file", () => {
      mockCurrentPanel = {
        isVisible: true,
        updateFile: mockUpdateFile,
      };

      const mockUri = { fsPath: "/test/file.java" };
      const mockEditor = {
        document: {
          languageId: "java",
          uri: mockUri,
        },
      };

      onEditorChangeCallback?.(mockEditor);

      expect(mockUpdateFile).toHaveBeenCalledWith(mockUri);
    });

    it("should update panel for supported Python file", () => {
      mockCurrentPanel = {
        isVisible: true,
        updateFile: mockUpdateFile,
      };

      const mockUri = { fsPath: "/test/file.py" };
      const mockEditor = {
        document: {
          languageId: "python",
          uri: mockUri,
        },
      };

      onEditorChangeCallback?.(mockEditor);

      expect(mockUpdateFile).toHaveBeenCalledWith(mockUri);
    });

    it("should not update panel if editor is undefined", () => {
      mockCurrentPanel = {
        isVisible: true,
        updateFile: mockUpdateFile,
      };

      onEditorChangeCallback?.(undefined);

      expect(mockUpdateFile).not.toHaveBeenCalled();
    });
  });
});
