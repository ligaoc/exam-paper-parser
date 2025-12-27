# Design Document: PDF Enhanced Parser

## Overview

增强现有的 PDF 解析服务（pdfParserService.js），使其能够提取字号样式信息，并与 DOCX 解析器保持一致的输出格式。这样可以复用现有的 structureExtractorService 进行智能题目识别，同时支持图片和表格提取。

核心改进：
1. 使用 pdfjs-dist 替代 pdf-parse，获取更丰富的文本元数据
2. 构建与 DOCX 相同格式的 styledParagraphs 数据结构
3. 基于文本位置坐标识别表格结构
4. 提取嵌入图片

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ipcHandlers.js                         │
│                    (file:parse handler)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    pdfParserService.js                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  parse(filePath)                                     │   │
│  │    ├── extractTextWithStyles() → styledParagraphs   │   │
│  │    ├── extractImages() → images                     │   │
│  │    ├── detectTables() → tables                      │   │
│  │    └── 返回统一格式结果                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                structureExtractorService.js                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  extractWithStyles(styledParagraphs, rule)          │   │
│  │    └── 复用现有的智能题目识别逻辑                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. PDF 解析服务增强 (pdfParserService.js)

#### 新增函数

```javascript
/**
 * 提取带样式的段落（核心新增功能）
 * @param {string} filePath - PDF 文件路径
 * @returns {Promise<Array<StyledParagraph>>}
 */
async function extractStyledParagraphs(filePath) {
  // 使用 pdfjs-dist 解析
  // 提取每个文本项的 height 作为字号
  // 按 Y 坐标分组合并为段落
}

/**
 * 提取 PDF 中的图片
 * @param {string} filePath - PDF 文件路径
 * @returns {Promise<Array<Image>>}
 */
async function extractImages(filePath) {
  // 遍历每页的操作符列表
  // 提取图片数据并转换为 base64
}

/**
 * 检测表格结构
 * @param {Array<TextItem>} textItems - 文本项数组
 * @returns {Array<Table>}
 */
function detectTables(textItems) {
  // 基于文本位置坐标进行行列分组
  // 识别表格边界
}
```

#### 修改后的 parse 函数

```javascript
async function parse(filePath) {
  // ... 现有逻辑保持不变 ...
  
  return {
    // 现有属性（向后兼容）
    text: string,
    pages: Array,
    metadata: Object,
    
    // 新增属性
    styledParagraphs: Array<StyledParagraph>,
    images: Array<Image>,
    tables: Array<Table>,
    contentBlocks: Array<ContentBlock>
  }
}
```

### 2. IPC Handler 修改 (ipcHandlers.js)

```javascript
// file:parse handler 中的 PDF 分支
if (ext === 'pdf') {
  const result = await pdfParser.parse(filePath)
  content = result.text
  images = result.images || []
  tables = result.tables || []
  styledParagraphs = result.styledParagraphs || []
  
  // 使用智能识别（如果有 styledParagraphs）
  if (styledParagraphs.length > 0) {
    const { questions } = structureExtractor.extractWithStyles(styledParagraphs, rule)
    extracted = { questions, brackets: [], underlines: [] }
  } else {
    // 降级到旧方法
    extracted = structureExtractor.extract(content, rule)
  }
}
```

## Data Models

### StyledParagraph（与 DOCX 格式一致）

```typescript
interface StyledParagraph {
  index: number;           // 段落索引
  text: string;            // 段落文本
  fontSize: number;        // 字号（pt）
  isBold: boolean;         // 是否粗体
  paragraphStyle: string | null;  // 段落样式
  sortKey: number;         // 排序键 = (isBold ? 1000 : 0) + fontSize
  pageNumber: number;      // 所在页码（PDF 特有）
}
```

### TextItem（PDF 文本项）

```typescript
interface TextItem {
  str: string;             // 文本内容
  height: number;          // 高度（字号）
  width: number;           // 宽度
  transform: number[];     // 变换矩阵 [scaleX, skewX, skewY, scaleY, x, y]
  fontName: string;        // 字体名称
  pageNumber: number;      // 页码
}
```

### Image（图片）

```typescript
interface Image {
  id: string;              // 唯一标识
  position: number;        // 位置索引
  pageNumber: number;      // 所在页码
  mimeType: string;        // MIME 类型
  base64: string;          // Base64 编码
  dataUrl: string;         // Data URL
  width?: number;          // 宽度
  height?: number;         // 高度
}
```

### Table（表格，与 DOCX 格式一致）

```typescript
interface Table {
  id: string;
  position: number;
  rowCount: number;
  colCount: number;
  rows: Array<{
    index: number;
    cells: Array<{
      text: string;
      rowIndex: number;
      colIndex: number;
      rowspan: number;
      colspan: number;
      isMerged: boolean;
    }>;
    isHeader: boolean;
  }>;
  html: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 文本项合并保持内容完整性

*For any* PDF 页面中的文本项集合，将同一行（Y 坐标相近）的文本项合并后，合并结果应包含所有原始文本项的内容，且顺序按 X 坐标从左到右排列。

**Validates: Requirements 1.2, 6.3**

### Property 2: 字号提取正确性

*For any* 包含多个不同字号文本项的段落，段落的最终字号应等于该段落中所有文本项字号的最大值。

**Validates: Requirements 1.4**

### Property 3: 返回数据结构完整性

*For any* 有效的 PDF 文件，parse 函数返回的对象应同时包含旧属性（text, pages, metadata）和新属性（styledParagraphs, images, tables），且 styledParagraphs 中每个对象都包含 text, fontSize, isBold, sortKey 属性。

**Validates: Requirements 1.3, 5.1, 5.2**

### Property 4: 数据格式兼容性

*For any* PDF 解析返回的 styledParagraphs，其数据结构应与 DOCX 解析器返回的 styledParagraphs 格式一致，能够被 structureExtractor.extractWithStyles 正确处理。

**Validates: Requirements 2.1, 2.2, 4.3**

### Property 5: 表格行列分组正确性

*For any* 具有表格布局的文本项集合（Y 坐标形成明显的行分组，X 坐标形成明显的列分组），表格检测算法应正确识别行数和列数。

**Validates: Requirements 4.2**

### Property 6: 图片数据格式正确性

*For any* 成功提取的图片，返回的图片对象应包含有效的 base64 编码和正确的 mimeType，且 dataUrl 格式为 `data:{mimeType};base64,{base64}`。

**Validates: Requirements 3.2**

## Error Handling

1. **PDF 文件不存在**：抛出明确的错误信息
2. **PDF 文件损坏**：捕获 pdfjs-dist 的解析错误，返回友好提示
3. **图片提取失败**：记录警告日志，继续处理其他内容，返回空图片数组
4. **表格识别失败**：降级返回原始文本，不影响主流程
5. **字号无法获取**：使用默认值 10.5pt

## Testing Strategy

### 单元测试

1. **文本项合并测试**
   - 测试同一行文本项的合并
   - 测试不同行文本项的分离
   - 测试空文本项的处理

2. **字号提取测试**
   - 测试单一字号段落
   - 测试混合字号段落
   - 测试无字号信息的降级处理

3. **表格检测测试**
   - 测试简单表格识别
   - 测试复杂表格（合并单元格）
   - 测试非表格内容的排除

### 属性测试

使用 fast-check 库进行属性测试，每个属性测试运行至少 100 次迭代。

1. **Property 1**: 生成随机文本项集合，验证合并后内容完整性
2. **Property 2**: 生成随机字号的文本项，验证最大字号选择
3. **Property 3**: 使用实际 PDF 文件，验证返回结构完整性
4. **Property 4**: 比较 PDF 和 DOCX 解析结果的结构兼容性
5. **Property 5**: 生成表格布局的文本项，验证行列识别
6. **Property 6**: 验证图片数据格式正确性

### 集成测试

1. 使用实际的试卷 PDF 文件进行端到端测试
2. 验证与 DOCX 解析结果的一致性
3. 验证 IPC handler 的正确调用
