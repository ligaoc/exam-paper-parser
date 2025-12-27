# Implementation Plan: Crop Preview

## Overview

为文档裁剪模块添加实时预览功能，让用户在设置裁剪参数时能够直观看到裁剪效果。

## Tasks

- [x] 1. 扩展后端预览生成服务
  - [x] 1.1 在 cropperService.js 中添加 PDF 预览生成方法
    - 使用 pdf-lib 或 canvas 渲染 PDF 第一页为图像
    - 返回 base64 编码的图像数据和页面尺寸
    - _Requirements: 1.1, 4.1_
  - [x] 1.2 添加 DOCX 页面尺寸获取方法
    - 解析 DOCX 的 sectPr 节点获取页面尺寸
    - 返回宽度和高度（毫米）
    - _Requirements: 1.2, 4.1_
  - [x] 1.3 添加预览生成错误处理
    - 处理文件不存在、格式不支持、文件损坏等情况
    - 返回结构化错误信息
    - _Requirements: 1.3_

- [x] 2. 添加 IPC 接口
  - [x] 2.1 在 ipcHandlers.js 中注册预览生成处理器
    - 注册 'crop:generatePreview' 通道
    - _Requirements: 1.1, 1.2_
  - [x] 2.2 在 preload.js 中暴露预览 API
    - 添加 crop.generatePreview 方法
    - _Requirements: 1.1, 1.2_

- [x] 3. 创建预览组件
  - [x] 3.1 创建 CropPreview.vue 组件
    - 接收预览图像和裁剪设置作为 props
    - 使用 Canvas 渲染预览图和裁剪遮罩
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 3.2 实现裁剪遮罩绘制逻辑
    - 计算遮罩区域位置
    - 绘制半透明遮罩和边框
    - _Requirements: 2.1, 2.3_
  - [x] 3.3 实现尺寸信息显示
    - 显示原始页面尺寸
    - 显示裁剪后尺寸
    - 显示无效裁剪警告
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 3.4 编写裁剪尺寸计算的属性测试
    - **Property 4: Cropped Dimension Calculation**
    - **Validates: Requirements 4.2**
  - [ ]* 3.5 编写无效裁剪检测的属性测试
    - **Property 5: Invalid Crop Detection**
    - **Validates: Requirements 4.3**

- [x] 4. 集成预览组件到 CropSettings
  - [x] 4.1 修改 CropSettings.vue 布局
    - 添加预览区域
    - 调整边距设置和预览的布局
    - _Requirements: 5.1_
  - [x] 4.2 实现文件选择后加载预览
    - 选择文件后调用预览生成 API
    - 显示加载状态
    - _Requirements: 1.1, 1.2_
  - [x] 4.3 实现边距变化时实时更新预览
    - 监听边距设置变化
    - 实时更新裁剪遮罩
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 4.4 编写宽高比保持的属性测试
    - **Property 6: Aspect Ratio Preservation**
    - **Validates: Requirements 5.2**

- [x] 5. Checkpoint - 确保所有测试通过
  - 运行所有单元测试和属性测试
  - 如有问题请询问用户

- [x] 6. 修复 DOCX 预览尺寸问题 (Bug Fix)
  - [x] 6.1 修改预览尺寸计算逻辑
    - 使用容器宽度作为预览宽度基准（而非固定 595px）
    - 根据页面宽高比计算预览高度
    - 移除 transform: scale() 的使用，改用直接设置宽度
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 6.2 编写预览缩放的属性测试
    - **Property 7: Preview Scale Based on Container Width**
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [x] 7. 修复页眉页脚布局问题 (Bug Fix)
  - [x] 7.1 重构页眉页脚布局为 flexbox
    - 将 position: absolute 改为 flexbox 垂直布局
    - 页眉、正文、页脚作为独立的 flex item
    - 正文区域使用 flex: 1 占据剩余空间
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 7.2 调整页眉页脚样式
    - 添加视觉区分（背景色、边框）
    - 确保内容不溢出
    - _Requirements: 7.4_
  - [ ]* 7.3 编写垂直布局的属性测试
    - **Property 8: Vertical Layout Flow (No Overlap)**
    - **Validates: Requirements 7.3**

- [x] 8. Checkpoint - 验证 Bug 修复
  - 测试 DOCX 文件预览尺寸是否正确
  - 测试页眉页脚是否正确拼接显示
  - 如有问题请询问用户

- [x] 9. 修复 DOCX 预览内容分页限制问题 (Bug Fix)
  - [x] 9.1 添加 margins prop 到 CropPreview 组件
    - 接收页面边距信息（topMm, bottomMm, headerMm, footerMm）
    - 用于计算内容区域高度
    - _Requirements: 8.2_
  - [x] 9.2 计算内容区域最大高度
    - 根据页面高度和边距计算实际内容区域高度
    - 转换为预览框中的像素高度
    - _Requirements: 8.2, 8.5_
  - [x] 9.3 限制 HTML 内容显示高度
    - 使用 max-height 和 overflow: hidden 裁剪超出内容
    - 确保只显示一页纸能容纳的内容
    - _Requirements: 8.1, 8.3, 8.4_
  - [ ]* 9.4 编写内容分页限制的属性测试
    - **Property 10: Page Content Boundary Clipping**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 10. Checkpoint - 验证内容分页限制修复
  - 测试 DOCX 文件预览是否只显示一页内容
  - 对比实际文档确认预览内容边界正确
  - 如有问题请询问用户

## Notes

- 标记 `*` 的任务为可选测试任务
- PDF 预览使用 pdf-poppler 或 canvas 渲染
- DOCX 不生成图像预览，仅显示尺寸信息和占位符
- 属性测试使用 fast-check 库
- Bug 修复任务 (6, 7) 针对预览尺寸和页眉页脚布局问题
