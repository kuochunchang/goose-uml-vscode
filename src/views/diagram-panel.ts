/**
 * Interactive Diagram Panel
 * Unified webview panel for displaying UML diagrams with interactive controls
 */

import * as vscode from "vscode";
import { UMLAnalyzer } from "../core/analyzers/UMLAnalyzer.js";
import { VSCodeFileProvider } from "../core/services/vscode-file-provider.js";

export type DiagramType = "class" | "sequence" | "flowchart";
export type AnalysisMode = "forward" | "reverse" | "bidirectional";

export interface DiagramOptions {
  depth: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  mode: AnalysisMode;
}

export class DiagramPanel {
  public static currentPanel: DiagramPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  // Current state
  private _currentFile: vscode.Uri | undefined;
  private _currentType: DiagramType = "class";
  private _currentOptions: DiagramOptions = { depth: 0, mode: "bidirectional" };
  private _mermaidCode: string = "";

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set initial HTML content (only once)
    this._panel.webview.html = this._getWebviewContent();

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "regenerate":
            await this._handleRegenerate(message.type, message.options);
            break;
          case "error":
            vscode.window.showErrorMessage(message.text);
            break;
          case "info":
            vscode.window.showInformationMessage(message.text);
            break;
        }
      },
      null,
      this._disposables,
    );

    // Clean up when panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * Create or show the diagram panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    file?: vscode.Uri,
  ): DiagramPanel {
    // Open panel beside the active editor (side-by-side)
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it
    if (DiagramPanel.currentPanel) {
      DiagramPanel.currentPanel._panel.reveal(column);
      if (file) {
        DiagramPanel.currentPanel._currentFile = file;
        // Update HTML to show loading state immediately
        DiagramPanel.currentPanel._panel.webview.html =
          DiagramPanel.currentPanel._getWebviewContent();
        void DiagramPanel.currentPanel._generateDiagram();
      }
      return DiagramPanel.currentPanel;
    }

    // Otherwise, create a new panel beside the active editor
    const panel = vscode.window.createWebviewPanel(
      "gooseCodeReviewUML",
      "🦆 UML Diagram",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    DiagramPanel.currentPanel = new DiagramPanel(panel, extensionUri);

    if (file) {
      DiagramPanel.currentPanel._currentFile = file;
      // Update HTML to show loading state immediately
      DiagramPanel.currentPanel._panel.webview.html =
        DiagramPanel.currentPanel._getWebviewContent();
      void DiagramPanel.currentPanel._generateDiagram();
    }

    return DiagramPanel.currentPanel;
  }

  /**
   * Generate diagram for current file with current settings
   */
  public async generateDiagram(
    file: vscode.Uri,
    type?: DiagramType,
    options?: Partial<DiagramOptions>,
  ): Promise<void> {
    this._currentFile = file;

    if (type) {
      this._currentType = type;
    }

    if (options) {
      this._currentOptions = { ...this._currentOptions, ...options };
    }

    await this._generateDiagram();
  }

  /**
   * Handle regenerate request from webview
   */
  private async _handleRegenerate(
    type: DiagramType,
    options: DiagramOptions,
  ): Promise<void> {
    this._currentType = type;
    this._currentOptions = options;
    await this._generateDiagram();
  }

  /**
   * Generate diagram with current settings
   */
  private async _generateDiagram(): Promise<void> {
    if (!this._currentFile) {
      return;
    }

    try {
      // Show loading state
      this._panel.webview.postMessage({
        command: "loading",
        isLoading: true,
      });

      // Get workspace folder
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(
        this._currentFile,
      );
      if (!workspaceFolder) {
        throw new Error("File is not in a workspace");
      }

      // Create file provider and analyzer
      const fileProvider = new VSCodeFileProvider(workspaceFolder.uri);
      const analyzer = new UMLAnalyzer(fileProvider);

      // Determine options based on diagram type
      const generateOptions =
        this._currentType === "class" || this._currentType === "sequence"
          ? {
              depth: this._currentOptions.depth,
              mode: this._currentOptions.mode,
            }
          : {
              depth: 0, // Default depth for other types if needed, or handle specific types
              mode: this._currentOptions.mode,
            };

      let result;
      let fallbackUsed = false;

      try {
        // Generate diagram
        result = await analyzer.generateUnifiedDiagram(
          this._currentFile.fsPath,
          this._currentType,
          generateOptions,
        );
      } catch (crossFileError) {
        // If cross-file analysis fails and depth > 0, fallback to single-file analysis
        if (this._currentOptions.depth > 0) {
          console.warn(
            `Cross-file analysis failed (depth=${this._currentOptions.depth}), falling back to single-file analysis:`,
            crossFileError,
          );

          vscode.window.showWarningMessage(
            `Cross-file analysis failed. Showing single-file diagram instead. Error: ${
              crossFileError instanceof Error
                ? crossFileError.message
                : String(crossFileError)
            }`,
          );

          // Retry with depth=0
          result = await analyzer.generateUnifiedDiagram(
            this._currentFile.fsPath,
            this._currentType,
            {
              depth: 0,
              mode: this._currentOptions.mode,
            },
          );

          fallbackUsed = true;
        } else {
          // Single-file analysis failed, re-throw
          throw crossFileError;
        }
      }

      this._mermaidCode = result.mermaidCode;

      // Update webview HTML with new diagram
      this._updateWebview();

      // Show warning if fallback was used
      if (fallbackUsed) {
        vscode.window.showWarningMessage(
          "Cross-file analysis failed. Showing single-file diagram only.",
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Provide more detailed error messages
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes("File not found")) {
        userFriendlyMessage = `File not found. Please ensure the file exists and is within the workspace.`;
      } else if (errorMessage.includes("Cannot resolve import")) {
        userFriendlyMessage = `Import resolution failed. Try using single-file mode (depth=0) or check import paths.`;
      } else if (errorMessage.includes("outside workspace boundary")) {
        userFriendlyMessage = `File is outside workspace boundary. Please open the file from within your workspace.`;
      }

      // Notify webview about error
      this._panel.webview.postMessage({
        command: "error",
        text: userFriendlyMessage,
      });

      vscode.window.showErrorMessage(
        `Failed to generate diagram: ${userFriendlyMessage}`,
      );
      console.error("Diagram generation error:", error);
    }
  }

  /**
   * Update the webview content
   */
  private _updateWebview(): void {
    this._panel.webview.html = this._getWebviewContent();
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    DiagramPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Get webview HTML content with interactive controls
   */
  private _getWebviewContent(): string {
    const nonce = this._getNonce();
    const fileName = this._currentFile
      ? vscode.workspace.asRelativePath(this._currentFile)
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;">
    <title>Goose Code Review - UML Diagram</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.35/dist/codicon.css">
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 0;
            margin: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        .toolbar {
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex-shrink: 0;
        }

        .toolbar-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .toolbar-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            min-width: 50px;
        }

        .depth-display {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            padding: 4px 12px;
            min-width: 30px;
            text-align: center;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .btn-group {
            display: flex;
            gap: 1px;
        }

        .btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid transparent;
            padding: 4px 8px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
            font-family: var(--vscode-font-family);
            transition: all 0.2s;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .btn .codicon {
            font-size: 13px;
        }

        .btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .btn.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-focusBorder);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }

        .btn-icon {
            padding: 4px 6px;
            min-width: 28px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .btn-icon .codicon {
            font-size: 16px;
        }

        .separator {
            width: 1px;
            height: 20px;
            background-color: var(--vscode-panel-border);
            margin: 0 4px;
        }

        .file-path {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
        }

        .diagram-container {
            flex: 1;
            overflow: hidden;
            background-color: #ffffff;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .mermaid {
            display: inline-block;
            transform-origin: center center;
            transition: transform 0.1s ease-out;
        }

        .mermaid svg {
            display: block;
            max-width: 100%;
            height: auto;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            gap: 12px;
        }

        .empty-state-icon {
            font-size: 48px;
            opacity: 0.5;
        }

        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            gap: 16px;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid var(--vscode-progressBar-background);
            border-top-color: var(--vscode-button-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .tooltip {
            position: relative;
            display: inline-block;
        }

        .tooltip .tooltiptext {
            visibility: hidden;
            width: 200px;
            background-color: var(--vscode-editorHoverWidget-background);
            color: var(--vscode-editorHoverWidget-foreground);
            border: 1px solid var(--vscode-editorHoverWidget-border);
            text-align: left;
            border-radius: 4px;
            padding: 8px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            margin-left: -100px;
            font-size: 12px;
            line-height: 1.4;
        }

        .tooltip:hover .tooltiptext {
            visibility: visible;
        }
    </style>
</head>
<body>
    <!-- Toolbar -->
    <div class="toolbar">
        <!-- Row 1: Diagram Type & Actions -->
        <div class="toolbar-row">
            <span class="toolbar-label">Type:</span>
            <div class="btn-group" id="typeSelector">
                <button class="btn ${this._currentType === "class" ? "active" : ""}" data-type="class">
                    Class
                </button>
                <button class="btn ${this._currentType === "sequence" ? "active" : ""}" data-type="sequence">
                    Sequence
                </button>
                <button class="btn ${this._currentType === "flowchart" ? "active" : ""}" data-type="flowchart">
                    Flowchart
                </button>

            </div>

            <div class="separator"></div>

            <button class="btn btn-primary btn-icon tooltip" id="refreshBtn" title="Refresh diagram">
                <i class="codicon codicon-refresh"></i>
                <span class="tooltiptext">Refresh diagram</span>
            </button>
            <button class="btn btn-icon tooltip" id="copyBtn" title="Copy Mermaid code">
                <i class="codicon codicon-copy"></i>
                <span class="tooltiptext">Copy Mermaid code to clipboard</span>
            </button>
            <button class="btn btn-icon tooltip" id="downloadBtn" title="Download SVG">
                <i class="codicon codicon-cloud-download"></i>
                <span class="tooltiptext">Download diagram as SVG file</span>
            </button>

            <div class="separator"></div>

            <span class="toolbar-label">Zoom:</span>
            <div class="btn-group" id="zoomControls">
                <button class="btn" id="zoomOutBtn" disabled>－</button>
                <button class="btn" id="zoomInBtn" disabled>＋</button>
                <button class="btn" id="resetZoomBtn" disabled>Reset</button>
            </div>
        </div>

        <!-- Row 2: Class & Sequence Diagram Options -->
        <div class="toolbar-row" id="classOptions" style="display: ${this._currentType === "class" || this._currentType === "sequence" ? "flex" : "none"}">
            <span class="toolbar-label tooltip">
                Depth:
                <span class="tooltiptext">
                    0: Single file only<br>
                    1-10: Cross-file analysis with increasing depth
                </span>
            </span>
            <div class="btn-group" id="depthSelector">
                <button class="btn" id="depthDecreaseBtn" ${this._currentOptions.depth === 0 ? "disabled" : ""}>－</button>
                <span class="depth-display" id="depthDisplay">${this._currentOptions.depth}</span>
                <button class="btn" id="depthIncreaseBtn" ${this._currentOptions.depth === 10 ? "disabled" : ""}>＋</button>
            </div>

            <span class="toolbar-label tooltip">
                Mode:
                <span class="tooltiptext">
                    Bidirectional: All dependencies (forward + reverse)<br>
                    Forward: What this file imports<br>
                    Reverse: What imports this file
                </span>
            </span>
            <div class="btn-group" id="modeSelector">
                <button class="btn tooltip ${this._currentOptions.mode === "bidirectional" ? "active" : ""}"
                        data-mode="bidirectional"
                        ${this._currentOptions.depth === 0 ? "disabled" : ""}>
                    <i class="codicon codicon-arrow-both"></i> Bidirectional
                    <span class="tooltiptext">Bidirectional: Show all dependencies (what this file imports + what imports this file)</span>
                </button>
                <button class="btn tooltip ${this._currentOptions.mode === "forward" ? "active" : ""}"
                        data-mode="forward"
                        ${this._currentOptions.depth === 0 ? "disabled" : ""}>
                    <i class="codicon codicon-arrow-right"></i> Forward
                    <span class="tooltiptext">Forward: Show only what this file imports</span>
                </button>
                <button class="btn tooltip ${this._currentOptions.mode === "reverse" ? "active" : ""}"
                        data-mode="reverse"
                        ${this._currentOptions.depth === 0 ? "disabled" : ""}>
                    <i class="codicon codicon-arrow-left"></i> Reverse
                    <span class="tooltiptext">Reverse: Show only what imports this file</span>
                </button>
            </div>
        </div>

        ${fileName ? `<div class="file-path">📄 ${fileName}</div>` : ""}
    </div>

    <!-- Diagram Display -->
    <div class="diagram-container" id="diagramContainer">
      ${
        this._mermaidCode
          ? `<div class="mermaid">${this._mermaidCode}</div>`
          : this._currentFile
            ? `
      <div class="loading">
        <div class="spinner"></div>
        <p>Generating ${this._currentType} diagram...</p>
      </div>
      `
            : `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>Select a supported file (TypeScript, JavaScript, Java, or Python) and click Refresh to generate a UML diagram</p>
      </div>
      `
      }
    </div>

    <!-- Hidden element to store Mermaid code for copying -->
    <div id="mermaid-code" style="display: none;">${this._mermaidCode}</div>

    <script type="module" nonce="${nonce}">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

        const vscode = acquireVsCodeApi();

        // State
        let state = {
            type: '${this._currentType}',
            depth: ${this._currentOptions.depth},
            mode: '${this._currentOptions.mode}',
            isLoading: false
        };

        // Native zoom and pan implementation
        let currentZoom = 1;
        let currentX = 0;
        let currentY = 0;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let zoomReady = false;

        const ZOOM_STEP = 1.2;
        const MIN_ZOOM = 0.2;
        const MAX_ZOOM = 10;

        function applyTransform() {
            const container = document.querySelector('.mermaid');
            if (container) {
                container.style.transform = \`translate(\${currentX}px, \${currentY}px) scale(\${currentZoom})\`;
            }
        }

        function zoomIn() {
            currentZoom = Math.min(currentZoom * ZOOM_STEP, MAX_ZOOM);
            applyTransform();
        }

        function zoomOut() {
            currentZoom = Math.max(currentZoom / ZOOM_STEP, MIN_ZOOM);
            applyTransform();
        }

        function resetZoom() {
            currentZoom = 1;
            currentX = 0;
            currentY = 0;
            applyTransform();
        }

        function setupPanZoom() {
            const container = document.getElementById('diagramContainer');
            if (!container) return;

            // Mouse wheel zoom
            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY;
                if (delta < 0) {
                    zoomIn();
                } else {
                    zoomOut();
                }
            });

            // Drag to pan
            container.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left mouse button
                    isDragging = true;
                    dragStartX = e.clientX - currentX;
                    dragStartY = e.clientY - currentY;
                    container.style.cursor = 'grabbing';
                    e.preventDefault();
                }
            });

            container.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    currentX = e.clientX - dragStartX;
                    currentY = e.clientY - dragStartY;
                    applyTransform();
                }
            });

            const stopDragging = () => {
                if (isDragging) {
                    isDragging = false;
                    container.style.cursor = 'grab';
                }
            };

            container.addEventListener('mouseup', stopDragging);
            container.addEventListener('mouseleave', stopDragging);

            container.style.cursor = 'grab';
            zoomReady = true;
            enableZoomButtons();
        }

        function enableZoomButtons() {
            const inBtn = document.getElementById('zoomInBtn');
            const outBtn = document.getElementById('zoomOutBtn');
            const resetBtn = document.getElementById('resetZoomBtn');

            if (inBtn) inBtn.disabled = false;
            if (outBtn) outBtn.disabled = false;
            if (resetBtn) resetBtn.disabled = false;
        }

        function initZoomIfReady() {
            if (zoomReady) return;

            const checkSvg = () => {
                const svg = document.querySelector('.mermaid svg');
                if (svg) {
                    setupPanZoom();
                    return true;
                }
                return false;
            };

            // Try immediate setup
            if (checkSvg()) return;

            // Wait for SVG to load
            const observer = new MutationObserver(() => {
                if (checkSvg()) {
                    observer.disconnect();
                }
            });

            const container = document.getElementById('diagramContainer');
            if (container) {
                observer.observe(container, { childList: true, subtree: true });
            }
        }

        // Initialize Mermaid
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'var(--vscode-font-family)',
        });

        // Event Listeners
        document.getElementById('typeSelector').addEventListener('click', (e) => {
            if (e.target.matches('.btn')) {
                const type = e.target.dataset.type;
                if (type && type !== state.type) {
                    state.type = type;
                    updateButtons();
                    regenerate();
                }
            }
        });

        document.getElementById('depthDecreaseBtn').addEventListener('click', () => {
            if (state.depth > 0) {
                state.depth--;
                updateButtons();
                regenerate();
            }
        });

        document.getElementById('depthIncreaseBtn').addEventListener('click', () => {
            if (state.depth < 10) {
                state.depth++;
                updateButtons();
                regenerate();
            }
        });

        document.getElementById('modeSelector').addEventListener('click', (e) => {
            if (e.target.matches('.btn:not([disabled])')) {
                const mode = e.target.dataset.mode;
                if (mode && mode !== state.mode) {
                    state.mode = mode;
                    updateButtons();
                    regenerate();
                }
            }
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            regenerate();
        });

        document.getElementById('copyBtn').addEventListener('click', () => {
            const mermaidCode = document.getElementById('mermaid-code')?.textContent;
            if (mermaidCode) {
                navigator.clipboard.writeText(mermaidCode.trim()).then(() => {
                    vscode.postMessage({ type: 'info', text: 'Mermaid code copied to clipboard' });
                }).catch(err => {
                    vscode.postMessage({ type: 'error', text: 'Failed to copy: ' + err.message });
                });
            }
        });

        document.getElementById('downloadBtn').addEventListener('click', async () => {
            try {
                const svgElement = document.querySelector('.mermaid svg');
                if (!svgElement) {
                    throw new Error('No diagram to download');
                }

                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svgElement);
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = \`diagram-\${state.type}-\${Date.now()}.svg\`;
                a.click();

                URL.revokeObjectURL(url);

                vscode.postMessage({ type: 'info', text: 'SVG downloaded successfully' });
            } catch (err) {
                vscode.postMessage({ type: 'error', text: 'Failed to download: ' + err.message });
            }
        });

        document.getElementById('zoomInBtn').addEventListener('click', () => {
            zoomIn();
        });

        document.getElementById('zoomOutBtn').addEventListener('click', () => {
            zoomOut();
        });

        document.getElementById('resetZoomBtn').addEventListener('click', () => {
            resetZoom();
        });

        (async () => {
            try {
                await mermaid.run({ querySelector: '.mermaid' });
            } catch {}
            initZoomIfReady();
        })();

        // Functions
        function regenerate() {
            vscode.postMessage({
                command: 'regenerate',
                type: state.type,
                options: {
                    depth: state.depth,
                    mode: state.mode
                }
            });
        }

        function updateButtons() {
            // Update type buttons
            document.querySelectorAll('#typeSelector .btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === state.type);
            });

            // Update depth display and buttons
            const depthDisplay = document.getElementById('depthDisplay');
            const depthDecreaseBtn = document.getElementById('depthDecreaseBtn');
            const depthIncreaseBtn = document.getElementById('depthIncreaseBtn');
            
            if (depthDisplay) {
                depthDisplay.textContent = state.depth.toString();
            }
            if (depthDecreaseBtn) {
                depthDecreaseBtn.disabled = state.depth === 0;
            }
            if (depthIncreaseBtn) {
                depthIncreaseBtn.disabled = state.depth === 10;
            }

            // Update mode buttons
            const modeButtons = document.querySelectorAll('#modeSelector .btn');
            modeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === state.mode);
                btn.disabled = state.depth === 0;
            });

            // Show/hide class & sequence options
            const classOptions = document.getElementById('classOptions');
            classOptions.style.display = (state.type === 'class' || state.type === 'sequence') ? 'flex' : 'none';
        }

        function disableZoomButtons() {
            console.log('[Zoom] Disabling zoom buttons');
            const inBtn = document.getElementById('zoomInBtn');
            const outBtn = document.getElementById('zoomOutBtn');
            const resetBtn = document.getElementById('resetZoomBtn');

            if (inBtn) inBtn.disabled = true;
            if (outBtn) outBtn.disabled = true;
            if (resetBtn) resetBtn.disabled = true;
        }

        function showLoading() {
            // Reset zoom state when loading new diagram
            zoomReady = false;
            currentZoom = 1;
            currentX = 0;
            currentY = 0;
            disableZoomButtons();

            const container = document.getElementById('diagramContainer');
            container.innerHTML = \`
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Generating \${state.type} diagram...</p>
                </div>
            \`;
        }

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'loading':
                    if (message.isLoading) {
                        showLoading();
                    }
                    break;
                case 'error':
                    vscode.postMessage({ type: 'error', text: message.text });
                    break;
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate nonce for CSP
   */
  private _getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
