/**
 * TypeScript test fixtures for CrossFileAnalyzer tests
 */

export const TS_FIXTURES = {
  // Single file with no dependencies
  simpleClass: `
export class User {
  private id: string;
  private name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  getName(): string {
    return this.name;
  }
}`,

  // File with composition relationship
  serviceWithDependency: `
import { UserRepository } from './UserRepository';

export class UserService {
  private repository: UserRepository;

  constructor(repository: UserRepository) {
    this.repository = repository;
  }

  async getUser(id: string) {
    return this.repository.findById(id);
  }
}`,

  // Repository class
  repository: `
import { User } from './User';

export class UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
}`,

  // Interface
  interface: `
export interface ILogger {
  log(message: string): void;
  error(message: string): void;
}`,

  // Class implementing interface
  classWithInterface: `
import { ILogger } from './ILogger';

export class ConsoleLogger implements ILogger {
  log(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
  }
}`,

  // Class with inheritance
  classWithInheritance: `
import { BaseService } from './BaseService';

export class UserService extends BaseService {
  async getUsers() {
    return this.query('SELECT * FROM users');
  }
}`,

  baseService: `
export abstract class BaseService {
  protected query(sql: string): Promise<any> {
    // implementation
    return Promise.resolve([]);
  }
}`,

  // Circular dependency case A -> B -> A
  circularA: `
import { ClassB } from './ClassB';

export class ClassA {
  private b: ClassB;

  constructor(b: ClassB) {
    this.b = b;
  }
}`,

  circularB: `
import { ClassA } from './ClassA';

export class ClassB {
  private a: ClassA;

  setA(a: ClassA) {
    this.a = a;
  }
}`,
};
