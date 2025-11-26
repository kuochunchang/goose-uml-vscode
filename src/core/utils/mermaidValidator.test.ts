import { describe, it, expect, beforeEach } from "vitest";
import { MermaidValidator } from "./mermaidValidator.js";

describe("MermaidValidator", () => {
  let validator: MermaidValidator;

  beforeEach(() => {
    validator = new MermaidValidator();
  });

  describe("validate", () => {
    it("should validate empty code", () => {
      const result = validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Mermaid code is empty");
    });

    it("should validate code with only whitespace", () => {
      const result = validator.validate("   \n\t  ");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Mermaid code is empty");
    });

    it("should validate class diagram with valid header", () => {
      const code = `classDiagram
        class User
        class Product
        User --> Product`;
      const result = validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate flowchart with valid header", () => {
      const code = `flowchart TD
        A[Start] --> B[End]`;
      const result = validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate sequence diagram with valid header", () => {
      const code = `sequenceDiagram
        Alice->>Bob: Hello`;
      const result = validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject code without valid header", () => {
      const code = `User --> Product`;
      const result = validator.validate(code);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("Missing or invalid diagram type header"),
        ),
      ).toBe(true);
    });

    it("should detect mismatched brackets", () => {
      const code = `classDiagram
        class User {
          name: string
        `;
      const result = validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Mismatched brackets"))).toBe(
        true,
      );
    });

    it("should detect mismatched double quotes", () => {
      const code = `classDiagram
        class User "incomplete quote`;
      const result = validator.validate(code);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Mismatched double quotes")),
      ).toBe(true);
    });

    it("should detect mismatched single quotes", () => {
      const code = `classDiagram
        class User 'incomplete quote`;
      const result = validator.validate(code);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Mismatched single quotes")),
      ).toBe(true);
    });

    it("should accept valid quotes", () => {
      const code = `classDiagram
        class User "complete quote"
        class Product 'complete quote'`;
      const result = validator.validate(code);
      expect(result.valid).toBe(true);
    });

    it("should handle comments", () => {
      const code = `classDiagram
        %% This is a comment
        class User`;
      const result = validator.validate(code);
      expect(result.valid).toBe(true);
    });
  });

  describe("autoFix", () => {
    it("should remove markdown code block markers", () => {
      const code = "```mermaid\nclassDiagram\nclass User\n```";
      const fixed = validator.autoFix(code);
      expect(fixed).not.toContain("```");
      expect(fixed).toContain("classDiagram");
      expect(fixed).toContain("class User");
    });

    it("should remove mermaid code block markers", () => {
      const code = "```\nclassDiagram\nclass User\n```";
      const fixed = validator.autoFix(code);
      expect(fixed).not.toContain("```");
    });

    it("should fix relationship syntax", () => {
      const code = `classDiagram
        User<--Product
        User-->Order`;
      const fixed = validator.autoFix(code);
      expect(fixed).toContain("<|--");
      expect(fixed).toContain("-->");
    });

    it("should remove excessive blank lines", () => {
      const code = `classDiagram
        class User


        class Product`;
      const fixed = validator.autoFix(code);
      const blankLines = fixed.match(/\n{3,}/g);
      expect(blankLines).toBeNull();
    });

    it("should trim whitespace", () => {
      const code = "   \nclassDiagram\nclass User\n   ";
      const fixed = validator.autoFix(code);
      expect(fixed).not.toMatch(/^\s+/);
      expect(fixed).not.toMatch(/\s+$/);
    });

    it("should handle flowchart labels", () => {
      const code = `flowchart TD
        A[calculateGrade(score): string] --> B[End]`;
      const fixed = validator.autoFix(code);
      // Should simplify labels but keep node structure
      expect(fixed).toContain("A[");
      expect(fixed).toContain("]");
    });

    it("should preserve valid code", () => {
      const code = `classDiagram
        class User
        class Product
        User --> Product`;
      const fixed = validator.autoFix(code);
      expect(fixed).toContain("classDiagram");
      expect(fixed).toContain("class User");
      expect(fixed).toContain("class Product");
      expect(fixed).toContain("User --> Product");
    });
  });
});
