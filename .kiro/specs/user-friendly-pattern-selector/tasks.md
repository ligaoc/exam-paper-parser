# Implementation Plan: User-Friendly Pattern Selector

## Overview

将规则管理界面的正则表达式输入改为下拉选择方式，支持动态级别管理。

## Tasks

- [x] 1. 创建预设模式库
  - [x] 1.1 创建 patternPresets.js 文件
    - 在 `electron-app/src/renderer/utils/` 目录下创建
    - 定义 PatternPreset 数据结构
    - 实现题号模式预设（10种：中文数字、阿拉伯数字、圈数字、字母、罗马数字等）
    - 实现分数模式预设（3种）
    - 实现括号和下划线模式预设
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 5.1, 5.2_

  - [x] 1.2 实现预设查询函数
    - getQuestionPresets() - 获取题号模式预设
    - getScorePresets() - 获取分数模式预设
    - getBracketPresets() - 获取括号模式预设
    - getUnderlinePresets() - 获取下划线模式预设
    - findPresetByRegex(regex) - 根据正则查找预设
    - validateRegex(pattern) - 验证正则有效性
    - _Requirements: 2.2, 6.1, 6.2, 6.3, 7.3_

  - [ ]* 1.3 编写预设模块的属性测试
    - **Property 1: Preset Data Completeness**
    - **Property 2: Preset Regex Validity**
    - **Property 3: Regex-to-Preset Round Trip**
    - **Property 4: Unknown Regex Returns Null**
    - **Property 5: Regex Validation Function**
    - **Validates: Requirements 1.2-1.4, 2.2, 6.1-6.3, 7.3**

- [x] 2. Checkpoint - 确保预设模块测试通过
  - 运行所有测试，确保预设模块功能正确
  - 如有问题请询问用户

- [x] 3. 创建 PatternSelector 组件
  - [x] 3.1 创建 PatternSelector.vue 基础结构
    - 定义 props: modelValue (string[]), category (string), allowCustom (boolean)
    - 定义 emits: update:modelValue
    - 导入预设模块
    - _Requirements: 3.1_

  - [x] 3.2 实现下拉选择功能
    - 使用 el-select 显示预设选项
    - 选项显示 label 和 examples
    - 选择后添加正则到 modelValue
    - _Requirements: 3.2_

  - [x] 3.3 实现已选模式列表显示
    - 遍历 modelValue，使用 findPresetByRegex 查找预设
    - 预设模式显示友好标签和示例
    - 自定义模式显示"自定义: [正则]"
    - 每个模式有删除按钮
    - _Requirements: 3.3, 3.4, 3.5, 6.2, 6.3_

  - [x] 3.4 实现自定义模式输入
    - 添加"添加自定义模式"按钮
    - 点击后显示输入框
    - 使用 validateRegex 验证输入
    - 无效时显示错误提示
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 4. 更新 RuleManager 组件
  - [x] 4.1 更新数据结构支持动态级别
    - 将 patterns.level1/level2/level3 改为 patterns.levels 数组
    - 每个级别包含 name 和 patterns 字段
    - 更新 resetCurrentRule 函数
    - _Requirements: 4.1, 4.3_

  - [x] 4.2 实现级别添加/删除功能
    - 添加"添加级别"按钮
    - 每个级别有"删除"按钮（最后一个级别禁用）
    - 新级别自动命名（四级题号、五级题号...）
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 4.3 替换 PatternEditor 为 PatternSelector
    - 导入 PatternSelector 组件
    - 为每个级别使用 PatternSelector (category='question')
    - 为分数、括号、下划线使用对应 category
    - _Requirements: 3.1_

  - [ ]* 4.4 编写级别管理的属性测试
    - **Property 6: Level Management Constraints**
    - **Property 7: New Level Initialization**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 5. 更新规则引擎服务
  - [x] 5.1 添加数据迁移函数
    - 实现 migratePatterns(oldPatterns) 函数
    - 将旧格式 (level1/level2/level3) 转换为新格式 (levels 数组)
    - 在 getRule 和 getAllRules 中自动迁移
    - _Requirements: 6.4_

  - [x] 5.2 更新 validatePatterns 函数
    - 支持新的 levels 数组结构
    - 保持对旧格式的兼容
    - _Requirements: 6.4_

  - [x] 5.3 更新 getDefaultPatterns 函数
    - 返回新格式的默认模式配置
    - _Requirements: 4.3_

- [x] 6. Checkpoint - 功能集成测试
  - 确保所有测试通过
  - 验证新建规则、编辑规则、加载旧规则都正常工作
  - 如有问题请询问用户

- [x] 7. 清理
  - [x] 7.1 删除旧的 PatternEditor 组件
    - 确认 PatternEditor.vue 不再被使用
    - 删除该文件
    - _Requirements: N/A_

## Notes

- 任务标记 `*` 的为可选测试任务
- 数据迁移是关键，确保旧规则能正常加载
- 级别名称使用中文数字（一级、二级、三级、四级...）
