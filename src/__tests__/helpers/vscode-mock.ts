/**
 * VS Code API Mock for testing
 * Provides mock implementations of VS Code extension APIs
 */

import { vi } from "vitest";
import type * as vscode from "vscode";

export function createMockVSCode(): typeof vscode {
  const mockWindow = {
    activeTextEditor: undefined as vscode.TextEditor | undefined,
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    createStatusBarItem: vi.fn(() => ({
      text: "",
      command: "",
      tooltip: "",
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    })),
    onDidChangeActiveTextEditor: {
      dispose: vi.fn(),
    },
  };

  const mockWorkspace = {
    getWorkspaceFolder: vi.fn(),
  };

  const mockCommands = {
    registerCommand: vi.fn((command: string, callback: () => void) => ({
      command,
      callback,
      dispose: vi.fn(),
    })),
  };

  const mockExtensionContext = {
    subscriptions: [] as Array<{ dispose: () => void }>,
    extensionUri: {
      fsPath: "/mock/extension",
      scheme: "file",
      authority: "",
      path: "/mock/extension",
      query: "",
      fragment: "",
      with: vi.fn(),
      toJSON: vi.fn(),
    },
    extensionPath: "/mock/extension",
    globalState: {
      get: vi.fn(),
      update: vi.fn(),
      keys: () => [],
    },
    workspaceState: {
      get: vi.fn(),
      update: vi.fn(),
      keys: () => [],
    },
    secrets: {
      get: vi.fn(),
      store: vi.fn(),
      delete: vi.fn(),
    },
    extensionMode: 1 as vscode.ExtensionMode,
    globalStorageUri: {
      fsPath: "/mock/storage",
      scheme: "file",
      authority: "",
      path: "/mock/storage",
      query: "",
      fragment: "",
      with: vi.fn(),
      toJSON: vi.fn(),
    },
    storageUri: {
      fsPath: "/mock/storage",
      scheme: "file",
      authority: "",
      path: "/mock/storage",
      query: "",
      fragment: "",
      with: vi.fn(),
      toJSON: vi.fn(),
    },
    logPath: "/mock/log",
    extension: {
      id: "mock.extension",
      extensionUri: {
        fsPath: "/mock/extension",
        scheme: "file",
        authority: "",
        path: "/mock/extension",
        query: "",
        fragment: "",
        with: vi.fn(),
        toJSON: vi.fn(),
      },
      extensionPath: "/mock/extension",
      isActive: true,
      packageJSON: {},
      exports: {},
      activate: vi.fn(),
    },
    environmentVariableCollection: {} as vscode.EnvironmentVariableCollection,
    extensionRuntime: 1 as number,
  };

  const mockTextDocument = {
    uri: {
      fsPath: "/mock/file.ts",
      scheme: "file",
      authority: "",
      path: "/mock/file.ts",
      query: "",
      fragment: "",
      with: vi.fn(),
      toJSON: vi.fn(),
    },
    fileName: "file.ts",
    isUntitled: false,
    languageId: "typescript",
    version: 1,
    isDirty: false,
    isClosed: false,
    eol: 1 as vscode.EndOfLine,
    lineCount: 10,
    save: vi.fn(),
    lineAt: vi.fn(),
    offsetAt: vi.fn(),
    positionAt: vi.fn(),
    getText: vi.fn(() => "mock code"),
    getWordRangeAtPosition: vi.fn(),
    validateRange: vi.fn(),
    validatePosition: vi.fn(),
  };

  const mockTextEditor = {
    document: mockTextDocument,
    selection: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
      isEmpty: true,
      isSingleLine: true,
      anchor: { line: 0, character: 0 },
      active: { line: 0, character: 0 },
      with: vi.fn(),
    },
    selections: [],
    visibleRanges: [],
    options: {},
    viewColumn: 1 as vscode.ViewColumn,
    edit: vi.fn(),
    insertSnippet: vi.fn(),
    setDecorations: vi.fn(),
    revealRange: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  };

  const mockWorkspaceFolder = {
    uri: {
      fsPath: "/mock/workspace",
      scheme: "file",
      authority: "",
      path: "/mock/workspace",
      query: "",
      fragment: "",
      with: vi.fn(),
      toJSON: vi.fn(),
    },
    name: "workspace",
    index: 0,
  };

  return {
    window: mockWindow as any,
    workspace: mockWorkspace as any,
    commands: mockCommands as any,
    StatusBarAlignment: {
      Left: 1,
      Right: 2,
    },
    ExtensionMode: {
      Production: 0,
      Development: 1,
      Test: 2,
    },
    EndOfLine: {
      LF: 1,
      CRLF: 2,
    },
    ViewColumn: {
      Active: -1,
      Beside: -2,
      One: 1,
      Two: 2,
      Three: 3,
      Four: 4,
      Five: 5,
      Six: 6,
      Seven: 7,
      Eight: 8,
      Nine: 9,
    },
    ExtensionRuntime: {
      Node: 1,
      Webworker: 2,
    },
    // Helper functions for tests
    __mockWindow: mockWindow,
    __mockWorkspace: mockWorkspace,
    __mockCommands: mockCommands,
    __mockExtensionContext: mockExtensionContext,
    __mockTextDocument: mockTextDocument,
    __mockTextEditor: mockTextEditor,
    __mockWorkspaceFolder: mockWorkspaceFolder,
  } as any;
}

