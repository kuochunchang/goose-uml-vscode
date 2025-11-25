import { describe, it, expect, beforeEach } from "vitest";
import { ImportIndex } from "./ImportIndex.js";
import { InMemoryFileProvider } from "../__tests__/helpers/InMemoryFileProvider.js";

describe("ImportIndex", () => {
  let fileProvider: InMemoryFileProvider;
  let importIndex: ImportIndex;

  beforeEach(() => {
    fileProvider = new InMemoryFileProvider();
    importIndex = new ImportIndex(fileProvider);
  });

  describe("buildIndex", () => {
    it("should build index for TypeScript files", async () => {
      fileProvider.addFile(
        "/src/User.ts",
        `
export class User {
  name: string;
}

export interface IUser {
  name: string;
}
      `.trim(),
      );

      fileProvider.addFile(
        "/src/Product.ts",
        `
export class Product {
  id: number;
}
      `.trim(),
      );

      await importIndex.buildIndex();

      expect(importIndex.resolve("User")).toEqual(["/src/User.ts"]);
      expect(importIndex.resolve("IUser")).toEqual(["/src/User.ts"]);
      expect(importIndex.resolve("Product")).toEqual(["/src/Product.ts"]);
    });

    it("should handle multiple classes in same file", async () => {
      fileProvider.addFile(
        "/src/models.ts",
        `
export class User {}
export class Product {}
export interface ILogger {}
      `.trim(),
      );

      await importIndex.buildIndex();

      expect(importIndex.resolve("User")).toEqual(["/src/models.ts"]);
      expect(importIndex.resolve("Product")).toEqual(["/src/models.ts"]);
      expect(importIndex.resolve("ILogger")).toEqual(["/src/models.ts"]);
    });

    it("should handle same class name in different files", async () => {
      fileProvider.addFile("/src/models/User.ts", "export class User {}");
      fileProvider.addFile("/src/entities/User.ts", "export class User {}");

      await importIndex.buildIndex();

      const userPaths = importIndex.resolve("User");
      expect(userPaths).toHaveLength(2);
      expect(userPaths).toContain("/src/models/User.ts");
      expect(userPaths).toContain("/src/entities/User.ts");
    });

    it("should exclude node_modules by default", async () => {
      fileProvider.addFile("/src/App.ts", "export class App {}");
      fileProvider.addFile(
        "/node_modules/react/index.ts",
        "export class Component {}",
      );

      await importIndex.buildIndex();

      expect(importIndex.resolve("App")).toEqual(["/src/App.ts"]);
      expect(importIndex.resolve("Component")).toEqual([]); // Should be excluded
    });

    it("should exclude dist and build folders by default", async () => {
      fileProvider.addFile("/src/App.ts", "export class App {}");
      fileProvider.addFile("/dist/App.js", "class App {}"); // Built file
      fileProvider.addFile("/build/App.js", "class App {}"); // Built file

      await importIndex.buildIndex();

      const appPaths = importIndex.resolve("App");
      expect(appPaths).toEqual(["/src/App.ts"]); // Only source file
    });

    it("should respect custom exclude patterns", async () => {
      fileProvider.addFile("/src/App.ts", "export class App {}");
      fileProvider.addFile("/temp/Test.ts", "export class Test {}");

      await importIndex.buildIndex({
        excludePatterns: ["**/temp/**"],
      });

      expect(importIndex.resolve("App")).toEqual(["/src/App.ts"]);
      expect(importIndex.resolve("Test")).toEqual([]); // Excluded
    });

    it("should handle abstract classes", async () => {
      fileProvider.addFile(
        "/src/BaseService.ts",
        "export abstract class BaseService {}",
      );

      await importIndex.buildIndex();

      expect(importIndex.resolve("BaseService")).toEqual([
        "/src/BaseService.ts",
      ]);
    });

    it("should handle enums", async () => {
      fileProvider.addFile(
        "/src/Status.ts",
        "export enum Status { Active, Inactive }",
      );

      await importIndex.buildIndex();

      expect(importIndex.resolve("Status")).toEqual(["/src/Status.ts"]);
    });

    it("should handle type aliases", async () => {
      fileProvider.addFile("/src/types.ts", "export type UserId = string;");

      await importIndex.buildIndex();

      expect(importIndex.resolve("UserId")).toEqual(["/src/types.ts"]);
    });

    it("should skip files with parse errors", async () => {
      fileProvider.addFile("/src/Valid.ts", "export class Valid {}");
      fileProvider.addFile(
        "/src/Invalid.ts",
        "this is not valid typescript {{{",
      );

      // Should not throw, just skip invalid files
      await importIndex.buildIndex();

      expect(importIndex.resolve("Valid")).toEqual(["/src/Valid.ts"]);
    });

    it("should respect maxFiles limit", async () => {
      // Add 100 files
      for (let i = 0; i < 100; i++) {
        fileProvider.addFile(`/src/Class${i}.ts`, `export class Class${i} {}`);
      }

      await importIndex.buildIndex({ maxFiles: 50 });

      // Should only index first 50 files
      const stats = importIndex.getStats();
      expect(stats.classCount).toBeLessThanOrEqual(50);
    });
  });

  describe("resolve", () => {
    beforeEach(async () => {
      fileProvider.addFile("/src/User.ts", "export class User {}");
      fileProvider.addFile("/src/Product.ts", "export class Product {}");
      await importIndex.buildIndex();
    });

    it("should return file paths for existing class", () => {
      expect(importIndex.resolve("User")).toEqual(["/src/User.ts"]);
    });

    it("should return empty array for non-existent class", () => {
      expect(importIndex.resolve("NonExistent")).toEqual([]);
    });

    it("should be case-sensitive", () => {
      expect(importIndex.resolve("user")).toEqual([]); // lowercase
      expect(importIndex.resolve("User")).toEqual(["/src/User.ts"]); // correct case
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      fileProvider.addFile("/src/User.ts", "export class User {}");
      fileProvider.addFile(
        "/src/Product.ts",
        "export class Product {} export class Item {}",
      );

      await importIndex.buildIndex();

      const stats = importIndex.getStats();
      expect(stats.classCount).toBe(3); // User, Product, Item
      expect(stats.fileCount).toBe(2); // 2 files
      expect(stats.builtAt).toBeTruthy();
    });
  });

  describe("getAllClassNames", () => {
    it("should return all indexed class names", async () => {
      fileProvider.addFile("/src/User.ts", "export class User {}");
      fileProvider.addFile("/src/Product.ts", "export class Product {}");

      await importIndex.buildIndex();

      const classNames = importIndex.getAllClassNames();
      expect(classNames).toContain("User");
      expect(classNames).toContain("Product");
      expect(classNames).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("should clear all index data", async () => {
      fileProvider.addFile("/src/User.ts", "export class User {}");
      await importIndex.buildIndex();

      expect(importIndex.resolve("User")).toEqual(["/src/User.ts"]);

      importIndex.clear();

      expect(importIndex.resolve("User")).toEqual([]);
      expect(importIndex.getAllClassNames()).toHaveLength(0);
    });
  });

  describe("language-specific filtering", () => {
    it("should exclude Python __pycache__", async () => {
      fileProvider.addFile("/src/app.py", "class App: pass");
      fileProvider.addFile(
        "/src/__pycache__/app.cpython-39.pyc",
        "compiled code",
      );

      await importIndex.buildIndex();

      expect(importIndex.resolve("App")).toEqual(["/src/app.py"]);
    });

    it("should exclude Java target folder", async () => {
      fileProvider.addFile("/src/App.java", "public class App {}");
      fileProvider.addFile("/target/App.class", "compiled bytecode");

      await importIndex.buildIndex();

      const stats = importIndex.getStats();
      expect(stats.fileCount).toBe(1); // Only source file
    });
  });

  describe("performance characteristics", () => {
    it("should handle large number of files efficiently", async () => {
      // Add 1000 files
      for (let i = 0; i < 1000; i++) {
        fileProvider.addFile(
          `/src/Class${i}.ts`,
          `export class Class${i} { method${i}() {} }`,
        );
      }

      const startTime = Date.now();
      await importIndex.buildIndex();
      const duration = Date.now() - startTime;

      const stats = importIndex.getStats();
      expect(stats.classCount).toBe(1000);

      // Should complete in reasonable time (adjust threshold as needed)
      console.log(`[Performance] Indexed 1000 files in ${duration}ms`);
      expect(duration).toBeLessThan(10000); // 10 seconds max for 1000 files
    });

    it("should provide O(1) lookup", () => {
      // Resolution should be instant regardless of index size
      const className = "User";
      const startTime = Date.now();
      importIndex.resolve(className);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10); // Should be < 10ms
    });
  });
});
