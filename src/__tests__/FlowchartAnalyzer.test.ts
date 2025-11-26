import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FlowchartAnalyzer } from "../core/analyzers/FlowchartAnalyzer.js";
import { PythonParser } from "../core/parsers/python/PythonParser.js";
import { JavaScriptParser } from "../core/parsers/typescript/JavaScriptParser.js";
import { TypeScriptParser } from "../core/parsers/typescript/TypeScriptParser.js";
import { ParserService } from "../core/services/ParserService.js";
import { InMemoryFileProvider } from "../core/__tests__/helpers/InMemoryFileProvider.js";

import { JavaParser } from "../core/parsers/java/JavaParser.js";

describe("FlowchartAnalyzer", () => {
  let analyzer: FlowchartAnalyzer;
  let parserService: ParserService;
  let fileProvider: InMemoryFileProvider;

  beforeAll(() => {
    parserService = ParserService.getInstance();
    try {
      parserService.registerParser(new JavaScriptParser());
      parserService.registerParser(new TypeScriptParser());
      parserService.registerParser(new PythonParser());
      parserService.registerParser(new JavaParser());
    } catch {
      // Ignore if already registered
    }
  });

  beforeEach(() => {
    fileProvider = new InMemoryFileProvider();
    analyzer = new FlowchartAnalyzer(fileProvider);
  });

  it("should generate flowchart for simple function", async () => {
    const code = `
      function hello() {
        console.log("Hello");
      }
    `;
    const ast = await parserService.parse(code, "test.js");
    const mermaid = await analyzer.analyze(ast);

    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain("subgraph subgraph_hello_N");
    expect(mermaid).toContain("(Start)");
    expect(mermaid).toContain("(End)");
    // Expect escaped characters: ( -> &#40;, ) -> &#41;, " -> &quot;, ' -> &apos;
    // Note: The analyzer replaces " with &quot; and ' with &apos;
    // console.log("Hello") -> console.log&#40;&quot;Hello&quot;&#41;
    expect(mermaid).toContain('["console.log#40;#quot;Hello#quot;#41;;"]');
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
    const mermaid = await analyzer.analyze(ast);

    // x > 0? -> x &gt; 0?
    expect(mermaid).toContain('{"x #gt; 0?"}');
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
    const mermaid = await analyzer.analyze(ast);

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
    const mermaid = await analyzer.analyze(ast);

    expect(mermaid).toContain("subgraph subgraph_test_N");
    expect(mermaid).toContain('{"True?"}');
    // print("Yes") -> print&#40;&quot;Yes&quot;&#41;
    expect(mermaid).toContain('["print#40;#quot;Yes#quot;#41;"]');
    expect(mermaid).toContain('["print#40;#quot;No#quot;#41;"]');
  });

  it("should handle special characters in labels", async () => {
    const code = `
      function special() {
        const a = "arrow ->";
        const b = "brackets []";
        const c = "braces {}";
        const d = "pipes ||";
        const e = "quotes ' \\"";
      }
    `;
    const ast = await parserService.parse(code, "test.js");
    const mermaid = await analyzer.analyze(ast);

    // Check for escaped characters
    expect(mermaid).toContain("#gt;"); // >
    expect(mermaid).toContain("#91;"); // [
    expect(mermaid).toContain("#93;"); // ]
    expect(mermaid).toContain("#123;"); // {
    expect(mermaid).toContain("#125;"); // }
    expect(mermaid).toContain("#124;"); // |
    expect(mermaid).toContain("#quot;"); // "
    expect(mermaid).toContain("#apos;"); // '
  });

  it("should handle java code with nested quotes (reproduction)", async () => {
    const code = `
      public class Test {
        public void generateTemplateId() {
           log.info("generateTemplateId templateId: {}", consoleTemplateContentFillId);
        }
      }
    `;
    // Note: Using java parser
    const ast = await parserService.parse(code, "Test.java");
    // We need to ensure Java parser is registered. It is in beforeAll.
    // But we need to make sure the language is detected as java.
    // The parser service uses extension to detect language.

    const mermaid = await analyzer.analyze(ast);

    // log.info("...") -> log.info&#40;&quot;...&quot;, ...&#41;
    expect(mermaid).toContain(
      "log.info#40;#quot;generateTemplateId templateId: #123;#125;#quot;, consoleTemplateContentFillId#41;",
    );
  });

  it("should handle if statement with quotes (reproduction 2)", async () => {
    const code = `
      public class Test {
        public void getSender() {
           if (sendFromKey.contains(".")) {
             return;
           }
        }
      }
    `;
    const ast = await parserService.parse(code, "Test.java");
    const mermaid = await analyzer.analyze(ast);

    // if (sendFromKey.contains(".")) -> if (sendFromKey.contains(&quot;.&quot;))
    // And then sanitizeLabel escapes ( ) " .
    // ( -> &#40;
    // ) -> &#41;
    // " -> &quot;
    // . -> . (not escaped)

    // Original text: sendFromKey.contains(".")
    // Escaped: sendFromKey.contains&#40;&quot;.&quot;&#41;

    // Mermaid output for condition: {"..."}
    expect(mermaid).toContain('{"sendFromKey.contains#40;#quot;.#quot;#41;?"}');
  });
});
