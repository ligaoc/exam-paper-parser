# Implementation Plan: PDF Enhanced Parser

## Overview

增强 PDF 解析服务，使其能够提取字号样式信息并复用现有的结构提取服务。实现分为核心解析增强、图片提取、表格检测和集成四个阶段。

## Tasks

- [x] 1. 核心解析增强 - 提取带样式的段落
  - [x] 1.1 添加 pdfjs-dist 依赖并配置
    - 在 electron-app 目录安装 pdfjs-dist
    - 配置 Node.js 环境下的 PDF.js 使用方式
    - _Requirements: 1.1_

  - [x] 1.2 实现 extractTextItemsWithStyles 函数
    - 使用 pdfjs-dist 解析 PDF 获取每页的 textContent
    - 提取每个文本项的 str、height、width、transform、fontName
    - 返回包含页码信息的文本项数组
    - _Requirements: 1.1_

  - [x] 1.3 实现 mergeTextItemsToParagraphs 函数
    - 按 Y 坐标分组（容差范围内视为同一行）
    - 同一行内按 X 坐标排序并合并文本
    - 计算段落字号（取该行最大字号）
    - 检测粗体（基于字体名称包含 Bold/Black）
    - 构建 sortKey = (isBold ? 1000 : 0) + fontSize
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 6.3_

  - [ ]* 1.4 编写文本合并属性测试
    - **Property 1: 文本项合并保持内容完整性**
    - **Validates: Requirements 1.2, 6.3**

  - [ ]* 1.5 编写字号提取属性测试
    - **Property 2: 字号提取正确性**
    - **Validates: Requirements 1.4**

- [x] 2. Checkpoint - 验证核心解析功能
  - 确保文本项提取和合并逻辑正确
  - 运行单元测试验证基本功能
  - 如有问题请询问用户

- [x] 3. 图片提取功能
  - [x] 3.1 实现 extractImages 函数
    - 遍历每页的操作符列表（getOperatorList）
    - 识别图片操作符（OPS.paintImageXObject）
    - 提取图片数据并转换为 base64
    - 返回图片数组（包含 id、pageNumber、mimeType、base64、dataUrl）
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.2 编写图片数据格式属性测试
    - **Property 6: 图片数据格式正确性**
    - **Validates: Requirements 3.2**

- [x] 4. 表格检测功能
  - [x] 4.1 实现 detectTables 函数
    - 分析文本项的 Y 坐标分布，识别行边界
    - 分析文本项的 X 坐标分布，识别列边界
    - 将文本项分配到对应的单元格
    - 构建与 DOCX 兼容的表格数据结构
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.2 编写表格检测属性测试
    - **Property 5: 表格行列分组正确性**
    - **Validates: Requirements 4.2**

- [x] 5. 整合到 parse 函数
  - [x] 5.1 修改 parse 函数返回结构
    - 保留现有的 text、pages、metadata 属性
    - 新增 styledParagraphs、images、tables、contentBlocks 属性
    - 确保向后兼容
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.2 编写返回结构属性测试
    - **Property 3: 返回数据结构完整性**
    - **Validates: Requirements 1.3, 5.1, 5.2**

- [x] 6. Checkpoint - 验证 PDF 解析服务
  - 使用实际 PDF 文件测试完整解析流程
  - 验证 styledParagraphs 格式正确
  - 如有问题请询问用户

- [x] 7. 集成到 IPC Handler
  - [x] 7.1 修改 file:parse handler 的 PDF 分支
    - 获取 PDF 解析结果中的 styledParagraphs
    - 当 styledParagraphs 存在时，使用 extractWithStyles 进行智能识别
    - 将 images 和 tables 添加到解析结果
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 7.2 编写数据格式兼容性属性测试
    - **Property 4: 数据格式兼容性**
    - **Validates: Requirements 2.1, 2.2, 4.3**

- [x] 8. 特殊格式处理优化
  - [x] 8.1 优化化学式和上下标处理
    - 检测上下标文本项（基于 Y 坐标偏移和字号差异）
    - 合并时保留相对位置关系
    - 处理特殊字符编码
    - _Requirements: 6.1, 6.2_

- [x] 9. Final Checkpoint - 完整功能验证
  - 使用实际试卷 PDF 进行端到端测试
  - 验证题目识别准确性
  - 验证与 DOCX 解析结果的一致性
  - 确保所有测试通过，如有问题请询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 核心功能是 styledParagraphs 的提取，这是复用 extractWithStyles 的关键
- 表格检测是 PDF 特有的挑战，可能需要多次迭代优化
- 图片提取依赖 pdfjs-dist 的底层 API，需要处理各种图片格式
