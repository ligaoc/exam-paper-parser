# Requirements Document

## Introduction

增强 PDF 文档解析服务，使其能够像 DOCX 解析器一样提取字号、样式信息，并复用现有的结构提取服务（structureExtractorService）进行智能题目识别。同时支持 PDF 中的图片和表格提取。

## Glossary

- **PDF_Parser**: PDF 文档解析服务，负责从 PDF 文件中提取文本、样式、图片和表格
- **Styled_Paragraph**: 带样式信息的段落对象，包含文本、字号、粗体等属性
- **Structure_Extractor**: 结构提取服务，负责从带样式段落中识别题号、分数等结构化信息
- **Text_Item**: PDF 中的文本项，包含文本内容、位置、高度（字号）等信息
- **pdfjs-dist**: Mozilla 的 PDF.js 库，用于解析 PDF 文件

## Requirements

### Requirement 1: 提取带样式的段落

**User Story:** As a 用户, I want PDF 解析器能够提取每个段落的字号信息, so that 系统可以基于字号进行智能题目层级识别。

#### Acceptance Criteria

1. WHEN 解析 PDF 文件时, THE PDF_Parser SHALL 使用 pdfjs-dist 库提取每个文本项的高度（height）作为字号
2. WHEN 提取文本项时, THE PDF_Parser SHALL 将同一行的文本项合并为一个段落
3. WHEN 构建 Styled_Paragraph 时, THE PDF_Parser SHALL 包含 text、fontSize、isBold、sortKey 属性
4. WHEN 段落内有多个不同字号的文本项时, THE PDF_Parser SHALL 使用该段落中最大的字号作为段落字号
5. WHEN 文本项的字号无法获取时, THE PDF_Parser SHALL 使用默认字号 10.5pt

### Requirement 2: 复用结构提取服务

**User Story:** As a 开发者, I want PDF 解析结果能够复用现有的 structureExtractorService, so that 不需要为 PDF 单独实现题目识别逻辑。

#### Acceptance Criteria

1. WHEN PDF_Parser 返回 styledParagraphs 时, THE 数据结构 SHALL 与 DOCX 解析器返回的格式一致
2. WHEN 调用 extractWithStyles 函数时, THE Structure_Extractor SHALL 能够正确处理 PDF 的 styledParagraphs
3. WHEN 应用解析规则时, THE PDF_Parser SHALL 支持与 DOCX 相同的题号模式和分数模式

### Requirement 3: 提取 PDF 图片

**User Story:** As a 用户, I want 系统能够提取 PDF 中的图片, so that 我可以查看试卷中的图表和插图。

#### Acceptance Criteria

1. WHEN 解析 PDF 文件时, THE PDF_Parser SHALL 提取所有嵌入的图片
2. WHEN 提取图片时, THE PDF_Parser SHALL 返回图片的 base64 编码和 mimeType
3. WHEN 图片提取失败时, THE PDF_Parser SHALL 记录警告日志并继续处理其他内容
4. IF PDF 不包含可提取的图片, THEN THE PDF_Parser SHALL 返回空数组

### Requirement 4: 识别 PDF 表格

**User Story:** As a 用户, I want 系统能够识别 PDF 中的表格结构, so that 答案表格等内容可以被正确解析。

#### Acceptance Criteria

1. WHEN 解析 PDF 文件时, THE PDF_Parser SHALL 尝试识别表格结构
2. WHEN 识别表格时, THE PDF_Parser SHALL 基于文本项的位置坐标进行行列分组
3. WHEN 表格识别成功时, THE PDF_Parser SHALL 返回与 DOCX 表格相同格式的数据结构
4. IF 表格识别不准确, THEN THE PDF_Parser SHALL 提供原始文本作为备选

### Requirement 5: 保持向后兼容

**User Story:** As a 开发者, I want 增强后的 PDF 解析器保持向后兼容, so that 现有的调用代码不需要修改。

#### Acceptance Criteria

1. WHEN 调用 parse 函数时, THE PDF_Parser SHALL 继续返回 text、pages、metadata 属性
2. WHEN 调用 parse 函数时, THE PDF_Parser SHALL 新增 styledParagraphs、images、tables 属性
3. WHEN 旧版调用只使用 text 属性时, THE PDF_Parser SHALL 正常工作
4. WHEN isTextBased 函数被调用时, THE PDF_Parser SHALL 继续正常工作

### Requirement 6: 处理 PDF 特殊格式

**User Story:** As a 用户, I want 系统能够正确处理化学式、数学公式等特殊格式, so that 试卷内容不会出现乱码。

#### Acceptance Criteria

1. WHEN 文本包含上下标时, THE PDF_Parser SHALL 尽可能保留其相对位置关系
2. WHEN 文本包含特殊字符时, THE PDF_Parser SHALL 正确解码并保留
3. WHEN 化学式被拆分为多个文本项时, THE PDF_Parser SHALL 将其合并为完整文本
