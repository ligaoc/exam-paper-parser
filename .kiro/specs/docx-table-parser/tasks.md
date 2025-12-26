# Implementation Plan: DOCX 表格解析优化

## Overview

本实现计划将增强 `docxParserService.js`，添加表格解析功能。采用直接解析 OOXML 的方式，从 DOCX 文件的 `word/document.xml` 中提取表格结构。

## Tasks

- [x] 1. 添加表格数据结构和辅助函数
  - [x] 1.1 在 docxParserService.js 中定义 Table、Row、Cell 数据结构
    - 创建 createTable、createRow、createCell 工厂函数
    - 使用 uuid 生成表格唯一标识符
    - _Requirements: 4.3, 5.1, 5.2_

  - [ ]* 1.2 编写属性测试：表格 ID 唯一性
    - **Property 5: 表格 ID 唯一性**
    - **Validates: Requirements 4.3**

- [x] 2. 实现 XML 解析核心功能
  - [x] 2.1 实现 parseTableXml 函数解析单个表格
    - 解析 `<w:tbl>` 元素
    - 提取 `<w:tblGrid>` 获取列数
    - 遍历 `<w:tr>` 提取行
    - 遍历 `<w:tc>` 提取单元格
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 实现单元格文本提取
    - 解析 `<w:t>` 标签获取文本
    - 保留多段落分隔（`<w:p>` 之间添加换行）
    - _Requirements: 3.1, 3.3_

  - [ ]* 2.3 编写属性测试：表格结构完整性
    - **Property 1: 表格结构完整性**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 3. 实现合并单元格处理
  - [x] 3.1 实现水平合并单元格解析
    - 解析 `<w:gridSpan w:val="N"/>` 获取 colspan
    - _Requirements: 2.1_

  - [x] 3.2 实现垂直合并单元格解析
    - 解析 `<w:vMerge w:val="restart"/>` 标记合并起始
    - 解析 `<w:vMerge/>` 标记被合并单元格
    - 计算 rowspan 值
    - 标记 isMerged 属性
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ]* 3.3 编写属性测试：合并单元格跨度正确性
    - **Property 2: 合并单元格跨度正确性**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 3.4 编写属性测试：合并单元格内容位置
    - **Property 3: 合并单元格内容位置**
    - **Validates: Requirements 2.3, 2.4**

- [x] 4. 实现表格提取主函数
  - [x] 4.1 实现 extractTables 函数
    - 使用 adm-zip 读取 word/document.xml
    - 查找所有 `<w:tbl>` 元素
    - 调用 parseTableXml 解析每个表格
    - 记录表格位置索引
    - _Requirements: 1.1, 4.1_

  - [x] 4.2 实现表格 HTML 生成
    - 将 Table 对象转换为 HTML `<table>` 字符串
    - 正确处理 rowspan 和 colspan 属性
    - _Requirements: 5.3_

- [x] 5. Checkpoint - 确保表格提取功能正常
  - 运行现有测试确保没有破坏原有功能
  - 使用真实试卷文档测试表格提取
  - 如有问题请询问用户

- [x] 6. 实现内容块构建
  - [x] 6.1 实现 buildContentBlocks 函数
    - 解析 document.xml 中的内容顺序
    - 识别段落 `<w:p>` 和表格 `<w:tbl>` 的交替出现
    - 构建有序的 ContentBlock 数组
    - _Requirements: 4.2_

  - [ ]* 6.2 编写属性测试：内容块顺序一致性
    - **Property 4: 内容块顺序一致性**
    - **Validates: Requirements 4.1, 4.2**

- [x] 7. 集成到现有解析流程
  - [x] 7.1 更新 parseDocx 函数
    - 调用 extractTables 获取表格
    - 调用 buildContentBlocks 获取内容块
    - 在返回结果中添加 tables 和 contentBlocks 字段
    - 保持原有字段不变
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 7.2 编写属性测试：API 向后兼容性
    - **Property 8: API 向后兼容性**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 8. 实现表头识别（可选增强）
  - [x] 8.1 实现表头行识别逻辑
    - 检查第一行是否包含表头样式
    - 检查 `<w:tblHeader/>` 标记
    - 设置 Row.isHeader 属性
    - _Requirements: 3.2_

- [x] 9. Final Checkpoint - 完整功能验证
  - 运行所有测试确保通过
  - 使用项目中的真实试卷文档验证表格解析效果
  - 确保解析结果与原文档表格结构一致
  - 如有问题请询问用户

- [x] 10. 修复表格内图片和内容重复问题
  - [x] 10.1 实现单元格图片提取
    - 在 extractCellText 基础上创建 extractCellContent 函数
    - 解析单元格内的 `<w:drawing>` 元素
    - 提取图片关系 ID 并获取图片数据
    - 在 Cell 对象中添加 images 数组
    - _Requirements: 3.4, 3.5, 5.2_

  - [x] 10.2 更新 createCell 工厂函数
    - 添加 images 属性支持
    - _Requirements: 5.2_

  - [x] 10.3 更新 generateTableHtml 函数
    - 在单元格 HTML 中渲染图片
    - 使用 img 标签和 data URL
    - _Requirements: 3.6, 5.5_

  - [x] 10.4 修复 buildContentBlocks 内容去重
    - 在提取图片前，先确定所有表格的位置范围
    - 跳过位于表格范围内的图片
    - 跳过位于表格范围内的段落
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 11. Checkpoint - 验证表格内图片功能
  - 使用包含表格图片的试卷文档测试
  - 确保图片正确显示在表格单元格内
  - 确保内容不重复

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 使用 fast-check 进行属性测试
- 测试文件放置在 `electron-app/tests/` 目录下
- 优先确保基础表格解析功能正常，合并单元格为进阶功能
