# Design Document: DOCX 表格解析优化

## Overview

本设计旨在增强 `docxParserService.js`，使其能够正确解析 DOCX 文档中的表格结构。核心思路是直接解析 DOCX 文件内部的 OOXML 结构（word/document.xml），从中提取表格的完整行列信息，而不是依赖 mammoth 的纯文本输出。

### 技术方案选择

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| 解析 mammoth HTML 输出 | 简单，mammoth 已转换表格为 `<table>` | 丢失合并单元格信息 | ❌ |
| 直接解析 OOXML | 完全控制，可获取精确结构 | 需要理解 OOXML 格式 | ✅ |
| 使用第三方库如 docx4js | 功能强大 | 增加依赖，可能过重 | ❌ |

选择直接解析 OOXML 的原因：
1. 项目已使用 `adm-zip` 读取 DOCX 内部文件（用于页眉页脚）
2. 可以精确获取合并单元格信息（`<w:gridSpan>`, `<w:vMerge>`）
3. 不增加新的外部依赖

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    docxParserService.js                      │
├─────────────────────────────────────────────────────────────┤
│  parse(filePath)                                             │
│    ├── parseDocx(filePath)                                   │
│    │     ├── mammoth.extractRawText()  // 现有：提取纯文本    │
│    │     ├── mammoth.convertToHtml()   // 现有：转换HTML      │
│    │     ├── extractTables()           // 新增：提取表格      │
│    │     └── buildContentBlocks()      // 新增：构建内容块    │
│    └── extractHeadersFooters()         // 现有：页眉页脚      │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 表格提取函数 `extractTables(filePath)`

从 DOCX 文件中提取所有表格。

```javascript
/**
 * @param {string} filePath - DOCX 文件路径
 * @returns {Promise<Table[]>} 表格数组
 */
async function extractTables(filePath) {
  // 1. 使用 adm-zip 读取 word/document.xml
  // 2. 解析 XML 中的 <w:tbl> 元素
  // 3. 构建表格数据结构
}
```

### 2. 表格数据结构 `Table`

```typescript
interface Table {
  id: string;              // 唯一标识符
  position: number;        // 在文档中的位置索引
  rowCount: number;        // 行数
  colCount: number;        // 列数
  rows: Row[];             // 行数组
  html: string;            // HTML 表示形式
}

interface Row {
  index: number;           // 行索引
  cells: Cell[];           // 单元格数组
  isHeader: boolean;       // 是否为表头行
}

interface Cell {
  text: string;            // 单元格文本
  rowIndex: number;        // 行位置
  colIndex: number;        // 列位置
  rowspan: number;         // 行跨度（默认1）
  colspan: number;         // 列跨度（默认1）
  isMerged: boolean;       // 是否被其他单元格合并覆盖
  images: CellImage[];     // 单元格内的图片数组
}

interface CellImage {
  id: string;              // 图片唯一标识符
  rId: string;             // 关系 ID
  mimeType: string;        // MIME 类型
  base64: string;          // Base64 编码的图片数据
  dataUrl: string;         // Data URL 格式
}
```

### 3. 内容块数据结构 `ContentBlock`

```typescript
interface ContentBlock {
  type: 'paragraph' | 'table';
  index: number;           // 在文档中的顺序
  content: string | Table; // 段落文本或表格对象
}
```

### 4. 更新后的解析结果结构

```typescript
interface ParseResult {
  // 现有字段（保持兼容）
  text: string;
  html: string;
  paragraphs: Paragraph[];
  headers: string[];
  footers: string[];
  messages: any[];
  
  // 新增字段
  tables: Table[];              // 所有表格
  contentBlocks: ContentBlock[]; // 有序内容块
}
```

## Data Models

### OOXML 表格结构映射

DOCX 文件中的表格存储在 `word/document.xml` 中，结构如下：

```xml
<w:tbl>                          <!-- 表格 -->
  <w:tblPr>...</w:tblPr>         <!-- 表格属性 -->
  <w:tblGrid>                    <!-- 列定义 -->
    <w:gridCol w:w="2000"/>
    <w:gridCol w:w="3000"/>
  </w:tblGrid>
  <w:tr>                         <!-- 行 -->
    <w:trPr>...</w:trPr>         <!-- 行属性 -->
    <w:tc>                       <!-- 单元格 -->
      <w:tcPr>
        <w:gridSpan w:val="2"/>  <!-- 水平合并：跨2列 -->
        <w:vMerge w:val="restart"/> <!-- 垂直合并：起始 -->
      </w:tcPr>
      <w:p>                      <!-- 段落 -->
        <w:r>                    <!-- 文本运行 -->
          <w:t>单元格内容</w:t>
        </w:r>
      </w:p>
    </w:tc>
  </w:tr>
</w:tbl>
```

### 合并单元格处理逻辑

1. **水平合并 (colspan)**：通过 `<w:gridSpan w:val="N"/>` 指定
2. **垂直合并 (rowspan)**：
   - `<w:vMerge w:val="restart"/>` 表示合并起始
   - `<w:vMerge/>` (无 val 属性) 表示被合并的单元格

### 单元格图片提取逻辑

单元格内的图片通过 `<w:drawing>` 元素表示：

```xml
<w:tc>
  <w:p>
    <w:r>
      <w:drawing>
        <wp:inline>
          <a:graphic>
            <a:graphicData>
              <pic:pic>
                <pic:blipFill>
                  <a:blip r:embed="rId5"/>  <!-- 图片关系 ID -->
                </pic:blipFill>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>
</w:tc>
```

提取步骤：
1. 在单元格 XML 中查找所有 `<w:drawing>` 元素
2. 从 `r:embed` 属性获取关系 ID
3. 通过关系 ID 在 `word/_rels/document.xml.rels` 中查找图片路径
4. 从 `word/media/` 目录读取图片数据
5. 将图片添加到单元格的 `images` 数组

### 内容块去重逻辑

构建 contentBlocks 时需要避免重复提取表格内的内容：

1. 首先识别所有表格的位置范围（start, end）
2. 提取图片时，检查图片位置是否在任何表格范围内
3. 如果图片在表格内，跳过（图片已在表格单元格中处理）
4. 提取段落时，同样检查段落是否在表格范围内

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 表格结构完整性

*For any* DOCX 文档包含的表格，解析后的表格行数、列数、以及每个单元格的文本内容和位置应与原始文档完全一致。

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: 合并单元格跨度正确性

*For any* 包含合并单元格的表格，解析后的 colspan 和 rowspan 值应准确反映原始文档中的合并范围。

**Validates: Requirements 2.1, 2.2**

### Property 3: 合并单元格内容位置

*For any* 合并单元格，其内容应出现在合并区域的起始位置（左上角），被覆盖的位置应标记为 isMerged=true。

**Validates: Requirements 2.3, 2.4**

### Property 4: 内容块顺序一致性

*For any* DOCX 文档，解析后的 contentBlocks 数组中元素的顺序应与原文档中段落和表格的出现顺序一致。

**Validates: Requirements 4.1, 4.2**

### Property 5: 表格 ID 唯一性

*For any* 解析结果中的表格数组，每个表格的 id 应该是唯一的。

**Validates: Requirements 4.3**

### Property 6: 单元格数据结构完整性

*For any* 解析后的表格，其结构应为二维数组格式，且每个单元格对象应包含 text、rowspan、colspan 属性。

**Validates: Requirements 5.1, 5.2**

### Property 7: 表格 JSON 序列化往返一致性

*For any* 解析后的表格对象，将其序列化为 JSON 后再反序列化，应得到与原对象等价的结构。

**Validates: Requirements 5.4**

### Property 8: API 向后兼容性

*For any* 对 parse() 函数的调用，返回结果应包含原有的 text、html、paragraphs、headers、footers 字段，同时新增 tables 和 contentBlocks 字段。

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

## Error Handling

| 错误场景 | 处理方式 |
|---------|---------|
| DOCX 文件损坏无法读取 | 抛出错误，提示文件损坏 |
| document.xml 不存在 | 返回空表格数组，不影响其他解析 |
| XML 解析失败 | 记录警告日志，返回空表格数组 |
| 表格结构异常（如缺少行/列） | 尽可能解析，跳过异常部分 |

## Testing Strategy

### 单元测试

1. **基础表格解析**：测试简单的 2x2、3x3 表格
2. **合并单元格**：测试水平合并、垂直合并、混合合并
3. **空表格**：测试没有内容的表格
4. **多表格文档**：测试包含多个表格的文档
5. **表格位置**：测试表格在段落之间的位置识别

### 属性测试

使用 fast-check 库进行属性测试，每个属性测试运行至少 100 次迭代。

测试标签格式：`Feature: docx-table-parser, Property N: [property_text]`

### 测试数据

1. 使用真实的试卷文档（如项目中的 `2022年广东省广州市中考化学真题.docx`）
2. 生成包含各种表格结构的测试 DOCX 文件
