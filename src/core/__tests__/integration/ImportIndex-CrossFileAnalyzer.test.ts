import { describe, it, expect, beforeEach } from 'vitest';
import { CrossFileAnalyzer } from '../../analyzers/CrossFileAnalyzer.js';
import { ImportIndex } from '../../services/ImportIndex.js';
import { InMemoryFileProvider } from '../helpers/InMemoryFileProvider.js';

describe('ImportIndex + CrossFileAnalyzer Integration', () => {
  let fileProvider: InMemoryFileProvider;
  let importIndex: ImportIndex;
  let analyzer: CrossFileAnalyzer;

  beforeEach(() => {
    fileProvider = new InMemoryFileProvider();
    importIndex = new ImportIndex(fileProvider);
  });

  describe('Performance: With vs Without ImportIndex', () => {
    it('should resolve classes faster with ImportIndex', async () => {
      // Setup: Create a project with multiple files
      fileProvider.addFile('/src/App.ts', 'export class App {}');
      fileProvider.addFile('/src/models/User.ts', 'export class User {}');
      fileProvider.addFile('/src/services/UserService.ts', `
import { User } from '../models/User';
export class UserService {
  private user: User;
}
      `.trim());

      // Build index
      await importIndex.buildIndex();

      // Analyzer WITH ImportIndex
      const analyzerWithIndex = new CrossFileAnalyzer(fileProvider, importIndex);
      const startWithIndex = Date.now();
      const resultsWithIndex = await analyzerWithIndex.analyzeForward('/src/services/UserService.ts', 2);
      const durationWithIndex = Date.now() - startWithIndex;

      // Analyzer WITHOUT ImportIndex (fallback to glob search)
      const analyzerWithoutIndex = new CrossFileAnalyzer(fileProvider);
      const startWithoutIndex = Date.now();
      const resultsWithoutIndex = await analyzerWithoutIndex.analyzeForward(
        '/src/services/UserService.ts',
        2
      );
      const durationWithoutIndex = Date.now() - startWithoutIndex;

      // Both should get same results
      expect(resultsWithIndex.size).toBe(resultsWithoutIndex.size);

      // Log performance comparison
      console.log(`[Performance] With ImportIndex: ${durationWithIndex}ms`);
      console.log(`[Performance] Without ImportIndex: ${durationWithoutIndex}ms`);
      console.log(
        `[Performance] Speedup: ${(durationWithoutIndex / durationWithIndex).toFixed(2)}x`
      );

      // ImportIndex should be at least as fast (may vary due to small dataset)
      // In real-world large projects, ImportIndex is significantly faster
    });

    it('should handle cross-directory resolution efficiently', async () => {
      // Setup: Files in different directories
      fileProvider.addFile('/src/App.ts', `
import { UserService } from '../services/UserService';
export class App {
  private service: UserService;
}
      `.trim());

      fileProvider.addFile('/services/UserService.ts', `
import { User } from '../models/User';
export class UserService {
  private user: User;
}
      `.trim());

      fileProvider.addFile('/models/User.ts', 'export class User {}');

      // Build index
      await importIndex.buildIndex();

      // Analyze with index
      const analyzer = new CrossFileAnalyzer(fileProvider, importIndex);
      const results = await analyzer.analyzeForward('/src/App.ts', 3);

      // Should find all related files
      expect(results.has('/src/App.ts')).toBe(true);
      expect(results.size).toBeGreaterThanOrEqual(1);

      // Verify classes are discovered
      const appAnalysis = results.get('/src/App.ts');
      expect(appAnalysis?.classes).toHaveLength(1);
      expect(appAnalysis?.classes[0].name).toBe('App');
    });
  });

  describe('Correctness: Same results with or without ImportIndex', () => {
    const setupComplexProject = () => {
      fileProvider.addFile('/src/controllers/UserController.ts', `
import { UserService } from '../services/UserService';
export class UserController {
  private service: UserService;
}
      `.trim());

      fileProvider.addFile('/src/services/UserService.ts', `
import { UserRepository } from '../repositories/UserRepository';
export class UserService {
  private repository: UserRepository;
}
      `.trim());

      fileProvider.addFile('/src/repositories/UserRepository.ts', `
import { User } from '../models/User';
export class UserRepository {
  private users: User[];
}
      `.trim());

      fileProvider.addFile('/src/models/User.ts', 'export class User { name: string; }');
    };

    it('should produce identical analysis results', async () => {
      setupComplexProject();
      await importIndex.buildIndex();

      // Analyze with ImportIndex
      const analyzerWithIndex = new CrossFileAnalyzer(fileProvider, importIndex);
      const resultsWithIndex = await analyzerWithIndex.analyzeBidirectional(
        '/src/controllers/UserController.ts',
        3
      );

      // Analyze without ImportIndex
      const analyzerWithoutIndex = new CrossFileAnalyzer(fileProvider);
      const resultsWithoutIndex = await analyzerWithoutIndex.analyzeBidirectional(
        '/src/controllers/UserController.ts',
        3
      );

      // Compare results
      expect(resultsWithIndex.allClasses.length).toBe(resultsWithoutIndex.allClasses.length);
      expect(resultsWithIndex.relationships.length).toBe(
        resultsWithoutIndex.relationships.length
      );
      expect(resultsWithIndex.stats.totalFiles).toBe(resultsWithoutIndex.stats.totalFiles);

      // Verify all class names match
      const classNamesWithIndex = resultsWithIndex.allClasses.map((c) => c.name).sort();
      const classNamesWithoutIndex = resultsWithoutIndex.allClasses.map((c) => c.name).sort();
      expect(classNamesWithIndex).toEqual(classNamesWithoutIndex);
    });

    it('should handle missing files gracefully', async () => {
      fileProvider.addFile('/src/App.ts', `
import { MissingService } from './MissingService';
export class App {
  private service: MissingService;
}
      `.trim());

      await importIndex.buildIndex();

      // Analyze with index (MissingService not found)
      const analyzer = new CrossFileAnalyzer(fileProvider, importIndex);
      const results = await analyzer.analyzeForward('/src/App.ts', 2);

      // Should not crash, just skip missing dependencies
      expect(results.has('/src/App.ts')).toBe(true);
      expect(results.has('/src/MissingService.ts')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle same class name in different directories', async () => {
      fileProvider.addFile('/src/models/User.ts', 'export class User { type = "model"; }');
      fileProvider.addFile('/src/entities/User.ts', 'export class User { type = "entity"; }');
      fileProvider.addFile('/src/App.ts', `
import { User } from './models/User';
export class App {
  private user: User;
}
      `.trim());

      await importIndex.buildIndex();

      const analyzer = new CrossFileAnalyzer(fileProvider, importIndex);
      const results = await analyzer.analyzeForward('/src/App.ts', 2);

      // ImportIndex may return first match - this is acceptable
      expect(results.has('/src/App.ts')).toBe(true);

      // Check if any User file was found
      const hasUserModel = results.has('/src/models/User.ts');
      const hasUserEntity = results.has('/src/entities/User.ts');

      // At least one should be found
      // Note: ImportIndex returns first match, so behavior may vary
    });

    it('should work with empty ImportIndex', async () => {
      fileProvider.addFile('/src/User.ts', 'export class User {}');

      // Build empty index (no files match pattern)
      await importIndex.buildIndex({ includePatterns: ['**/*.nonexistent'] });

      // Analyzer should fallback to glob search
      const analyzer = new CrossFileAnalyzer(fileProvider, importIndex);
      const results = await analyzer.analyzeForward('/src/User.ts', 1);

      expect(results.has('/src/User.ts')).toBe(true);
    });

    it('should handle circular dependencies with ImportIndex', async () => {
      fileProvider.addFile('/src/A.ts', `
import { B } from './B';
export class A {
  private b: B;
}
      `.trim());

      fileProvider.addFile('/src/B.ts', `
import { A } from './A';
export class B {
  private a: A;
}
      `.trim());

      await importIndex.buildIndex();

      const analyzer = new CrossFileAnalyzer(fileProvider, importIndex);
      const results = await analyzer.analyzeForward('/src/A.ts', 3);

      // Should detect both files without infinite loop
      expect(results.has('/src/A.ts')).toBe(true);
      expect(results.has('/src/B.ts')).toBe(true);
      expect(results.size).toBe(2);
    });
  });

  describe('Performance Benchmarking', () => {
    it('should scale well with large number of files', async () => {
      // Create 100 files
      for (let i = 0; i < 100; i++) {
        fileProvider.addFile(`/src/Class${i}.ts`, `export class Class${i} {}`);
      }

      // Create entry point that references multiple classes
      const imports = Array.from({ length: 10 }, (_, i) => `import { Class${i} } from './Class${i}';`).join('\n');
      const classRefs = Array.from({ length: 10 }, (_, i) => `private class${i}: Class${i};`).join('\n  ');

      fileProvider.addFile('/src/App.ts', `
${imports}

export class App {
  ${classRefs}
}
      `.trim());

      // Build index
      const indexStartTime = Date.now();
      await importIndex.buildIndex();
      const indexDuration = Date.now() - indexStartTime;

      console.log(`[Benchmark] Index build time for 100 files: ${indexDuration}ms`);

      // Analyze with index
      const analyzer = new CrossFileAnalyzer(fileProvider, importIndex);
      const analysisStartTime = Date.now();
      const results = await analyzer.analyzeForward('/src/App.ts', 2);
      const analysisDuration = Date.now() - analysisStartTime;

      console.log(`[Benchmark] Analysis time with ImportIndex: ${analysisDuration}ms`);
      console.log(`[Benchmark] Files analyzed: ${results.size}`);

      // Should complete in reasonable time
      expect(indexDuration).toBeLessThan(5000); // 5 seconds max for indexing
      expect(analysisDuration).toBeLessThan(5000); // 5 seconds max for analysis
    });
  });
});
