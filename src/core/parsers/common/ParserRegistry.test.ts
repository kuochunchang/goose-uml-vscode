import { describe, it, expect, beforeEach } from "vitest";
import { ParserRegistry } from "./ParserRegistry.js";
import type { ILanguageParser } from "./ILanguageParser.js";
import { registerTestParsers } from "../../__tests__/helpers/registerParsers.js";

describe("ParserRegistry", () => {
  let registry: ParserRegistry;
  let mockParser: ILanguageParser;

  beforeEach(() => {
    registry = new ParserRegistry();
    mockParser = {
      getSupportedLanguage: () => "typescript" as const,
      parse: async () => ({
        classes: [],
        interfaces: [],
        functions: [],
        imports: [],
        language: "typescript",
      }),
    };
  });

  describe("register", () => {
    it("should register a parser", () => {
      registry.register(mockParser);
      expect(registry.hasParser("typescript")).toBe(true);
    });

    it("should throw error if parser is already registered", () => {
      registry.register(mockParser);
      expect(() => registry.register(mockParser)).toThrow(
        "Parser for language 'typescript' is already registered",
      );
    });

    it("should throw error if lazy parser is already registered", () => {
      registry.registerLazy("typescript", async () => mockParser);
      expect(() => registry.register(mockParser)).toThrow(
        "Parser for language 'typescript' is already registered",
      );
    });
  });

  describe("registerLazy", () => {
    it("should register a lazy parser factory", () => {
      registry.registerLazy("typescript", async () => mockParser);
      expect(registry.hasParser("typescript")).toBe(true);
    });

    it("should throw error if parser is already registered", () => {
      registry.register(mockParser);
      expect(() =>
        registry.registerLazy("typescript", async () => mockParser),
      ).toThrow("Parser for language 'typescript' is already registered");
    });

    it("should throw error if lazy parser is already registered", () => {
      registry.registerLazy("typescript", async () => mockParser);
      expect(() =>
        registry.registerLazy("typescript", async () => mockParser),
      ).toThrow("Parser for language 'typescript' is already registered");
    });
  });

  describe("getParser", () => {
    it("should return registered parser", async () => {
      registry.register(mockParser);
      const parser = await registry.getParser("typescript");
      expect(parser).toBe(mockParser);
    });

    it("should return undefined for unregistered language", async () => {
      const parser = await registry.getParser("python");
      expect(parser).toBeUndefined();
    });

    it("should initialize lazy parser on first call", async () => {
      let initialized = false;
      const factory = async () => {
        initialized = true;
        return mockParser;
      };
      registry.registerLazy("typescript", factory);

      expect(initialized).toBe(false);
      const parser = await registry.getParser("typescript");
      expect(initialized).toBe(true);
      expect(parser).toBe(mockParser);
    });

    it("should cache lazy parser after initialization", async () => {
      let callCount = 0;
      const factory = async () => {
        callCount++;
        return mockParser;
      };
      registry.registerLazy("typescript", factory);

      await registry.getParser("typescript");
      await registry.getParser("typescript");
      await registry.getParser("typescript");

      expect(callCount).toBe(1);
    });

    it("should throw error if lazy factory returns wrong parser", async () => {
      const wrongParser: ILanguageParser = {
        getSupportedLanguage: () => "javascript" as const,
        parse: async () => ({
          classes: [],
          interfaces: [],
          functions: [],
          imports: [],
          language: "javascript",
        }),
      };
      registry.registerLazy("typescript", async () => wrongParser);

      await expect(registry.getParser("typescript")).rejects.toThrow(
        "Parser factory for 'typescript' returned parser for 'javascript'",
      );
    });
  });

  describe("getParserForFile", () => {
    it("should return parser for detected language", async () => {
      registry.register(mockParser);
      const parser = await registry.getParserForFile("test.ts");
      expect(parser).toBe(mockParser);
    });

    it("should return undefined for unsupported file", async () => {
      const parser = await registry.getParserForFile("test.txt");
      expect(parser).toBeUndefined();
    });

    it("should throw error if language detected but parser not registered", async () => {
      await expect(registry.getParserForFile("test.ts")).rejects.toThrow(
        "Language 'typescript' detected for file 'test.ts' but no parser is registered",
      );
    });
  });

  describe("hasParser", () => {
    it("should return true for registered parser", () => {
      registry.register(mockParser);
      expect(registry.hasParser("typescript")).toBe(true);
    });

    it("should return true for lazy registered parser", () => {
      registry.registerLazy("typescript", async () => mockParser);
      expect(registry.hasParser("typescript")).toBe(true);
    });

    it("should return false for unregistered language", () => {
      expect(registry.hasParser("python")).toBe(false);
    });
  });

  describe("getRegisteredLanguages", () => {
    it("should return empty array for new registry", () => {
      expect(registry.getRegisteredLanguages()).toEqual([]);
    });

    it("should return registered languages", () => {
      registry.register(mockParser);
      const languages = registry.getRegisteredLanguages();
      expect(languages).toContain("typescript");
    });

    it("should return lazy registered languages", () => {
      registry.registerLazy("python", async () => mockParser);
      const languages = registry.getRegisteredLanguages();
      expect(languages).toContain("python");
    });

    it("should return all registered languages", () => {
      const javaParser: ILanguageParser = {
        getSupportedLanguage: () => "java" as const,
        parse: async () => ({
          classes: [],
          interfaces: [],
          functions: [],
          imports: [],
          language: "java",
        }),
      };
      registry.register(mockParser);
      registry.register(javaParser);
      registry.registerLazy("python", async () => mockParser);

      const languages = registry.getRegisteredLanguages();
      expect(languages).toContain("typescript");
      expect(languages).toContain("java");
      expect(languages).toContain("python");
      expect(languages.length).toBe(3);
    });
  });

  describe("clear", () => {
    it("should clear all registered parsers", () => {
      registry.register(mockParser);
      registry.registerLazy("python", async () => mockParser);

      registry.clear();

      expect(registry.getRegisteredLanguages()).toEqual([]);
      expect(registry.hasParser("typescript")).toBe(false);
      expect(registry.hasParser("python")).toBe(false);
    });
  });

  describe("unregister", () => {
    it("should unregister eager parser", () => {
      registry.register(mockParser);
      const removed = registry.unregister("typescript");
      expect(removed).toBe(true);
      expect(registry.hasParser("typescript")).toBe(false);
    });

    it("should unregister lazy parser", () => {
      registry.registerLazy("typescript", async () => mockParser);
      const removed = registry.unregister("typescript");
      expect(removed).toBe(true);
      expect(registry.hasParser("typescript")).toBe(false);
    });

    it("should return false if parser not found", () => {
      const removed = registry.unregister("python");
      expect(removed).toBe(false);
    });

    it("should clear lazy parser cache when unregistering", async () => {
      registry.registerLazy("typescript", async () => mockParser);
      await registry.getParser("typescript"); // Initialize and cache
      registry.unregister("typescript");
      // Cache should be cleared
      expect(registry.hasParser("typescript")).toBe(false);
    });
  });
});

