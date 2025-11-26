import { describe, it, expect } from "vitest";
import { LanguageDetector } from "./LanguageDetector.js";

describe("LanguageDetector", () => {
  describe("detectFromFilePath", () => {
    it("should detect TypeScript from .ts files", () => {
      expect(LanguageDetector.detectFromFilePath("file.ts")).toBe("typescript");
      expect(LanguageDetector.detectFromFilePath("/path/to/file.ts")).toBe(
        "typescript",
      );
      expect(LanguageDetector.detectFromFilePath("src/App.ts")).toBe(
        "typescript",
      );
    });

    it("should detect TypeScript from .tsx files", () => {
      expect(LanguageDetector.detectFromFilePath("file.tsx")).toBe(
        "typescript",
      );
      expect(LanguageDetector.detectFromFilePath("src/App.tsx")).toBe(
        "typescript",
      );
    });

    it("should detect TypeScript from .mts and .cts files", () => {
      expect(LanguageDetector.detectFromFilePath("file.mts")).toBe(
        "typescript",
      );
      expect(LanguageDetector.detectFromFilePath("file.cts")).toBe(
        "typescript",
      );
    });

    it("should detect JavaScript from .js files", () => {
      expect(LanguageDetector.detectFromFilePath("file.js")).toBe("javascript");
      expect(LanguageDetector.detectFromFilePath("/path/to/file.js")).toBe(
        "javascript",
      );
    });

    it("should detect JavaScript from .jsx files", () => {
      expect(LanguageDetector.detectFromFilePath("file.jsx")).toBe(
        "javascript",
      );
      expect(LanguageDetector.detectFromFilePath("src/App.jsx")).toBe(
        "javascript",
      );
    });

    it("should detect JavaScript from .mjs and .cjs files", () => {
      expect(LanguageDetector.detectFromFilePath("file.mjs")).toBe(
        "javascript",
      );
      expect(LanguageDetector.detectFromFilePath("file.cjs")).toBe(
        "javascript",
      );
    });

    it("should detect Java from .java files", () => {
      expect(LanguageDetector.detectFromFilePath("Main.java")).toBe("java");
      expect(LanguageDetector.detectFromFilePath("src/Main.java")).toBe("java");
    });

    it("should detect Python from .py files", () => {
      expect(LanguageDetector.detectFromFilePath("main.py")).toBe("python");
      expect(LanguageDetector.detectFromFilePath("src/main.py")).toBe("python");
    });

    it("should detect Python from .pyi and .pyw files", () => {
      expect(LanguageDetector.detectFromFilePath("types.pyi")).toBe("python");
      expect(LanguageDetector.detectFromFilePath("script.pyw")).toBe("python");
    });

    it("should detect Go from .go files", () => {
      expect(LanguageDetector.detectFromFilePath("main.go")).toBe("go");
      expect(LanguageDetector.detectFromFilePath("src/main.go")).toBe("go");
    });

    it("should return null for unsupported extensions", () => {
      expect(LanguageDetector.detectFromFilePath("file.txt")).toBeNull();
      expect(LanguageDetector.detectFromFilePath("file.md")).toBeNull();
      expect(LanguageDetector.detectFromFilePath("file")).toBeNull();
      expect(LanguageDetector.detectFromFilePath("")).toBeNull();
    });

    it("should handle file:// URI format", () => {
      expect(
        LanguageDetector.detectFromFilePath("file:///path/to/file.ts"),
      ).toBe("typescript");
      expect(
        LanguageDetector.detectFromFilePath("file:///C:/path/to/file.ts"),
      ).toBe("typescript");
    });

    it("should handle case-insensitive extensions", () => {
      expect(LanguageDetector.detectFromFilePath("file.TS")).toBe("typescript");
      expect(LanguageDetector.detectFromFilePath("file.JS")).toBe("javascript");
      expect(LanguageDetector.detectFromFilePath("file.JAVA")).toBe("java");
      expect(LanguageDetector.detectFromFilePath("file.PY")).toBe("python");
    });

    it("should handle files without extensions", () => {
      expect(LanguageDetector.detectFromFilePath("file")).toBeNull();
      expect(LanguageDetector.detectFromFilePath("/path/to/file")).toBeNull();
    });

    it("should handle invalid file:// URIs gracefully", () => {
      expect(LanguageDetector.detectFromFilePath("file://invalid")).toBeNull();
    });
  });

  describe("getExtensions", () => {
    it("should return all TypeScript extensions", () => {
      const extensions = LanguageDetector.getExtensions("typescript");
      expect(extensions).toContain(".ts");
      expect(extensions).toContain(".tsx");
      expect(extensions).toContain(".mts");
      expect(extensions).toContain(".cts");
    });

    it("should return all JavaScript extensions", () => {
      const extensions = LanguageDetector.getExtensions("javascript");
      expect(extensions).toContain(".js");
      expect(extensions).toContain(".jsx");
      expect(extensions).toContain(".mjs");
      expect(extensions).toContain(".cjs");
    });

    it("should return Java extension", () => {
      const extensions = LanguageDetector.getExtensions("java");
      expect(extensions).toContain(".java");
      expect(extensions.length).toBe(1);
    });

    it("should return all Python extensions", () => {
      const extensions = LanguageDetector.getExtensions("python");
      expect(extensions).toContain(".py");
      expect(extensions).toContain(".pyi");
      expect(extensions).toContain(".pyw");
    });

    it("should return Go extension", () => {
      const extensions = LanguageDetector.getExtensions("go");
      expect(extensions).toContain(".go");
      expect(extensions.length).toBe(1);
    });
  });

  describe("isSupported", () => {
    it("should return true for supported file paths", () => {
      expect(LanguageDetector.isSupported("file.ts")).toBe(true);
      expect(LanguageDetector.isSupported("file.js")).toBe(true);
      expect(LanguageDetector.isSupported("file.java")).toBe(true);
      expect(LanguageDetector.isSupported("file.py")).toBe(true);
      expect(LanguageDetector.isSupported("file.go")).toBe(true);
    });

    it("should return false for unsupported file paths", () => {
      expect(LanguageDetector.isSupported("file.txt")).toBe(false);
      expect(LanguageDetector.isSupported("file.md")).toBe(false);
      expect(LanguageDetector.isSupported("file")).toBe(false);
      expect(LanguageDetector.isSupported("")).toBe(false);
    });
  });

  describe("getSupportedLanguages", () => {
    it("should return all supported languages", () => {
      const languages = LanguageDetector.getSupportedLanguages();
      expect(languages).toContain("typescript");
      expect(languages).toContain("javascript");
      expect(languages).toContain("java");
      expect(languages).toContain("python");
      expect(languages).toContain("go");
    });

    it("should return unique languages", () => {
      const languages = LanguageDetector.getSupportedLanguages();
      const unique = new Set(languages);
      expect(languages.length).toBe(unique.size);
    });
  });

  describe("getExtensionMap", () => {
    it("should return a copy of the extension map", () => {
      const map = LanguageDetector.getExtensionMap();
      expect(map).toBeDefined();
      expect(map[".ts"]).toBe("typescript");
      expect(map[".js"]).toBe("javascript");
      expect(map[".java"]).toBe("java");
      expect(map[".py"]).toBe("python");
      expect(map[".go"]).toBe("go");
    });

    it("should return a new object (not the original)", () => {
      const map1 = LanguageDetector.getExtensionMap();
      const map2 = LanguageDetector.getExtensionMap();
      expect(map1).not.toBe(map2);
    });
  });

  describe("detectFromContent", () => {
    it("should return null (not implemented)", () => {
      expect(LanguageDetector.detectFromContent("")).toBeNull();
      expect(LanguageDetector.detectFromContent("some code")).toBeNull();
    });
  });
});
