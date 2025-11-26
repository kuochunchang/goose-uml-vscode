import { describe, it, expect } from "vitest";
import {
  isSupportedLanguage,
  getLanguageName,
  getSupportedLanguagesList,
  isDiagramTypeSupported,
  getUnsupportedDiagramTypeMessage,
  SUPPORTED_LANGUAGE_IDS,
} from "./language-support.js";

describe("language-support", () => {
  describe("isSupportedLanguage", () => {
    it("should return true for supported languages", () => {
      expect(isSupportedLanguage("typescript")).toBe(true);
      expect(isSupportedLanguage("javascript")).toBe(true);
      expect(isSupportedLanguage("typescriptreact")).toBe(true);
      expect(isSupportedLanguage("javascriptreact")).toBe(true);
      expect(isSupportedLanguage("java")).toBe(true);
      expect(isSupportedLanguage("python")).toBe(true);
    });

    it("should return false for unsupported languages", () => {
      expect(isSupportedLanguage("csharp")).toBe(false);
      expect(isSupportedLanguage("go")).toBe(false);
      expect(isSupportedLanguage("rust")).toBe(false);
      expect(isSupportedLanguage("")).toBe(false);
    });
  });

  describe("getLanguageName", () => {
    it("should return correct language names", () => {
      expect(getLanguageName("typescript")).toBe("TypeScript");
      expect(getLanguageName("javascript")).toBe("JavaScript");
      expect(getLanguageName("typescriptreact")).toBe("TypeScript React");
      expect(getLanguageName("javascriptreact")).toBe("JavaScript React");
      expect(getLanguageName("java")).toBe("Java");
      expect(getLanguageName("python")).toBe("Python");
    });

    it("should return language ID for unknown languages", () => {
      expect(getLanguageName("unknown")).toBe("unknown");
      expect(getLanguageName("csharp")).toBe("csharp");
    });
  });

  describe("getSupportedLanguagesList", () => {
    it("should return formatted list of supported languages", () => {
      const result = getSupportedLanguagesList();
      expect(result).toBe("TypeScript, JavaScript, Java, and Python");
    });
  });

  describe("isDiagramTypeSupported", () => {
    it("should return true for class diagrams for all supported languages", () => {
      for (const lang of SUPPORTED_LANGUAGE_IDS) {
        expect(isDiagramTypeSupported(lang, "class")).toBe(true);
      }
    });

    it("should return false for class diagrams for unsupported languages", () => {
      expect(isDiagramTypeSupported("csharp", "class")).toBe(false);
      expect(isDiagramTypeSupported("go", "class")).toBe(false);
    });

    it("should return true for sequence diagrams for TS/JS languages", () => {
      expect(isDiagramTypeSupported("typescript", "sequence")).toBe(true);
      expect(isDiagramTypeSupported("javascript", "sequence")).toBe(true);
      expect(isDiagramTypeSupported("typescriptreact", "sequence")).toBe(true);
      expect(isDiagramTypeSupported("javascriptreact", "sequence")).toBe(true);
    });

    it("should return false for sequence diagrams for non-TS/JS languages", () => {
      expect(isDiagramTypeSupported("java", "sequence")).toBe(false);
      expect(isDiagramTypeSupported("python", "sequence")).toBe(false);
      expect(isDiagramTypeSupported("csharp", "sequence")).toBe(false);
    });
  });

  describe("getUnsupportedDiagramTypeMessage", () => {
    it("should return appropriate message for unsupported sequence diagram", () => {
      const message = getUnsupportedDiagramTypeMessage("java", "sequence");
      expect(message).toContain("sequence diagrams are currently only supported");
      expect(message).toContain("TypeScript/JavaScript");
      expect(message).toContain("Java");
    });

    it("should return appropriate message for unsupported class diagram", () => {
      const message = getUnsupportedDiagramTypeMessage("csharp", "class");
      expect(message).toContain("class diagrams are not supported");
      expect(message).toContain("csharp");
    });
  });
});

