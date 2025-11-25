/**
 * Test helper: Register all parsers for testing
 * This ensures ParserService has all required parsers registered
 */

import { ParserService } from "../../services/ParserService.js";
import { TypeScriptParser } from "../../parsers/typescript/TypeScriptParser.js";
import { JavaScriptParser } from "../../parsers/typescript/JavaScriptParser.js";
import { JavaParser } from "../../parsers/java/JavaParser.js";
import { PythonParser } from "../../parsers/python/PythonParser.js";

/**
 * Register all parsers for testing
 * This should be called in test setup (beforeEach or beforeAll)
 */
export function registerTestParsers(): void {
  const parserService = ParserService.getInstance();

  // Clear any existing parsers (in case of test isolation issues)
  // Note: ParserService is a singleton, so we need to handle this carefully
  // For now, we'll just register parsers - if they're already registered,
  // the registry will throw an error, which we'll catch and ignore

  try {
    parserService.registerParser(new TypeScriptParser());
  } catch {
    // Parser already registered, ignore
  }

  try {
    parserService.registerParser(new JavaScriptParser());
  } catch {
    // Parser already registered, ignore
  }

  try {
    parserService.registerParser(new JavaParser());
  } catch {
    // Parser already registered, ignore
  }

  try {
    parserService.registerParser(new PythonParser());
  } catch {
    // Parser already registered, ignore
  }
}
