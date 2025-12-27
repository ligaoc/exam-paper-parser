# Requirements Document

## Introduction

本功能为试卷解析系统添加"忽略解析文本"功能。用户可以在规则配置中定义一组文本模式，当解析到包含这些模式的文本时，系统将跳过该文本，不将其识别为题目。这可以有效过滤掉试卷中的说明性文字（如"试题的答案书写在答题卡上，不得在试题卷上直接作答"），防止这些文本被错误识别为题号，导致题目结构混乱。

## Glossary

- **Ignore_Pattern**: 忽略模式，用于匹配需要跳过的文本的正则表达式或关键词
- **Rule_Engine**: 规则引擎服务，管理识别规则的创建、更新、删除
- **Structure_Extractor**: 结构提取服务，从文档中提取题号、分数等结构化信息
- **Rule_Manager**: 规则管理组件，用户界面中用于配置规则的 Vue 组件
- **Paragraph**: 段落，文档中的一个文本单元

## Requirements

### Requirement 1: 忽略模式配置

**User Story:** As a 用户, I want to 在规则中配置忽略解析的文本模式, so that 我可以定义哪些文本不应该被识别为题目。

#### Acceptance Criteria

1. WHEN 用户打开规则编辑对话框 THEN THE Rule_Manager SHALL 显示"忽略解析文本"配置区域
2. WHEN 用户添加忽略模式 THEN THE Rule_Manager SHALL 允许输入正则表达式或关键词
3. WHEN 用户保存规则 THEN THE Rule_Engine SHALL 将忽略模式保存到规则数据中
4. WHEN 用户编辑已有规则 THEN THE Rule_Manager SHALL 正确加载并显示已配置的忽略模式
5. WHEN 用户删除某个忽略模式 THEN THE Rule_Manager SHALL 从配置中移除该模式

### Requirement 2: 文本过滤逻辑

**User Story:** As a 系统, I want to 在解析时过滤掉匹配忽略模式的文本, so that 这些文本不会被识别为题目。

#### Acceptance Criteria

1. WHEN 解析文档时遇到匹配忽略模式的段落 THEN THE Structure_Extractor SHALL 跳过该段落的题号识别
2. WHEN 段落文本包含任一忽略模式的关键词 THEN THE Structure_Extractor SHALL 将该段落标记为已忽略
3. WHEN 段落被忽略 THEN THE Structure_Extractor SHALL 不将其计入题目数量统计
4. WHEN 没有配置忽略模式 THEN THE Structure_Extractor SHALL 正常解析所有段落

### Requirement 3: 忽略模式验证

**User Story:** As a 用户, I want to 在保存前验证忽略模式的有效性, so that 无效的正则表达式不会导致解析错误。

#### Acceptance Criteria

1. WHEN 用户输入无效的正则表达式 THEN THE Rule_Manager SHALL 显示错误提示
2. WHEN 用户尝试保存包含无效模式的规则 THEN THE Rule_Engine SHALL 过滤掉无效模式并给出警告
3. WHEN 验证模式时 THEN THE Rule_Engine SHALL 尝试编译正则表达式以检测语法错误

### Requirement 4: 预设忽略模式

**User Story:** As a 用户, I want to 快速选择常用的忽略模式, so that 我不需要手动输入常见的说明性文字。

#### Acceptance Criteria

1. WHEN 用户点击添加忽略模式 THEN THE Rule_Manager SHALL 提供预设模式选项
2. THE Rule_Manager SHALL 包含以下预设模式：
   - 答题卡相关说明（如"答案书写在答题卡上"）
   - 注意事项提示（如"注意事项"、"作答前认真阅读"）
   - 考试说明（如"考试结束"、"监考人员"）
3. WHEN 用户选择预设模式 THEN THE Rule_Manager SHALL 将其添加到忽略模式列表

### Requirement 5: 忽略结果反馈

**User Story:** As a 用户, I want to 查看哪些文本被忽略了, so that 我可以验证忽略模式是否正确工作。

#### Acceptance Criteria

1. WHEN 解析完成后 THEN THE Structure_Extractor SHALL 返回被忽略的段落列表
2. WHEN 显示解析结果 THEN THE Result_View SHALL 可选择性地显示被忽略的文本
3. WHEN 被忽略的文本数量大于0 THEN THE Result_View SHALL 显示忽略统计信息
