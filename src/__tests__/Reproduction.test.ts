import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FlowchartAnalyzer } from "../core/analyzers/FlowchartAnalyzer.js";
import { JavaParser } from "../core/parsers/java/JavaParser.js";
import { ParserService } from "../core/services/ParserService.js";
import { InMemoryFileProvider } from "../core/__tests__/helpers/InMemoryFileProvider.js";

describe("Reproduction", () => {
  let analyzer: FlowchartAnalyzer;
  let parserService: ParserService;
  let fileProvider: InMemoryFileProvider;

  beforeAll(() => {
    parserService = ParserService.getInstance();
    try {
      parserService.registerParser(new JavaParser());
    } catch {
      // Ignore if already registered
    }
  });

  beforeEach(() => {
    fileProvider = new InMemoryFileProvider();
    analyzer = new FlowchartAnalyzer(fileProvider);
  });

  it("should handle ConsoleSendCoreService.java", async () => {
    const code = `
package tw.com.webcomm.core.service.console;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import tw.com.webcomm.core.data.console.entity.ConsoleSystemConfigDetailEntity;
import tw.com.webcomm.core.exception.ServiceException;
import tw.com.webcomm.core.persistence.console.SystemConfigDetailEnum;
import tw.com.webcomm.core.persistence.console.SystemConfigEnum;
import tw.com.webcomm.core.persistence.console.error.ConsoleErrorMessage;
import tw.com.webcomm.core.service.console.vo.ConsoleSendConfig;
import tw.com.webcomm.core.service.console.vo.ConsoleSystemConfigDetail;

import java.util.List;

@Service
public class ConsoleSendCoreService {

    @Autowired private ConsoleSystemConfigCoreService consoleSystemConfigCoreService;

    public ConsoleSendConfig getSender(String sendFromKey) {
        if (sendFromKey.contains(".")) {
            String prefix = sendFromKey.split("\\\\.")[0];
            String suffix = sendFromKey.split("\\\\.")[1];

            SystemConfigEnum systemConfigEnum = SystemConfigEnum.valueOf(prefix);
            return getSender(systemConfigEnum, suffix);
        } else {
            throw new ServiceException(ConsoleErrorMessage.CONSOLE_SYSTEM_CONFIG_DETAIL_NOT_FOUND);
        }
    }
}
    `;
    const ast = await parserService.parse(code, "ConsoleSendCoreService.java");
    const mermaid = await analyzer.analyze(ast);

    // Check for escaped characters in the if condition
    // sendFromKey.contains(".") -> sendFromKey.contains#40;#quot;.#quot;#41;
    expect(mermaid).toContain('{"sendFromKey.contains#40;#quot;.#quot;#41;?"}');
  });
});
