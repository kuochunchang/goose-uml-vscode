import { describe, it, expect, beforeEach } from "vitest";
import { FlowchartAnalyzer } from "./FlowchartAnalyzer.js";
import { InMemoryFileProvider } from "../__tests__/helpers/InMemoryFileProvider.js";
import { registerTestParsers } from "../__tests__/helpers/registerParsers.js";
import { ParserService } from "../services/ParserService.js";
import { UnifiedAST } from "../types/index.js";

describe("FlowchartAnalyzer Cross-File", () => {
  let fileProvider: InMemoryFileProvider;
  let analyzer: FlowchartAnalyzer;
  let parserService: ParserService;

  beforeEach(() => {
    registerTestParsers();
    fileProvider = new InMemoryFileProvider();
    analyzer = new FlowchartAnalyzer(fileProvider);
    parserService = ParserService.getInstance();
  });

  it("should generate swimlanes for cross-file function calls", async () => {
    // Setup files
    const controllerCode = `
      import { serviceFunction } from './service';
      export function controller() {
        serviceFunction();
      }
    `;
    const serviceCode = `
      export function serviceFunction() {
        console.log("Service");
      }
    `;

    fileProvider.addFile("/src/controller.ts", controllerCode);
    fileProvider.addFile("/src/service.ts", serviceCode);

    // Parse controller
    const ast = await parserService.parse(controllerCode, "/src/controller.ts");

    // Analyze with depth 1
    const mermaid = await analyzer.analyze(ast as UnifiedAST, { depth: 1 });

    // Verify swimlanes
    expect(mermaid).toContain('subgraph _src_controller_ts ["controller.ts"]');
    expect(mermaid).toContain('subgraph _src_service_ts ["service.ts"]');

    // Verify nodes
    expect(mermaid).toContain("controller");
    expect(mermaid).toContain("serviceFunction");

    // Verify link between files
    // We expect a dotted link for cross-file calls
    expect(mermaid).toMatch(/-.->/);
  });
});
