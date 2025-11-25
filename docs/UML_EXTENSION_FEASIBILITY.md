# UML 图扩展可行性分析

## 当前状态

### 已支持的 UML 图类型

- ✅ **类图（Class Diagram）** - 完全支持，包括跨文件分析
- ✅ **序列图（Sequence Diagram）** - 完全支持，包括跨文件分析

### 技术架构

- **渲染引擎**: Mermaid.js（通过 CDN 加载）
- **分析引擎**: UMLAnalyzer（统一的图表生成接口）
- **解析系统**: 支持 TypeScript/JavaScript（Babel）、Java/Python（统一解析器）
- **跨文件分析**: CrossFileAnalyzer（支持深度 1-3 的依赖分析）

## Mermaid.js 支持的 UML 图类型

根据 Mermaid.js 官方文档，以下 UML 图类型在技术上可行：

### 高可行性（Mermaid 原生支持）

1. **状态图（State Diagram）** ⭐⭐⭐⭐⭐
   - Mermaid 语法: `stateDiagram-v2`
   - 实现难度: 中等
   - 需要分析: 状态机、状态转换、事件触发
   - 适用场景: 状态机、工作流、生命周期

2. **活动图（Activity Diagram）** ⭐⭐⭐⭐⭐
   - Mermaid 语法: `flowchart` 或 `graph`
   - 实现难度: 中等
   - 需要分析: 控制流、决策点、并行活动
   - 适用场景: 业务流程、算法流程、工作流

3. **ER 图（Entity Relationship Diagram）** ⭐⭐⭐⭐
   - Mermaid 语法: `erDiagram`
   - 实现难度: 中等
   - 需要分析: 实体、关系、属性
   - 适用场景: 数据库设计、数据模型

### 中等可行性（需要额外工作）

4. **组件图（Component Diagram）** ⭐⭐⭐
   - Mermaid 语法: 使用 `graph` 或 `flowchart`
   - 实现难度: 中高
   - 需要分析: 模块依赖、接口、组件边界
   - 适用场景: 系统架构、模块设计
   - 备注: 可以基于现有的 CrossFileAnalyzer 扩展

5. **包图（Package Diagram）** ⭐⭐⭐
   - Mermaid 语法: 使用 `graph` 或 `flowchart`
   - 实现难度: 中等
   - 需要分析: 包结构、包依赖
   - 适用场景: 代码组织、模块化设计
   - 备注: 可以基于现有的 ImportIndex 扩展

6. **部署图（Deployment Diagram）** ⭐⭐
   - Mermaid 语法: 使用 `graph` 或 `flowchart`
   - 实现难度: 高
   - 需要分析: 节点、组件部署、连接
   - 适用场景: 系统部署、基础设施
   - 备注: 需要配置文件或注释来识别部署信息

### 低可行性（需要语义理解或 AI）

7. **用例图（Use Case Diagram）** ⭐⭐
   - Mermaid 语法: 使用 `graph` 或 `flowchart`
   - 实现难度: 很高
   - 需要分析: 用户角色、用例、关系
   - 适用场景: 需求分析、系统功能
   - 备注: 需要从代码注释、文档或 AI 分析中提取

8. **对象图（Object Diagram）** ⭐⭐
   - Mermaid 语法: 使用 `graph` 或 `flowchart`
   - 实现难度: 高
   - 需要分析: 运行时对象、对象关系
   - 适用场景: 运行时快照、调试
   - 备注: 需要运行时信息或测试数据

## 实现路径建议

### 阶段 1: 高价值、低难度（推荐优先实现）

#### 1. 活动图（Activity Diagram）

**实现步骤：**

1. 创建 `ActivityAnalyzer` 类
2. 分析控制流：if/else、switch、循环、函数调用
3. 生成 Mermaid flowchart 语法
4. 在 `UMLAnalyzer.generateDiagram()` 中添加支持
5. 更新 `DiagramType` 类型定义
6. 在 UI 中添加活动图选项

**代码示例：**

```typescript
// src/core/analyzers/ActivityAnalyzer.ts
export class ActivityAnalyzer {
  analyze(ast: UnifiedAST | t.File): ActivityInfo {
    // 分析控制流、决策点、活动节点
  }
}

// 在 UMLAnalyzer 中
if (type === "activity") {
  return this.generateActivityDiagram(ast, code);
}
```

**预期工作量**: 2-3 天

#### 2. 状态图（State Diagram）

**实现步骤：**

1. 创建 `StateAnalyzer` 类
2. 识别状态机模式：状态类、状态转换、事件
3. 生成 Mermaid stateDiagram-v2 语法
4. 集成到现有架构

**预期工作量**: 3-4 天

### 阶段 2: 中等难度、高价值

#### 3. 组件图（Component Diagram）

**实现步骤：**

1. 扩展 `CrossFileAnalyzer` 或创建 `ComponentAnalyzer`
2. 分析模块边界（基于文件/目录结构）
3. 识别接口和依赖关系
4. 生成组件图

**预期工作量**: 4-5 天

#### 4. 包图（Package Diagram）

**实现步骤：**

1. 利用现有的 `ImportIndex` 服务
2. 分析包/命名空间结构
3. 生成包依赖图

**预期工作量**: 2-3 天

### 阶段 3: 高级功能

#### 5. ER 图（Entity Relationship Diagram）

**实现步骤：**

1. 创建 `ERAnalyzer` 类
2. 分析类/实体、属性、关系
3. 生成 ER 图（可以基于类图数据）

**预期工作量**: 3-4 天

## 架构扩展点

### 1. 类型定义扩展

```typescript
// src/core/types/uml.ts
export type DiagramType =
  | "class"
  | "sequence"
  | "activity" // 新增
  | "state" // 新增
  | "component" // 新增
  | "package" // 新增
  | "er"; // 新增
```

### 2. UMLAnalyzer 扩展

```typescript
// src/core/analyzers/UMLAnalyzer.ts
private async generateWithNative(
  code: string,
  type: DiagramType,
  filePath: string,
): Promise<UMLResult> {
  const ast = await this.parseCode(code, filePath);

  if (type === "class") {
    return this.generateClassDiagram(ast, code, filePath);
  } else if (type === "sequence") {
    return this.generateSequenceDiagram(ast, code);
  } else if (type === "activity") {
    return this.generateActivityDiagram(ast, code);  // 新增
  } else if (type === "state") {
    return this.generateStateDiagram(ast, code);     // 新增
  }
  // ...
}
```

### 3. UI 扩展

```typescript
// src/views/diagram-panel.ts
// 在 typeSelector 中添加新按钮
<button class="btn" data-type="activity">Activity</button>
<button class="btn" data-type="state">State</button>
```

### 4. 命令扩展

```typescript
// src/commands/generate-activity-diagram.ts
export class GenerateActivityDiagramCommand {
  // 类似现有的 GenerateClassDiagramCommand
}
```

## 技术挑战与解决方案

### 挑战 1: 状态机识别

**问题**: 如何从代码中识别状态机模式？
**解决方案**:

- 识别状态枚举/常量
- 查找状态转换方法
- 分析状态相关的条件语句
- 支持常见状态机库（如 XState）

### 挑战 2: 活动图控制流分析

**问题**: 如何准确分析复杂的控制流？
**解决方案**:

- 使用 AST 遍历分析控制结构
- 识别决策点（if/else、switch）
- 识别循环（for、while）
- 识别并行活动（Promise.all、async/await）

### 挑战 3: 组件边界识别

**问题**: 如何定义组件边界？
**解决方案**:

- 基于目录结构（如 src/components/）
- 基于命名空间/包
- 基于配置文件（如 package.json 的 workspaces）
- 允许用户自定义组件边界

## 语言支持优先级

### 当前支持

- TypeScript/JavaScript: 完全支持
- Java: 类图支持
- Python: 类图支持

### 新图类型语言支持建议

1. **活动图**: TypeScript/JavaScript → Java → Python
2. **状态图**: TypeScript/JavaScript → Java → Python
3. **组件图**: 所有语言（基于文件结构）
4. **包图**: 所有语言（基于命名空间/包）

## 测试策略

### 单元测试

- 为每个新的 Analyzer 创建测试
- 测试 AST 解析和转换
- 测试 Mermaid 代码生成

### 集成测试

- 测试完整的图表生成流程
- 测试跨文件分析（如适用）
- 测试错误处理

### E2E 测试

- 测试 UI 交互
- 测试图表渲染
- 测试不同语言的文件

## 推荐实施顺序

### 优先级 1（立即实施）

1. **活动图（Activity Diagram）** - 高价值、中等难度
2. **状态图（State Diagram）** - 高价值、中等难度

### 优先级 2（短期计划）

3. **包图（Package Diagram）** - 中等价值、低难度
4. **组件图（Component Diagram）** - 高价值、中高难度

### 优先级 3（长期计划）

5. **ER 图（Entity Relationship Diagram）** - 中等价值、中等难度
6. **部署图（Deployment Diagram）** - 低价值、高难度（需要额外配置）

## 结论

**总体可行性**: ⭐⭐⭐⭐⭐ (非常高)

**优势：**

- ✅ Mermaid.js 原生支持多种 UML 图
- ✅ 现有架构模块化，易于扩展
- ✅ 已有跨文件分析基础设施
- ✅ 统一的生成接口和 UI 系统

**建议：**

1. 优先实现活动图和状态图（高价值、中等难度）
2. 利用现有的分析器和基础设施
3. 保持与现有架构的一致性
4. 逐步扩展语言支持

**预期时间线：**

- 活动图: 2-3 天
- 状态图: 3-4 天
- 包图: 2-3 天
- 组件图: 4-5 天
- **总计**: 约 2-3 周（包括测试和文档）
