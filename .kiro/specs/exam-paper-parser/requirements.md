# Requirements Document

## Introduction

试卷文档解析系统是一个基于 Electron + Vue 3 的桌面应用，用于解析 Word (.doc/.docx) 和 PDF (文字型) 格式的试卷文档。系统能够提取试卷的层级结构（题号）、分数、括号、下划线、页眉页脚等信息，并支持文档裁剪功能。

## Glossary

- **Parser**: 文档解析器，负责从 Word/PDF 文件中提取文本和结构信息
- **Structure_Extractor**: 结构提取器，负责识别题号层级、分数、括号、下划线等元素
- **Cropper**: 裁剪器，负责调整文档边距并输出处理后的文档
- **Rule_Engine**: 规则引擎，管理和应用识别规则以提高准确率
- **Batch_Processor**: 批量处理器，负责同时处理多个文档
- **Question_Number**: 题号，试卷中的编号如 "一、"、"1."、"(1)" 等
- **Score**: 分数，试卷中标注的分值如 "(3分)"、"（共10分）"
- **Bracket**: 括号，包括中文括号（）、小括号()、中括号[]、大括号{}
- **Underline**: 下划线，填空题中的空白下划线

## Requirements

### Requirement 1: 文档导入与规则选择

**User Story:** As a 教师/编辑人员, I want to 导入 Word 和 PDF 试卷文档并选择解析规则, so that 系统可以根据不同试卷格式正确解析文档内容。

#### Acceptance Criteria

1. WHEN 用户选择文件 THEN THE Parser SHALL 支持导入 .doc、.docx 和文字型 PDF 文件
2. WHEN 用户导入 .docx 文件 THEN THE Parser SHALL 使用 mammoth 库解析文档内容
3. WHEN 用户导入 .doc 文件 THEN THE Parser SHALL 将其转换为 .docx 后解析
4. WHEN 用户导入文字型 PDF 文件 THEN THE Parser SHALL 使用 pdf-parse 库提取文本
5. WHEN 导入的文件格式不支持 THEN THE Parser SHALL 显示错误提示并拒绝导入
6. WHEN 文件导入成功 THEN THE Parser SHALL 在界面中显示文件名和基本信息
7. WHEN 文件导入界面加载 THEN THE System SHALL 显示解析规则选择器
8. THE System SHALL 在规则选择器中显示所有可用的解析规则
9. THE System SHALL 默认选中标记为默认的解析规则
10. WHEN 用户点击解析按钮 THEN THE Parser SHALL 使用用户选中的规则进行解析
11. WHEN 用户未选择规则 THEN THE Parser SHALL 使用默认规则进行解析

### Requirement 2: 题号层级提取

**User Story:** As a 教师/编辑人员, I want to 提取试卷的题号层级结构, so that 我可以了解试卷的组织结构。

#### Acceptance Criteria

1. THE Structure_Extractor SHALL 识别一级题号（阿拉伯数字如 "1、2、3" 或中文数字如 "一、二、三"）
2. THE Structure_Extractor SHALL 识别二级题号（如 "1."、"(1)"、"①" 等）
3. THE Structure_Extractor SHALL 识别三级题号（如 "(1)"、"①"、"a." 等带括号的编号）
4. WHEN 题号格式为阿拉伯数字一级、中文数字二级 THEN THE Structure_Extractor SHALL 正确识别层级关系
5. WHEN 题号格式为中文数字一级、阿拉伯数字二级、带括号三级 THEN THE Structure_Extractor SHALL 正确识别层级关系
6. THE Structure_Extractor SHALL 支持连续排序和重新排序两种编号模式
7. WHEN 解析完成 THEN THE Structure_Extractor SHALL 以树形结构展示题号层级

### Requirement 3: 分数提取

**User Story:** As a 教师/编辑人员, I want to 提取试卷中各题的分数, so that 我可以了解分值分布。

#### Acceptance Criteria

1. THE Structure_Extractor SHALL 识别括号格式的分数如 "(3分)"、"（5分）"、"【10分】"
2. THE Structure_Extractor SHALL 识别 "共X分" 格式的分数
3. WHEN 大题有分数标注 THEN THE Structure_Extractor SHALL 提取大题分数
4. WHEN 小题有分数标注 THEN THE Structure_Extractor SHALL 提取小题分数
5. WHEN 题目没有分数标注 THEN THE Structure_Extractor SHALL 只提取题号不显示分数
6. THE Structure_Extractor SHALL 只提取分数不进行汇总计算

### Requirement 4: 括号提取

**User Story:** As a 教师/编辑人员, I want to 提取试卷中的括号位置, so that 我可以识别填空题和选择题的答案位置。

#### Acceptance Criteria

1. THE Structure_Extractor SHALL 识别中文括号（）
2. THE Structure_Extractor SHALL 识别小括号 ()
3. THE Structure_Extractor SHALL 识别中括号 []
4. THE Structure_Extractor SHALL 识别大括号 {}
5. THE Structure_Extractor SHALL 识别方括号【】
6. WHEN 括号内包含分数 THEN THE Structure_Extractor SHALL 提取分数信息
7. WHEN 括号内包含其他内容 THEN THE Structure_Extractor SHALL 只标记括号位置不提取内容

### Requirement 5: 下划线提取

**User Story:** As a 教师/编辑人员, I want to 提取试卷中的下划线, so that 我可以识别填空题的空白位置。

#### Acceptance Criteria

1. THE Structure_Extractor SHALL 识别连续的下划线字符 "______"
2. THE Structure_Extractor SHALL 识别中文下划线和英文下划线
3. THE Structure_Extractor SHALL 识别不同长度的下划线（长下划线、短下划线）
4. WHEN 下划线被识别 THEN THE Structure_Extractor SHALL 记录下划线的位置和长度

### Requirement 6: 页眉页脚提取

**User Story:** As a 教师/编辑人员, I want to 提取文档的页眉页脚, so that 我可以获取试卷的标题和页码信息。

#### Acceptance Criteria

1. WHEN 解析 Word 文档 THEN THE Parser SHALL 提取页眉内容
2. WHEN 解析 Word 文档 THEN THE Parser SHALL 提取页脚内容
3. WHEN 解析 PDF 文档 THEN THE Parser SHALL 尝试识别页眉页脚区域
4. THE Parser SHALL 在结果中单独展示页眉页脚信息

### Requirement 7: 文档裁剪

**User Story:** As a 教师/编辑人员, I want to 裁剪文档边距, so that 我可以调整试卷的打印布局。

#### Acceptance Criteria

1. THE Cropper SHALL 允许用户设置上、下、左、右四个方向的边距
2. THE Cropper SHALL 支持毫米(mm)作为边距单位
3. WHEN 用户设置边距后 THEN THE Cropper SHALL 预览裁剪效果（可选功能）
4. THE Cropper SHALL 输出裁剪后的 PDF 或 Word 文档
5. WHEN 裁剪处理完成 THEN THE Cropper SHALL 保持原文档的分辨率不降低
6. WHEN 裁剪处理完成 THEN THE Cropper SHALL 保持原文档的排版、字体、大小不变

### Requirement 8: 批量处理

**User Story:** As a 教师/编辑人员, I want to 批量处理多个文档, so that 我可以提高工作效率。

#### Acceptance Criteria

1. THE Batch_Processor SHALL 支持同时处理 2-3 个文档
2. THE Batch_Processor SHALL 显示每个文档的处理进度
3. WHEN 某个文档处理失败 THEN THE Batch_Processor SHALL 标记错误并提供重试选项
4. THE Batch_Processor SHALL 将处理结果保存到指定文件夹
5. THE Batch_Processor SHALL 支持后台处理，不阻塞用户界面

### Requirement 9: 识别规则管理与应用

**User Story:** As a 教师/编辑人员, I want to 管理和选择识别规则, so that 我可以针对不同类型试卷使用合适的规则提高识别准确率。

#### Acceptance Criteria

1. THE Rule_Engine SHALL 支持创建自定义识别规则
2. THE Rule_Engine SHALL 支持设置题号格式规则
3. THE Rule_Engine SHALL 支持设置分数格式规则
4. THE Rule_Engine SHALL 支持设置括号和下划线识别规则
5. THE Rule_Engine SHALL 将规则保存到本地数据库
6. WHEN 用户选择规则 THEN THE Parser SHALL 按照选定规则进行解析
7. THE Rule_Engine SHALL 支持规则的导入和导出
8. THE Rule_Engine SHALL 支持设置默认规则
9. WHEN 用户在文件导入界面选择规则 THEN THE System SHALL 记住该选择用于后续解析
10. THE System SHALL 在文件列表中显示每个文件使用的解析规则
11. WHEN 批量处理文件 THEN THE Batch_Processor SHALL 使用用户选定的规则解析所有文件

### Requirement 10: 结果展示与存储

**User Story:** As a 教师/编辑人员, I want to 查看和保存解析结果, so that 我可以使用提取的数据。

#### Acceptance Criteria

1. THE System SHALL 在界面中以树形结构展示解析结果
2. THE System SHALL 显示题号、分数、括号位置、下划线位置
3. THE System SHALL 将解析结果存储到本地数据库
4. THE System SHALL 支持导出解析结果为 JSON 格式
5. WHEN 用户查看历史记录 THEN THE System SHALL 显示之前处理过的文档列表

### Requirement 11: 准确率保证

**User Story:** As a 客户, I want to 系统达到98-100%的识别准确率, so that 我可以信赖解析结果。

#### Acceptance Criteria

1. THE System SHALL 对300份测试试卷达到98%以上的识别准确率
2. WHEN 出现相似结构的文档 THEN THE System SHALL 保证识别提取准确
3. THE System SHALL 通过规则学习提高识别准确率
