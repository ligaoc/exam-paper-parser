# Implementation Plan: 试卷文档解析系统

## Overview

基于现有 `electron-app` 项目（Electron + Vue 3）实现试卷文档解析系统。所有代码在 `electron-app/` 目录下开发，依赖管理通过修改 `package.json` 后运行 `scripts/init.bat` 完成。

## Tasks

- [x] 1. 项目基础设施搭建
  - [x] 1.1 安装文档解析依赖
    - 修改 `electron-app/package.json`，在 dependencies 中添加：mammoth、pdf-parse
    - 使用 sql.js 替代 better-sqlite3（纯 JS 实现，无需编译 native 模块）
    - 运行 `scripts/init.bat` 安装依赖
    - 更新 `electron-app/electron-builder.json`，在 files 中添加 sql.js 的 wasm 文件
    - _Requirements: 1.2, 1.4_
  - [x] 1.2 创建数据库服务
    - 创建 `electron-app/src/main/services/databaseService.js`
    - 实现 SQLite 数据库初始化和表创建
    - 实现基础 CRUD 操作
    - _Requirements: 10.3_
  - [x] 1.3 创建 IPC 通信框架
    - 更新 `electron-app/src/main/ipcHandlers.js` 添加文档解析相关通道
    - 更新 `electron-app/src/main/preload.js` 暴露 API 给渲染进程
    - _Requirements: 1.1_

- [x] 2. 文档解析核心服务
  - [x] 2.1 实现 Word 文档解析服务
    - 创建 `electron-app/src/main/services/docxParserService.js`
    - 使用 mammoth 提取文本内容
    - 提取页眉页脚信息
    - _Requirements: 1.2, 1.3, 6.1, 6.2_
  - [x] 2.2 实现 PDF 文档解析服务
    - 创建 `electron-app/src/main/services/pdfParserService.js`
    - 使用 pdf-parse 提取文本内容
    - _Requirements: 1.4, 6.3_
  - [ ]* 2.3 编写文件类型验证属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 1: 文件类型验证**
    - **Validates: Requirements 1.1, 1.5**

- [x] 3. 结构提取服务
  - [x] 3.1 实现题号识别模块
    - 创建 `electron-app/src/main/services/structureExtractorService.js`
    - 实现一级题号识别（阿拉伯数字、中文数字）
    - 实现二级题号识别
    - 实现三级题号识别
    - 构建题目树形结构
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ]* 3.2 编写题号识别属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 2: 多级题号识别完整性**
    - **Property 3: 题号层级关系正确性**
    - **Validates: Requirements 2.1-2.6**
  - [x] 3.3 实现分数提取模块
    - 在 structureExtractorService 中添加分数识别
    - 支持多种分数格式：(3分)、（共10分）、【5分】
    - 将分数关联到对应题目
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 3.4 编写分数提取属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 4: 分数提取准确性**
    - **Property 5: 无分数题目处理**
    - **Validates: Requirements 3.1-3.5**
  - [x] 3.5 实现括号识别模块
    - 识别中文括号、小括号、中括号、大括号、方括号
    - 提取括号内的分数信息
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [ ]* 3.6 编写括号识别属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 6: 括号识别完整性**
    - **Property 7: 括号内分数提取**
    - **Validates: Requirements 4.1-4.7**
  - [x] 3.7 实现下划线识别模块
    - 识别连续下划线字符
    - 记录位置和长度
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 3.8 编写下划线识别属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 8: 下划线识别完整性**
    - **Validates: Requirements 5.1-5.4**

- [x] 4. Checkpoint - 核心解析功能验证
  - 确保所有测试通过，ask the user if questions arise.

- [x] 5. 前端界面开发
  - [x] 5.1 创建文件导入组件
    - 创建 `electron-app/src/renderer/components/FileImport.vue`
    - 支持拖拽和点击选择文件
    - 显示文件列表和状态
    - _Requirements: 1.1, 1.6_
  - [x] 5.1.1 添加规则选择功能
    - 在文件导入组件中添加规则选择下拉框
    - 组件加载时获取规则列表并选中默认规则
    - 解析时传递选中的规则ID
    - 文件列表中显示使用的规则名称
    - _Requirements: 1.7, 1.8, 1.9, 1.10, 1.11, 9.6, 9.9, 9.10_
  - [x] 5.2 创建解析结果展示组件
    - 创建 `electron-app/src/renderer/components/ResultView.vue`
    - 以树形结构展示题目层级
    - 显示分数、括号、下划线信息
    - _Requirements: 2.7, 10.1, 10.2_
  - [x] 5.3 创建主页面布局
    - 更新 `electron-app/src/renderer/App.vue`
    - 集成文件导入和结果展示组件
    - 添加导航和操作按钮
    - _Requirements: 1.6, 10.1_
  - [x] 5.4 实现文件解析流程
    - 连接前端组件和后端服务
    - 实现文件选择 -> 解析 -> 展示结果的完整流程
    - _Requirements: 1.1, 1.6, 10.1, 10.2_

- [x] 6. 规则引擎开发
  - [x] 6.1 实现规则引擎服务
    - 创建 `electron-app/src/main/services/ruleEngineService.js`
    - 实现规则 CRUD 操作
    - 实现默认规则
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 6.1.1 添加获取默认规则 IPC 接口
    - 在 ipcHandlers.js 中添加 rule:getDefault 处理器
    - 在 preload.js 中暴露 getDefaultRule API
    - _Requirements: 9.8_
  - [ ]* 6.2 编写规则引擎属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 11: 规则应用一致性**
    - **Property 12: 规则导入导出 Round-Trip**
    - **Validates: Requirements 9.1-9.7**
  - [x] 6.3 创建规则管理界面
    - 创建 `electron-app/src/renderer/components/RuleManager.vue`
    - 支持创建、编辑、删除规则
    - 支持导入导出规则
    - _Requirements: 9.1, 9.6, 9.7_

- [x] 7. Checkpoint - 规则功能验证
  - 确保所有测试通过，ask the user if questions arise.

- [x] 8. 批量处理功能
  - [x] 8.1 实现批量处理服务
    - 创建 `electron-app/src/main/services/batchProcessorService.js`
    - 实现并发控制（最多3个）
    - 实现进度跟踪和错误处理
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 8.1.1 批量处理支持规则选择
    - 批量处理时使用用户选定的规则
    - 在批量面板中显示当前使用的规则
    - _Requirements: 9.11_
  - [ ]* 8.2 编写批量处理属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 10: 批量处理并发限制**
    - **Validates: Requirements 8.1**
  - [x] 8.3 创建批量处理界面
    - 创建 `electron-app/src/renderer/components/BatchPanel.vue`
    - 显示处理进度
    - 支持错误重试
    - _Requirements: 8.2, 8.3_

- [x] 9. 文档裁剪功能
  - [x] 9.1 实现裁剪服务
    - 创建 `electron-app/src/main/services/cropperService.js`
    - 实现边距设置和单位转换
    - 输出裁剪后的文档
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_
  - [ ]* 9.2 编写裁剪服务属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 9: 边距单位转换**
    - **Validates: Requirements 7.2**
  - [x] 9.3 创建裁剪设置界面
    - 创建 `electron-app/src/renderer/components/CropSettings.vue`
    - 支持设置四个方向的边距
    - 选择输出格式
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 10. 历史记录功能
  - [x] 10.1 实现历史记录服务
    - 在 databaseService 中添加历史记录相关方法
    - 支持查询和删除历史记录
    - _Requirements: 10.3, 10.5_
  - [x] 10.2 创建历史记录界面
    - 创建 `electron-app/src/renderer/components/HistoryList.vue`
    - 显示历史处理记录
    - 支持查看详情和删除
    - _Requirements: 10.5_
  - [x] 10.3 实现结果导出功能
    - 支持导出解析结果为 JSON
    - _Requirements: 10.4_
  - [ ]* 10.4 编写导出功能属性测试
    - 在 `electron-app/tests/property/` 目录下创建测试
    - **Property 13: 解析结果 JSON 导出 Round-Trip**
    - **Validates: Requirements 10.4**

- [x] 11. Final Checkpoint - 完整功能验证
  - 确保所有测试通过，ask the user if questions arise.

## Notes

- 所有代码在 `electron-app/` 目录下开发
- 依赖安装：修改 `electron-app/package.json` 后运行 `scripts/init.bat`
- 启动开发：运行 `scripts/start.bat`
- 打包应用：运行 `scripts/build.bat`
- 使用 sql.js 而非 better-sqlite3，避免 native 模块编译问题，确保打包顺利
- mammoth 和 pdf-parse 都是纯 JS 库，打包无问题
- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
