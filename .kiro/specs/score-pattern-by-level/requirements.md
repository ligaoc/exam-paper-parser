# Requirements Document

## Introduction

本功能改进规则管理系统中的分数模式配置，将分数模式与题号级别关联，使每个题号级别可以配置独立的分数提取规则。同时改进分数统计功能，按题号级别分类统计，并使分数详情列表与题目结构保持一致的层级展示。

## Glossary

- **Rule_Manager**: 规则管理组件，用于创建、编辑、删除识别规则
- **Pattern_Selector**: 模式选择器组件，用于选择和配置正则表达式模式
- **Score_Pattern**: 分数模式，用于从文本中提取分数的正则表达式
- **Question_Level**: 题号级别，如一级题号、二级题号、三级题号
- **Structure_Extractor**: 结构提取服务，从文档中提取题目结构和分数
- **Result_View**: 结果视图组件，展示解析结果和分数统计

## Requirements

### Requirement 1: 分数模式与题号级别关联

**User Story:** 作为用户，我希望为每个题号级别配置独立的分数提取规则，以便准确提取不同级别题目的分数。

#### Acceptance Criteria

1. WHEN 用户编辑规则时，THE Rule_Manager SHALL 在每个题号级别配置区域内显示该级别的分数模式配置
2. WHEN 用户添加新的题号级别时，THE Rule_Manager SHALL 自动为该级别创建空的分数模式配置
3. WHEN 用户删除题号级别时，THE Rule_Manager SHALL 同时删除该级别关联的分数模式配置
4. THE Pattern_Selector SHALL 支持在题号级别内配置分数模式，与全局分数模式配置使用相同的交互方式

### Requirement 2: 分数提取按级别应用规则

**User Story:** 作为用户，我希望系统在提取分数时使用对应级别的分数规则，以便准确识别不同格式的分数。

#### Acceptance Criteria

1. WHEN 提取题目分数时，THE Structure_Extractor SHALL 使用该题目所属级别配置的分数模式
2. IF 某级别未配置分数模式，THEN THE Structure_Extractor SHALL 跳过该级别题目的分数提取
3. WHEN 同一题目匹配多个分数模式时，THE Structure_Extractor SHALL 使用第一个匹配的结果

### Requirement 3: 分数统计按级别分类

**User Story:** 作为用户，我希望分数统计按题号级别分类显示，以便清晰了解各级别题目的分数分布。

#### Acceptance Criteria

1. THE Result_View SHALL 在分数统计面板中按题号级别分组显示统计信息
2. WHEN 显示级别统计时，THE Result_View SHALL 显示每个级别的题目数量、有分数题目数量、分数总和
3. THE Result_View SHALL 保留原有的总体统计信息（总题数、总分数等）

### Requirement 4: 分数详情与题目结构一致

**User Story:** 作为用户，我希望分数详情列表与题目结构保持一致的层级展示，以便直观对照题目和分数。

#### Acceptance Criteria

1. THE Result_View SHALL 在分数详情中使用树形结构展示题目和分数
2. WHEN 展示分数详情时，THE Result_View SHALL 显示题号、内容摘要、分数、所属级别
3. THE Result_View SHALL 支持展开/折叠子级别题目

### Requirement 5: 规则数据结构兼容

**User Story:** 作为用户，我希望系统能兼容旧版规则数据，以便平滑升级。

#### Acceptance Criteria

1. WHEN 加载旧版规则数据时，THE Rule_Engine SHALL 自动迁移全局分数模式到各级别
2. WHEN 导出规则时，THE Rule_Engine SHALL 使用新的数据结构格式
3. WHEN 导入旧版规则时，THE Rule_Engine SHALL 自动转换为新格式
