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

  it("should handle TagController.java with complex Swagger annotations", async () => {
    const code = `
package tw.com.webcomm.rest.tagEngine.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Tag(name = "標籤管理", description = "提供標籤的建立、查詢等操作")
@RestController
@RequiredArgsConstructor
public class TagController {
    private final TagService tagService;
    private final TagMapper tagMapper;

    @Operation(summary = "取得內容對照表", description = "取得指定類型的顯示文字對照表")
    @SecurityRequirement(name = "Bearer Authentication")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "查詢成功", content = @Content(schema = @Schema(implementation = GetContentMappingsResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "請求參數錯誤")
    })
    @GetMapping("/content_mapping")
    public ApiResponse<GetContentMappingsResponse> getContentMappings(
            @Parameter(description = "內容類型代碼", required = true, example = "tag_type") @RequestParam(value = "content_type") String contentType) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Operation(summary = "建立新標籤", description = "根據規則條件或自訂客戶清單建立新的標籤")
    @SecurityRequirement(name = "Bearer Authentication")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "建立成功", content = @Content(schema = @Schema(implementation = TagStatusDto.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "請求參數錯誤")
    })
    @PostMapping("/tag_create")
    public ApiResponse<TagStatusDto> createTag(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "標籤建立請求參數", required = true, content = @Content(schema = @Schema(implementation = SetTagRequest.class))) @RequestBody SetTagRequest request) {
        log.info("Creating tag with name: {}", request.getTagName());
        CreateTagCommand command = tagMapper.toCreateTagCommand(request);
        CreateTagResult result = tagService.createTag(command);
        TagStatusDto response = tagMapper.toTagStatusDto(result);
        log.info("Tag created successfully with id: {}", response.getTagId());
        return ApiResponse.success(response);
    }
}
    `;

    // Should not throw an error when parsing complex Swagger annotations
    const ast = await parserService.parse(code, "TagController.java");

    // Verify the class was parsed correctly
    expect(ast.classes).toHaveLength(1);
    expect(ast.classes[0].name).toBe("TagController");
    expect(ast.classes[0].methods.length).toBeGreaterThanOrEqual(2);

    // Verify methods are correctly parsed
    const methodNames = ast.classes[0].methods.map((m) => m.name);
    expect(methodNames).toContain("getContentMappings");
    expect(methodNames).toContain("createTag");
  });
});
