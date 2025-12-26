# Requirements Document

## Introduction

DOCX 表格解析优化功能旨在解决当前系统解析 Word 文档时表格结构丢失的问题。当前使用 mammoth 库的 `extractRawText()` 方法会将表格内容拆散为独立的文本行，导致表格的行列关系完全丢失。本功能将增强 docxParserService，使其能够正确识别和保留表格结构，确保解析结果与原文档保持一致。

## Glossary

- **Table_Parser**: 表格解析器，负责从 DOCX 文件中提取表格结构
- **Table**: 表格对象，包含行、列、单元格等结构化信息
- **Row**: 表格行，包含一组单元格
- **Cell**: 单元格，表格的最小单位，包含文本内容
- **Merged_Cell**: 合并单元格，跨越多行或多列的单元格
- **OOXML**: Office Open XML，DOCX 文件的底层 XML 格式
- **Content_Block**: 内容块，文档中的一个独立内容单元（段落或表格）

## Requirements

### Requirement 1: 表格识别与提取

**User Story:** As a 教师/编辑人员, I want to 从 DOCX 文档中正确提取表格, so that 表格内容不会被拆散成独立的文本行。

#### Acceptance Criteria

1. WHEN 解析包含表格的 DOCX 文件 THEN THE Table_Parser SHALL 识别文档中的所有表格
2. WHEN 表格被识别 THEN THE Table_Parser SHALL 提取表格的行数和列数
3. WHEN 表格被识别 THEN THE Table_Parser SHALL 保留每个单元格的文本内容
4. WHEN 表格被识别 THEN THE Table_Parser SHALL 保留单元格的行列位置关系
5. WHEN 文档不包含表格 THEN THE Table_Parser SHALL 返回空的表格数组

### Requirement 2: 合并单元格处理

**User Story:** As a 教师/编辑人员, I want to 正确处理合并单元格, so that 跨行或跨列的单元格能被正确识别。

#### Acceptance Criteria

1. WHEN 表格包含水平合并单元格 THEN THE Table_Parser SHALL 记录单元格的列跨度(colspan)
2. WHEN 表格包含垂直合并单元格 THEN THE Table_Parser SHALL 记录单元格的行跨度(rowspan)
3. WHEN 单元格被合并 THEN THE Table_Parser SHALL 在合并区域的起始位置保留内容
4. WHEN 单元格被合并 THEN THE Table_Parser SHALL 标记被合并覆盖的位置

### Requirement 3: 表格内容格式保留

**User Story:** As a 教师/编辑人员, I want to 保留表格单元格内的格式信息, so that 我可以区分表头和数据行。

#### Acceptance Criteria

1. WHEN 单元格包含多段落文本 THEN THE Table_Parser SHALL 保留段落分隔
2. WHEN 表格有表头行 THEN THE Table_Parser SHALL 尝试识别并标记表头
3. THE Table_Parser SHALL 保留单元格内的换行符

### Requirement 4: 表格位置追踪

**User Story:** As a 教师/编辑人员, I want to 知道表格在文档中的位置, so that 我可以将表格与周围的题目内容关联。

#### Acceptance Criteria

1. WHEN 表格被提取 THEN THE Table_Parser SHALL 记录表格在文档内容流中的位置索引
2. WHEN 解析完成 THEN THE Table_Parser SHALL 返回按文档顺序排列的内容块列表（包含段落和表格）
3. THE Table_Parser SHALL 为每个表格生成唯一标识符

### Requirement 5: 表格数据结构输出

**User Story:** As a 开发者, I want to 获取结构化的表格数据, so that 我可以在前端正确渲染表格。

#### Acceptance Criteria

1. THE Table_Parser SHALL 输出表格为二维数组格式（行数组包含单元格数组）
2. THE Table_Parser SHALL 为每个单元格提供 text、rowspan、colspan 属性
3. THE Table_Parser SHALL 提供表格的 HTML 表示形式（可选，用于直接渲染）
4. WHEN 表格数据被序列化 THEN THE Table_Parser SHALL 确保可以从 JSON 还原完整表格结构

### Requirement 6: 向后兼容

**User Story:** As a 开发者, I want to 保持现有 API 兼容, so that 现有功能不受影响。

#### Acceptance Criteria

1. THE Table_Parser SHALL 保留现有的 parse() 函数签名
2. THE Table_Parser SHALL 在返回结果中新增 tables 字段存放表格数据
3. THE Table_Parser SHALL 在返回结果中新增 contentBlocks 字段存放有序内容
4. WHEN 调用现有 API THEN THE Table_Parser SHALL 继续返回 text、paragraphs 等原有字段
