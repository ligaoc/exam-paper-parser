# Implementation Plan: 分数模式按级别配置

## Overview

本实现计划将分数模式从全局配置改为与题号级别关联的配置，涉及数据结构变更、后端服务改动、前端组件更新三个主要部分。

## Tasks

- [x] 1. 更新规则引擎服务数据结构
  - [x] 1.1 修改 ruleEngineService.js 添加新的迁移函数 `migrateToLevelScorePatterns`
    - 检测是否已是新格式（levels[0].scorePatterns !== undefined）
    - 将旧的全局 score 模式复制到每个级别的 scorePatterns
    - 移除全局 score 字段
    - _Requirements: 5.1, 5.3_
  - [x] 1.2 修改 `validateLevelsArray` 为 `validateLevelsArrayWithScore`
    - 验证每个级别包含 patterns 和 scorePatterns 数组
    - 默认值包含空的 scorePatterns
    - _Requirements: 1.2_
  - [x] 1.3 修改 `validatePatterns` 函数调用新的迁移和验证逻辑
    - 先调用旧的 migratePatterns，再调用 migrateToLevelScorePatterns
    - 使用 validateLevelsArrayWithScore 验证级别
    - 移除对全局 score 的验证
    - _Requirements: 5.1, 5.2_
  - [x] 1.4 修改 `getDefaultPatterns` 返回新格式
    - 每个默认级别包含空的 scorePatterns
    - 不再包含全局 score 字段
    - _Requirements: 1.2_
  - [ ]* 1.5 编写属性测试：数据格式迁移往返一致性
    - **Property 6: 数据格式迁移往返一致性**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 2. 更新结构提取服务
  - [x] 2.1 添加 `extractScoreByLevel` 函数
    - 接收文本和该级别的 scorePatterns 数组
    - 如果 scorePatterns 为空，返回 null
    - 按顺序尝试匹配，返回第一个匹配的分数
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 修改 `extractWithStyles` 函数使用级别分数模式
    - 获取规则中的 levels 配置
    - 在创建 question 对象时调用 extractScoreByLevel
    - 传入对应级别的 scorePatterns
    - _Requirements: 2.1_
  - [ ]* 2.3 编写属性测试：分数提取使用正确级别模式
    - **Property 2: 分数提取使用正确级别模式**
    - **Validates: Requirements 2.1**
  - [ ]* 2.4 编写属性测试：空分数模式返回 null
    - **Property 3: 空分数模式返回 null**
    - **Validates: Requirements 2.2**
  - [ ]* 2.5 编写属性测试：多模式匹配优先级
    - **Property 4: 多模式匹配优先级**
    - **Validates: Requirements 2.3**

- [x] 3. Checkpoint - 确保后端服务测试通过
  - 运行所有后端测试，确保通过
  - 如有问题，询问用户

- [x] 4. 更新规则管理组件
  - [x] 4.1 修改 RuleManager.vue 级别配置区域
    - 在每个级别的 level-item 内添加分数模式配置区域
    - 使用 PatternSelector 组件，category="score"
    - 绑定到 level.scorePatterns
    - _Requirements: 1.1, 1.4_
  - [x] 4.2 修改 `addLevel` 函数
    - 创建新级别时初始化 scorePatterns: []
    - _Requirements: 1.2_
  - [x] 4.3 修改 `resetCurrentRule` 函数
    - 默认级别包含空的 scorePatterns
    - _Requirements: 1.2_
  - [x] 4.4 修改 `migratePatterns` 函数（前端版本）
    - 与后端保持一致的迁移逻辑
    - _Requirements: 5.1_
  - [x] 4.5 移除全局分数模式配置
    - 从 el-collapse 中移除分数模式的 collapse-item
    - _Requirements: 1.1_
  - [ ]* 4.6 编写属性测试：级别操作数据完整性
    - **Property 1: 级别操作数据完整性**
    - **Validates: Requirements 1.2, 1.3**

- [x] 5. 更新结果视图组件
  - [x] 5.1 添加 `levelStats` 计算属性
    - 遍历题目结构，按 level 分组统计
    - 计算每个级别的 totalCount、withScoreCount、totalScore
    - _Requirements: 3.2_
  - [x] 5.2 修改分数统计面板模板
    - 保留原有总体统计
    - 新增按级别统计表格
    - _Requirements: 3.1, 3.3_
  - [x] 5.3 修改分数详情为树形结构
    - 使用 el-tree 替代 el-table
    - 复用 treeData 数据
    - 显示题号、内容、分数、级别
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 5.4 编写属性测试：级别统计计算正确性
    - **Property 5: 级别统计计算正确性**
    - **Validates: Requirements 3.2**

- [x] 6. Final Checkpoint - 确保所有测试通过
  - 运行所有测试，确保通过
  - 如有问题，询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
