# Implementation Plan: 忽略解析文本功能

## Overview

本实现计划将"忽略解析文本"功能分解为可执行的编码任务。按照数据层 → 服务层 → UI 层的顺序实现，确保每个步骤都可以独立验证。

## Tasks

- [x] 1. 扩展规则引擎服务
  - [x] 1.1 添加忽略模式验证函数
    - 在 `ruleEngineService.js` 中添加 `validateIgnorePatterns` 函数
    - 验证正则表达式语法有效性
    - 过滤空字符串和无效模式
    - _Requirements: 3.2, 3.3_

  - [ ]* 1.2 编写忽略模式验证的属性测试
    - **Property 3: 无效正则过滤**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 1.3 扩展 validatePatterns 函数
    - 在现有 `validatePatterns` 函数中集成 `ignorePatterns` 验证
    - 确保旧规则数据兼容（无 ignorePatterns 字段时默认为空数组）
    - _Requirements: 1.3_

- [x] 2. 扩展结构提取服务
  - [x] 2.1 添加段落忽略检测函数
    - 在 `structureExtractorService.js` 中添加 `shouldIgnoreParagraph` 函数
    - 支持正则匹配和关键词匹配两种模式
    - 返回 `{ ignored: boolean, matchedPattern: string|null }`
    - _Requirements: 2.1, 2.2_

  - [ ]* 2.2 编写段落忽略检测的属性测试
    - **Property 1: 忽略模式过滤正确性**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 2.3 添加段落过滤函数
    - 添加 `filterParagraphs` 函数
    - 返回 `{ filtered: Array, ignored: Array }`
    - _Requirements: 2.3_

  - [x] 2.4 修改 extractWithStyles 函数
    - 在解析前调用 `filterParagraphs` 过滤段落
    - 在返回结果中添加 `ignoredParagraphs` 字段
    - _Requirements: 2.1, 5.1_

  - [ ]* 2.5 编写解析结果完整性的属性测试
    - **Property 4: 解析结果包含忽略信息**
    - **Validates: Requirements 5.1**

- [x] 3. Checkpoint - 确保后端服务测试通过
  - 运行所有单元测试和属性测试
  - 如有问题请询问用户

- [x] 4. 添加预设忽略模式
  - [x] 4.1 创建预设模式数据
    - 在 `patternPresets.js` 中添加 `PRESET_IGNORE_PATTERNS` 常量
    - 包含答题卡说明、注意事项、考试说明等常用模式
    - _Requirements: 4.2_

- [x] 5. 扩展规则管理 UI
  - [x] 5.1 添加忽略模式配置区域
    - 在 `RuleManager.vue` 的编辑对话框中添加"忽略解析文本"配置区域
    - 使用 el-collapse-item 包裹，与其他模式配置保持一致
    - _Requirements: 1.1_

  - [x] 5.2 实现忽略模式的增删改功能
    - 添加 `addIgnorePattern`、`removeIgnorePattern` 方法
    - 支持输入正则表达式或关键词
    - 支持选择预设模式
    - _Requirements: 1.2, 1.5, 4.1, 4.3_

  - [x] 5.3 添加模式验证和错误提示
    - 输入时实时验证正则表达式语法
    - 无效模式显示红色边框和错误提示
    - _Requirements: 3.1_

  - [x] 5.4 确保规则加载时正确显示忽略模式
    - 在 `editRule` 方法中处理 `ignorePatterns` 字段
    - 兼容旧规则（无该字段时初始化为空数组）
    - _Requirements: 1.4_

- [x] 6. 扩展结果显示
  - [x] 6.1 在 ResultView 中显示忽略统计
    - 添加"已忽略段落"统计信息
    - 可展开查看被忽略的具体文本
    - _Requirements: 5.2, 5.3_

- [x] 7. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 手动测试 UI 功能
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选测试任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求条款以便追溯
- 建议按顺序执行，确保依赖关系正确
