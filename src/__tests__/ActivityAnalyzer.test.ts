import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ActivityAnalyzer } from "../core/analyzers/ActivityAnalyzer.js";
import { PythonParser } from "../core/parsers/python/PythonParser.js";
import { JavaScriptParser } from "../core/parsers/typescript/JavaScriptParser.js";
import { TypeScriptParser } from "../core/parsers/typescript/TypeScriptParser.js";
import { ParserService } from "../core/services/ParserService.js";

describe("ActivityAnalyzer", () => {
  let analyzer: ActivityAnalyzer;
  let parserService: ParserService;

  beforeAll(() => {
    parserService = ParserService.getInstance();
    // Register parsers manually for testing if needed, or rely on singleton initialization
    // But singleton might be empty if not initialized.
    // Let's register them to be safe.
    try {
      parserService.registerParser(new JavaScriptParser());
      parserService.registerParser(new TypeScriptParser());
      parserService.registerParser(new PythonParser());
    } catch {
      // Ignore if already registered
    }
  });

  beforeEach(() => {
    analyzer = new ActivityAnalyzer();
  });

  it("should generate flowchart for simple function", async () => {
    const code = `
      function hello() {
        console.log("Hello");
      }
    `;
    const ast = await parserService.parse(code, "test.js");
    const mermaid = analyzer.analyze(ast);

    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain("subgraph subgraph_hello_N");
    expect(mermaid).toContain("(Start)");
    expect(mermaid).toContain("(End)");
    expect(mermaid).toContain("[\"console.log('Hello');\"]");
  });

  it("should handle if/else statements", async () => {
    const code = `
      function check(x) {
        if (x > 0) {
          return true;
        } else {
          return false;
        }
      }
    `;
    const ast = await parserService.parse(code, "test.js");
    const mermaid = analyzer.analyze(ast);

    expect(mermaid).toContain('{"x > 0?"}');
    // Mermaid syntax check - exact match might be tricky due to whitespace or IDs
    // We check for key components
    expect(mermaid).toContain("-->");
    expect(mermaid).toContain('["return true;"]');
    expect(mermaid).toContain('["return false;"]');
  });

  it("should handle while loops", async () => {
    const code = `
      function loop() {
        while (true) {
          break;
        }
      }
    `;
    const ast = await parserService.parse(code, "test.js");
    const mermaid = analyzer.analyze(ast);

    expect(mermaid).toContain('{"true"}');
    expect(mermaid).toContain("-- Done -->");
  });

  it("should handle python code", async () => {
    const code = `
def test():
    if True:
        print("Yes")
    else:
        print("No")
    `;
    const ast = await parserService.parse(code, "test.py");
    const mermaid = analyzer.analyze(ast);

    expect(mermaid).toContain("subgraph subgraph_test_N");
    expect(mermaid).toContain('{"True?"}');
    expect(mermaid).toContain("[\"print('Yes')\"]");
    expect(mermaid).toContain("[\"print('No')\"]");
  });
});
