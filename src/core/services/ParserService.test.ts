import { describe, it, expect, beforeEach } from "vitest";
import { ParserService } from "./ParserService.js";
import { registerTestParsers } from "../__tests__/helpers/registerParsers.js";

describe("ParserService", () => {
  beforeEach(() => {
    // Reset singleton instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ParserService as any).instance = undefined;
    registerTestParsers();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = ParserService.getInstance();
      const instance2 = ParserService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("registerParser", () => {
    it("should register a parser", () => {
      const service = ParserService.getInstance();
      const mockParser = {
        getSupportedLanguage: () => "go" as const,
        parse: async () => ({
          classes: [],
          interfaces: [],
          functions: [],
          imports: [],
          language: "go",
        }),
      };

      service.registerParser(mockParser);
      expect(service.getSupportedLanguages()).toContain("go");
    });
  });

  describe("parse", () => {
    it("should parse TypeScript code", async () => {
      const service = ParserService.getInstance();
      const code = "export class User {}";
      const ast = await service.parse(code, "test.ts");

      expect(ast.language).toBe("typescript");
      expect(ast.classes).toBeDefined();
    });

    it("should parse JavaScript code", async () => {
      const service = ParserService.getInstance();
      const code = "export class User {}";
      const ast = await service.parse(code, "test.js");

      expect(ast.language).toBe("javascript");
    });

    it("should parse Java code", async () => {
      const service = ParserService.getInstance();
      const code = "public class User {}";
      const ast = await service.parse(code, "test.java");

      expect(ast.language).toBe("java");
    });

    it("should parse Python code", async () => {
      const service = ParserService.getInstance();
      const code = "class User:\n    pass";
      const ast = await service.parse(code, "test.py");

      expect(ast.language).toBe("python");
    });

    it("should throw error for unsupported file type", async () => {
      const service = ParserService.getInstance();
      await expect(service.parse("code", "test.txt")).rejects.toThrow(
        "Unsupported file type",
      );
    });

    it("should throw error if no parser is available", async () => {
      const service = ParserService.getInstance();
      // This should not happen if parsers are registered, but test the error path
      // We can't easily test this without unregistering all parsers
      // So we'll test with an unsupported language
      await expect(service.parse("code", "test.go")).rejects.toThrow();
    });
  });

  describe("canParse", () => {
    it("should return true for supported file types", () => {
      const service = ParserService.getInstance();
      expect(service.canParse("test.ts")).toBe(true);
      expect(service.canParse("test.js")).toBe(true);
      expect(service.canParse("test.java")).toBe(true);
      expect(service.canParse("test.py")).toBe(true);
    });

    it("should return false for unsupported file types", () => {
      const service = ParserService.getInstance();
      expect(service.canParse("test.txt")).toBe(false);
      expect(service.canParse("test.md")).toBe(false);
    });
  });

  describe("detectLanguage", () => {
    it("should detect TypeScript", () => {
      const service = ParserService.getInstance();
      expect(service.detectLanguage("test.ts")).toBe("typescript");
      expect(service.detectLanguage("test.tsx")).toBe("typescript");
    });

    it("should detect JavaScript", () => {
      const service = ParserService.getInstance();
      expect(service.detectLanguage("test.js")).toBe("javascript");
      expect(service.detectLanguage("test.jsx")).toBe("javascript");
    });

    it("should detect Java", () => {
      const service = ParserService.getInstance();
      expect(service.detectLanguage("test.java")).toBe("java");
    });

    it("should detect Python", () => {
      const service = ParserService.getInstance();
      expect(service.detectLanguage("test.py")).toBe("python");
    });

    it("should return null for unsupported files", () => {
      const service = ParserService.getInstance();
      expect(service.detectLanguage("test.txt")).toBeNull();
    });
  });

  describe("getParser", () => {
    it("should return parser for registered language", async () => {
      const service = ParserService.getInstance();
      const parser = await service.getParser("typescript");
      expect(parser).toBeDefined();
      expect(parser?.getSupportedLanguage()).toBe("typescript");
    });

    it("should return undefined for unregistered language", async () => {
      const service = ParserService.getInstance();
      const parser = await service.getParser("go");
      expect(parser).toBeUndefined();
    });
  });

  describe("getParserForFile", () => {
    it("should return parser for file path", async () => {
      const service = ParserService.getInstance();
      const parser = await service.getParserForFile("test.ts");
      expect(parser).toBeDefined();
      expect(parser?.getSupportedLanguage()).toBe("typescript");
    });

    it("should return undefined for unsupported file", async () => {
      const service = ParserService.getInstance();
      const parser = await service.getParserForFile("test.txt");
      expect(parser).toBeUndefined();
    });
  });

  describe("getSupportedLanguages", () => {
    it("should return list of supported languages", () => {
      const service = ParserService.getInstance();
      const languages = service.getSupportedLanguages();
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain("typescript");
      expect(languages).toContain("javascript");
      expect(languages).toContain("java");
      expect(languages).toContain("python");
    });
  });
});
