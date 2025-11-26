import { describe, it, expect, beforeEach } from "vitest";
import { UMLAnalyzer } from "./UMLAnalyzer.js";
import { InMemoryFileProvider } from "../__tests__/helpers/InMemoryFileProvider.js";
import { TS_FIXTURES } from "../__tests__/fixtures/typescript-fixtures.js";
import { registerTestParsers } from "../__tests__/helpers/registerParsers.js";

describe("UMLAnalyzer", () => {
  let fileProvider: InMemoryFileProvider;
  let analyzer: UMLAnalyzer;

  beforeEach(() => {
    registerTestParsers();
    fileProvider = new InMemoryFileProvider();
    analyzer = new UMLAnalyzer(fileProvider);
  });

  describe("generateDiagram", () => {
    it("should generate class diagram for TypeScript code", async () => {
      const code = TS_FIXTURES.simpleClass;
      const result = await analyzer.generateDiagram(code, "class", "test.ts");

      expect(result.type).toBe("class");
      expect(result.mermaidCode).toContain("classDiagram");
      expect(result.generationMode).toBe("native");
    });

    it("should generate flowchart for TypeScript code", async () => {
      const code = `
function calculateGrade(score: number): string {
  if (score >= 90) {
    return "A";
  } else if (score >= 80) {
    return "B";
  } else {
    return "C";
  }
}
      `.trim();
      const result = await analyzer.generateDiagram(
        code,
        "flowchart",
        "test.ts",
      );

      expect(result.type).toBe("flowchart");
      expect(result.mermaidCode).toContain("flowchart");
      expect(result.generationMode).toBe("native");
    });

    it("should throw error for unsupported diagram type", async () => {
      const code = TS_FIXTURES.simpleClass;
      await expect(
        analyzer.generateDiagram(code, "dependency" as any, "test.ts"),
      ).rejects.toThrow();
    });

    it("should handle parse errors gracefully", async () => {
      // Invalid code may not throw but return empty result
      const invalidCode = "class { invalid syntax }";
      const result = await analyzer.generateDiagram(
        invalidCode,
        "class",
        "test.ts",
      );
      // Should still return a result (may be empty)
      expect(result).toBeDefined();
      expect(result.type).toBe("class");
    });
  });

  describe("generateUnifiedDiagram", () => {
    it("should generate single-file class diagram (depth=0)", async () => {
      fileProvider.addFile("/src/User.ts", TS_FIXTURES.simpleClass);

      const result = await analyzer.generateUnifiedDiagram(
        "/src/User.ts",
        "class",
        {
          depth: 0,
        },
      );

      expect(result.type).toBe("class");
      expect(result.metadata?.depth).toBe(0);
      expect(result.metadata?.singleFile).toBe(true);
      expect(result.metadata?.filePath).toBe("/src/User.ts");
    });

    it("should generate cross-file class diagram (depth=1)", async () => {
      fileProvider.addFile("/src/User.ts", TS_FIXTURES.simpleClass);
      fileProvider.addFile(
        "/src/UserService.ts",
        TS_FIXTURES.serviceWithDependency,
      );
      fileProvider.addFile("/src/UserRepository.ts", TS_FIXTURES.repository);

      const result = await analyzer.generateUnifiedDiagram(
        "/src/UserService.ts",
        "class",
        {
          depth: 1,
          mode: "bidirectional",
        },
      );

      expect(result.type).toBe("class");
      expect(result.metadata?.depth).toBe(1);
      expect(result.metadata?.singleFile).toBe(false);
      expect(result.metadata?.filePath).toBe("/src/UserService.ts");
    });

    it("should generate single-file flowchart (depth=0)", async () => {
      const code = `
function processData(data: string): void {
  if (data) {
    console.log(data);
  }
}
      `.trim();
      fileProvider.addFile("/src/process.ts", code);

      const result = await analyzer.generateUnifiedDiagram(
        "/src/process.ts",
        "flowchart",
        {
          depth: 0,
        },
      );

      expect(result.type).toBe("flowchart");
      expect(result.metadata?.depth).toBe(0);
      expect(result.metadata?.singleFile).toBe(true);
    });

    it("should generate cross-file flowchart (depth=1)", async () => {
      fileProvider.addFile(
        "/src/main.ts",
        `
import { helper } from './helper';
function main() {
  helper();
}
      `.trim(),
      );
      fileProvider.addFile(
        "/src/helper.ts",
        `
export function helper() {
  console.log('help');
}
      `.trim(),
      );

      const result = await analyzer.generateUnifiedDiagram(
        "/src/main.ts",
        "flowchart",
        {
          depth: 1,
        },
      );

      expect(result.type).toBe("flowchart");
      expect(result.metadata?.depth).toBe(1);
      expect(result.metadata?.singleFile).toBe(false);
    });

    it("should throw error for invalid depth", async () => {
      fileProvider.addFile("/src/User.ts", TS_FIXTURES.simpleClass);

      await expect(
        analyzer.generateUnifiedDiagram("/src/User.ts", "class", {
          depth: -1,
        }),
      ).rejects.toThrow("Depth must be between 0 (single file) and 10");

      await expect(
        analyzer.generateUnifiedDiagram("/src/User.ts", "class", {
          depth: 11,
        }),
      ).rejects.toThrow("Depth must be between 0 (single file) and 10");
    });

    it("should throw error if file does not exist", async () => {
      await expect(
        analyzer.generateUnifiedDiagram("/src/NonExistent.ts", "class", {
          depth: 0,
        }),
      ).rejects.toThrow();
    });
  });

  describe("generateCrossFileClassDiagram", () => {
    it("should generate class diagram in forward mode", async () => {
      fileProvider.addFile("/src/User.ts", TS_FIXTURES.simpleClass);
      fileProvider.addFile(
        "/src/UserService.ts",
        TS_FIXTURES.serviceWithDependency,
      );
      fileProvider.addFile("/src/UserRepository.ts", TS_FIXTURES.repository);

      const result = await analyzer.generateCrossFileClassDiagram(
        "/src/UserService.ts",
        1,
        "forward",
      );

      expect(result.type).toBe("class");
      expect(result.metadata?.depth).toBe(1);
      expect(result.metadata?.mode).toBe("forward");
      expect(result.metadata?.singleFile).toBe(false);
    });

    it("should generate class diagram in reverse mode", async () => {
      fileProvider.addFile("/src/User.ts", TS_FIXTURES.simpleClass);
      fileProvider.addFile(
        "/src/UserService.ts",
        TS_FIXTURES.serviceWithDependency,
      );
      fileProvider.addFile("/src/UserRepository.ts", TS_FIXTURES.repository);

      const result = await analyzer.generateCrossFileClassDiagram(
        "/src/UserRepository.ts",
        1,
        "reverse",
      );

      expect(result.type).toBe("class");
      expect(result.metadata?.depth).toBe(1);
      expect(result.metadata?.mode).toBe("reverse");
    });

    it("should generate class diagram in bidirectional mode", async () => {
      fileProvider.addFile("/src/User.ts", TS_FIXTURES.simpleClass);
      fileProvider.addFile(
        "/src/UserService.ts",
        TS_FIXTURES.serviceWithDependency,
      );
      fileProvider.addFile("/src/UserRepository.ts", TS_FIXTURES.repository);

      const result = await analyzer.generateCrossFileClassDiagram(
        "/src/UserService.ts",
        1,
        "bidirectional",
      );

      expect(result.type).toBe("class");
      expect(result.metadata?.depth).toBe(1);
      expect(result.metadata?.mode).toBe("bidirectional");
    });

    it("should throw error for invalid depth", async () => {
      fileProvider.addFile("/src/User.ts", TS_FIXTURES.simpleClass);

      await expect(
        analyzer.generateCrossFileClassDiagram(
          "/src/User.ts",
          0 as any,
          "forward",
        ),
      ).rejects.toThrow("Cross-file analysis depth must be between 1 and 10");

      await expect(
        analyzer.generateCrossFileClassDiagram(
          "/src/User.ts",
          11 as any,
          "forward",
        ),
      ).rejects.toThrow("Cross-file analysis depth must be between 1 and 10");
    });
  });

  describe("generateCrossFileFlowchart", () => {
    it("should generate cross-file flowchart", async () => {
      fileProvider.addFile(
        "/src/main.ts",
        `
import { helper } from './helper';
function main() {
  helper();
}
      `.trim(),
      );
      fileProvider.addFile(
        "/src/helper.ts",
        `
export function helper() {
  console.log('help');
}
      `.trim(),
      );

      const result = await analyzer.generateCrossFileFlowchart(
        "/src/main.ts",
        1,
      );

      expect(result.type).toBe("flowchart");
      expect(result.metadata?.depth).toBe(1);
      expect(result.metadata?.singleFile).toBe(false);
    });
  });

  describe("generateCrossFileSequenceDiagram", () => {
    it("should generate cross-file sequence diagram", async () => {
      fileProvider.addFile(
        "/src/UserService.ts",
        `
import { UserRepository } from './UserRepository';
export class UserService {
  private repo: UserRepository;
  async getUser(id: string) {
    return this.repo.find(id);
  }
}
      `.trim(),
      );
      fileProvider.addFile(
        "/src/UserRepository.ts",
        `
export class UserRepository {
  find(id: string) {
    return { id };
  }
}
      `.trim(),
      );

      const result = await analyzer.generateCrossFileSequenceDiagram(
        "/src/UserService.ts",
        1,
        "bidirectional",
      );

      expect(result.type).toBe("sequence");
      expect(result.metadata?.depth).toBe(1);
      expect(result.metadata?.singleFile).toBe(false);
    });

    it("should throw error for invalid depth", async () => {
      fileProvider.addFile("/src/User.ts", TS_FIXTURES.simpleClass);

      await expect(
        analyzer.generateCrossFileSequenceDiagram(
          "/src/User.ts",
          0 as any,
          "forward",
        ),
      ).rejects.toThrow("Cross-file analysis depth must be between 1 and 10");
    });
  });

  describe("generateDiagram - sequence", () => {
    it("should generate sequence diagram for TypeScript code", async () => {
      const code = `
export class UserService {
  private repository: UserRepository;

  constructor(repository: UserRepository) {
    this.repository = repository;
  }

  async getUser(id: string) {
    return this.repository.findById(id);
  }
}

export class UserRepository {
  async findById(id: string) {
    return null;
  }
}
      `.trim();
      const result = await analyzer.generateDiagram(
        code,
        "sequence",
        "test.ts",
      );

      expect(result.type).toBe("sequence");
      expect(result.mermaidCode).toContain("sequenceDiagram");
      expect(result.generationMode).toBe("native");
    });

    it("should generate sequence diagram for Java code", async () => {
      const code = `
public class UserService {
    private UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }

    public User getUser(String id) {
        return repository.findById(id);
    }
}
      `.trim();
      const result = await analyzer.generateDiagram(
        code,
        "sequence",
        "test.java",
      );

      expect(result.type).toBe("sequence");
      expect(result.mermaidCode).toContain("sequenceDiagram");
    });

    it("should generate sequence diagram for Python code", async () => {
      const code = `
class UserService:
    def __init__(self, repository):
        self.repository = repository

    def get_user(self, id):
        return self.repository.find_by_id(id)
      `.trim();
      const result = await analyzer.generateDiagram(
        code,
        "sequence",
        "test.py",
      );

      expect(result.type).toBe("sequence");
      expect(result.mermaidCode).toContain("sequenceDiagram");
    });
  });

  describe("generateUnifiedDiagram - sequence", () => {
    it("should generate single-file sequence diagram (depth=0)", async () => {
      const code = `
export class UserService {
  async getUser(id: string) {
    return this.repository.findById(id);
  }
}
      `.trim();
      fileProvider.addFile("/src/UserService.ts", code);

      const result = await analyzer.generateUnifiedDiagram(
        "/src/UserService.ts",
        "sequence",
        {
          depth: 0,
        },
      );

      expect(result.type).toBe("sequence");
      expect(result.metadata?.depth).toBe(0);
      expect(result.metadata?.singleFile).toBe(true);
    });

    it("should generate cross-file sequence diagram (depth=1)", async () => {
      fileProvider.addFile(
        "/src/UserService.ts",
        `
import { UserRepository } from './UserRepository';
export class UserService {
  private repo: UserRepository;
  async getUser(id: string) {
    return this.repo.find(id);
  }
}
      `.trim(),
      );
      fileProvider.addFile(
        "/src/UserRepository.ts",
        `
export class UserRepository {
  find(id: string) {
    return { id };
  }
}
      `.trim(),
      );

      const result = await analyzer.generateUnifiedDiagram(
        "/src/UserService.ts",
        "sequence",
        {
          depth: 1,
          mode: "bidirectional",
        },
      );

      expect(result.type).toBe("sequence");
      expect(result.metadata?.depth).toBe(1);
      expect(result.metadata?.singleFile).toBe(false);
    });
  });
});
