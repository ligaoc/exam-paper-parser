# Design Document

## Overview

试卷文档解析系统基于 Electron + Vue 3 技术栈，采用主进程/渲染进程分离架构。主进程负责文件操作、文档解析等后端逻辑，渲染进程负责用户界面展示。系统使用 mammoth 解析 Word 文档，pdf-parse 解析 PDF 文档，通过正则表达式和规则引擎提取结构化信息。

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron App                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Renderer Process (Vue 3)               │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │    │
│  │  │ FileImport  │ │ ResultView  │ │ CropSettings    │    │    │
│  │  │ Component   │ │ Component   │ │ Component       │    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘    │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │    │
│  │  │ RuleManager │ │ BatchPanel  │ │ HistoryList     │    │    │
│  │  │ Component   │ │ Component   │ │ Component       │    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │ IPC                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Main Process (Node.js)                 │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │    │
│  │  │ DocxParser  │ │ PdfParser   │ │ StructExtractor │    │    │
│  │  │ Service     │ │ Service     │ │ Service         │    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘    │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │    │
│  │  │ Cropper     │ │ RuleEngine  │ │ Database        │    │    │
│  │  │ Service     │ │ Service     │ │ Service         │    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 渲染进程组件 (Vue 3)

#### 1.1 FileImportComponent
文件导入组件，支持拖拽和点击选择文件。

```typescript
interface FileImportProps {
  acceptTypes: string[];  // ['.doc', '.docx', '.pdf']
  multiple: boolean;      // 是否支持多选
  maxFiles: number;       // 最大文件数量
}

interface FileInfo {
  id: string;
  name: string;
  path: string;
  type: 'doc' | 'docx' | 'pdf';
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
}
```

#### 1.2 ResultViewComponent
解析结果展示组件，以树形结构展示题目层级。

```typescript
interface ParseResult {
  fileId: string;
  fileName: string;
  structure: QuestionNode[];
  headers: string[];      // 页眉
  footers: string[];      // 页脚
  brackets: BracketInfo[];
  underlines: UnderlineInfo[];
  parseTime: number;
}

interface QuestionNode {
  id: string;
  level: 1 | 2 | 3;
  number: string;         // 题号如 "一、" "1." "(1)"
  content: string;        // 题目内容预览
  score?: number;         // 分数
  children: QuestionNode[];
}
```

#### 1.3 CropSettingsComponent
裁剪设置组件，设置文档边距。

```typescript
interface CropSettings {
  top: number;      // 上边距 (mm)
  bottom: number;   // 下边距 (mm)
  left: number;     // 左边距 (mm)
  right: number;    // 右边距 (mm)
  outputFormat: 'pdf' | 'docx';
  outputPath: string;
}
```

#### 1.4 RuleManagerComponent
规则管理组件，创建和管理识别规则。

```typescript
interface ParseRule {
  id: string;
  name: string;
  description: string;
  patterns: {
    level1: RegExp[];   // 一级题号模式
    level2: RegExp[];   // 二级题号模式
    level3: RegExp[];   // 三级题号模式
    score: RegExp[];    // 分数模式
    bracket: RegExp[];  // 括号模式
    underline: RegExp[];// 下划线模式
  };
  isDefault: boolean;
  createdAt: Date;
}
```

#### 1.5 BatchPanelComponent
批量处理面板，显示处理进度。

```typescript
interface BatchTask {
  id: string;
  files: FileInfo[];
  status: 'idle' | 'running' | 'completed' | 'partial';
  progress: number;       // 0-100
  results: ParseResult[];
  errors: BatchError[];
}

interface BatchError {
  fileId: string;
  fileName: string;
  message: string;
  canRetry: boolean;
}
```

### 2. 主进程服务 (Node.js)

#### 2.1 DocxParserService
Word 文档解析服务。

```typescript
interface DocxParserService {
  parse(filePath: string): Promise<DocumentContent>;
  extractHeaders(filePath: string): Promise<string[]>;
  extractFooters(filePath: string): Promise<string[]>;
}

interface DocumentContent {
  text: string;
  paragraphs: Paragraph[];
  tables: Table[];
}

interface Paragraph {
  index: number;
  text: string;
  style?: string;
}
```

#### 2.2 PdfParserService
PDF 文档解析服务。

```typescript
interface PdfParserService {
  parse(filePath: string): Promise<PdfContent>;
  getPageCount(filePath: string): Promise<number>;
}

interface PdfContent {
  text: string;
  pages: PageContent[];
  metadata: PdfMetadata;
}
```

#### 2.3 StructureExtractorService
结构提取服务，核心解析逻辑。

```typescript
interface StructureExtractorService {
  extract(content: string, rule: ParseRule): ExtractResult;
  detectQuestionNumbers(text: string): QuestionMatch[];
  detectScores(text: string): ScoreMatch[];
  detectBrackets(text: string): BracketInfo[];
  detectUnderlines(text: string): UnderlineInfo[];
}

interface ExtractResult {
  questions: QuestionNode[];
  scores: ScoreMatch[];
  brackets: BracketInfo[];
  underlines: UnderlineInfo[];
}

interface QuestionMatch {
  index: number;
  text: string;
  level: number;
  number: string;
}

interface ScoreMatch {
  index: number;
  text: string;
  value: number;
  questionId?: string;
}

interface BracketInfo {
  index: number;
  type: 'chinese' | 'small' | 'medium' | 'large' | 'square';
  content: string;
  hasScore: boolean;
}

interface UnderlineInfo {
  index: number;
  length: number;
  type: 'chinese' | 'english';
}
```

#### 2.4 CropperService
文档裁剪服务。

```typescript
interface CropperService {
  cropDocument(filePath: string, settings: CropSettings): Promise<string>;
  previewCrop(filePath: string, settings: CropSettings): Promise<Buffer>;
}
```

#### 2.5 RuleEngineService
规则引擎服务。

```typescript
interface RuleEngineService {
  createRule(rule: Omit<ParseRule, 'id' | 'createdAt'>): Promise<ParseRule>;
  updateRule(id: string, rule: Partial<ParseRule>): Promise<ParseRule>;
  deleteRule(id: string): Promise<void>;
  getRule(id: string): Promise<ParseRule | null>;
  getAllRules(): Promise<ParseRule[]>;
  getDefaultRule(): Promise<ParseRule>;
  exportRules(ids: string[]): Promise<string>;
  importRules(data: string): Promise<ParseRule[]>;
}
```

#### 2.6 DatabaseService
本地数据库服务，使用 SQLite。

```typescript
interface DatabaseService {
  // 解析结果
  saveResult(result: ParseResult): Promise<void>;
  getResult(fileId: string): Promise<ParseResult | null>;
  getHistory(limit: number): Promise<ParseResult[]>;
  deleteResult(fileId: string): Promise<void>;
  
  // 规则管理
  saveRule(rule: ParseRule): Promise<void>;
  getRules(): Promise<ParseRule[]>;
  deleteRule(id: string): Promise<void>;
}
```

### 3. IPC 通信接口

```typescript
// 渲染进程 -> 主进程
interface IpcChannels {
  'file:parse': (filePath: string, ruleId?: string) => Promise<ParseResult>;
  'file:crop': (filePath: string, settings: CropSettings) => Promise<string>;
  'batch:start': (filePaths: string[], ruleId?: string) => Promise<string>;
  'batch:cancel': (taskId: string) => Promise<void>;
  'rule:create': (rule: Omit<ParseRule, 'id'>) => Promise<ParseRule>;
  'rule:update': (id: string, rule: Partial<ParseRule>) => Promise<ParseRule>;
  'rule:delete': (id: string) => Promise<void>;
  'rule:list': () => Promise<ParseRule[]>;
  'history:list': (limit: number) => Promise<ParseResult[]>;
  'history:delete': (fileId: string) => Promise<void>;
}

// 主进程 -> 渲染进程 (事件)
interface IpcEvents {
  'batch:progress': (taskId: string, progress: number, currentFile: string) => void;
  'batch:complete': (taskId: string, results: ParseResult[]) => void;
  'batch:error': (taskId: string, error: BatchError) => void;
}
```

## Data Models

### 数据库表结构 (SQLite)

```sql
-- 解析结果表
CREATE TABLE parse_results (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  structure_json TEXT NOT NULL,
  headers_json TEXT,
  footers_json TEXT,
  brackets_json TEXT,
  underlines_json TEXT,
  rule_id TEXT,
  parse_time INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 识别规则表
CREATE TABLE parse_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  patterns_json TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 批量任务表
CREATE TABLE batch_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  completed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 文件类型验证

*For any* 文件路径，如果文件扩展名是 .doc、.docx 或 .pdf，则系统应接受该文件；否则应拒绝并返回错误。

**Validates: Requirements 1.1, 1.5**

### Property 2: 多级题号识别完整性

*For any* 包含题号的文本，Structure_Extractor 应能识别所有一级题号（阿拉伯数字如"1、"或中文数字如"一、"）、二级题号（如"1."、"(1)"）和三级题号（如"①"、"a."），且识别结果的数量应等于文本中实际存在的题号数量。

**Validates: Requirements 2.1, 2.2, 2.3, 2.6**

### Property 3: 题号层级关系正确性

*For any* 解析后的题目树结构，每个子节点的层级应比其父节点的层级大1，且根节点的层级应为1。

**Validates: Requirements 2.4, 2.5**

### Property 4: 分数提取准确性

*For any* 包含分数标注的文本（如"(3分)"、"（共10分）"），Structure_Extractor 提取的分数值应与文本中的数字一致，且提取的分数数量应等于文本中实际存在的分数标注数量。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 5: 无分数题目处理

*For any* 不包含分数标注的题目文本，Structure_Extractor 应返回题号信息但分数字段为空或undefined。

**Validates: Requirements 3.5**

### Property 6: 括号识别完整性

*For any* 包含括号的文本，Structure_Extractor 应识别所有类型的括号（中文括号、小括号、中括号、大括号、方括号），且识别结果的数量应等于文本中实际存在的括号数量。

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 7: 括号内分数提取

*For any* 括号内包含分数的文本，Structure_Extractor 应正确提取分数值；对于括号内不包含分数的文本，应只记录括号位置而不提取内容。

**Validates: Requirements 4.6, 4.7**

### Property 8: 下划线识别完整性

*For any* 包含下划线的文本，Structure_Extractor 应识别所有连续下划线（无论中文还是英文、长还是短），且记录的位置和长度应与实际一致。

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 9: 边距单位转换

*For any* 毫米值的边距设置，Cropper 应正确将其转换为内部使用的单位，且转换后再转换回毫米应得到原始值（允许浮点误差）。

**Validates: Requirements 7.2**

### Property 10: 批量处理并发限制

*For any* 批量处理任务，同时处理的文档数量应不超过3个。

**Validates: Requirements 8.1**

### Property 11: 规则应用一致性

*For any* 相同的文本和相同的解析规则，Structure_Extractor 应产生相同的解析结果。

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6**

### Property 12: 规则导入导出 Round-Trip

*For any* 有效的解析规则，导出为字符串后再导入应得到与原规则等价的规则对象。

**Validates: Requirements 9.7**

### Property 13: 解析结果 JSON 导出 Round-Trip

*For any* 有效的解析结果，导出为 JSON 后再解析应得到与原结果等价的对象。

**Validates: Requirements 10.4**

## Error Handling

### 文件操作错误
- 文件不存在：返回 `FileNotFoundError`，提示用户检查文件路径
- 文件格式不支持：返回 `UnsupportedFormatError`，列出支持的格式
- 文件读取权限不足：返回 `PermissionError`，提示用户检查文件权限
- 文件损坏：返回 `CorruptedFileError`，提示用户检查文件完整性

### 解析错误
- 文档内容为空：返回空的解析结果，不抛出错误
- 无法识别的编号格式：记录警告日志，继续解析其他内容
- 正则表达式超时：设置超时限制，超时后返回部分结果

### 批量处理错误
- 单个文件失败：标记该文件为错误状态，继续处理其他文件
- 所有文件失败：返回批量错误，包含每个文件的错误信息
- 用户取消：立即停止处理，返回已完成的结果

### 数据库错误
- 连接失败：尝试重新连接，最多3次
- 写入失败：回滚事务，返回错误信息
- 数据损坏：提示用户重置数据库

## Testing Strategy

### 单元测试
使用 Vitest 进行单元测试，覆盖以下模块：
- StructureExtractorService：题号、分数、括号、下划线识别
- RuleEngineService：规则创建、更新、删除、导入导出
- 工具函数：文件类型验证、单位转换等

### 属性测试
使用 fast-check 进行属性测试，验证以下属性：
- Property 1-13 中定义的所有正确性属性
- 每个属性测试运行至少100次迭代

### 集成测试
- 文档解析流程：从文件导入到结果输出的完整流程
- IPC 通信：主进程和渲染进程之间的通信
- 数据库操作：CRUD 操作的正确性

### 端到端测试
- 使用客户提供的300份试卷进行验收测试
- 验证识别准确率达到98%以上
