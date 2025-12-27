# Design Document: Crop Preview

## Overview

本设计为文档裁剪模块添加实时预览功能。核心思路是：
1. 对于 PDF 文件，使用 pdf.js 或 pdf-lib 渲染第一页为图像
2. 在预览图上叠加半透明遮罩层，标识裁剪区域
3. 边距参数变化时实时更新遮罩位置
4. **DOCX 预览使用容器宽度作为基准进行缩放，确保内容显示大小与 Word 一致**
5. **页眉页脚使用 flexbox 垂直布局，与正文内容正确拼接**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CropSettings.vue                      │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │  Margin Inputs  │  │      CropPreview.vue        │   │
│  │  ┌───┐          │  │  ┌─────────────────────┐    │   │
│  │  │Top│          │  │  │   Preview Canvas    │    │   │
│  │  └───┘          │  │  │  ┌───────────────┐  │    │   │
│  │ ┌───┐   ┌───┐   │  │  │  │  Page Image   │  │    │   │
│  │ │Lft│   │Rgt│   │  │  │  │  + Crop Mask  │  │    │   │
│  │ └───┘   └───┘   │  │  │  └───────────────┘  │    │   │
│  │  ┌───┐          │  │  │   Dimension Info    │    │   │
│  │  │Btm│          │  │  └─────────────────────┘    │   │
│  │  └───┘          │  └─────────────────────────────┘   │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Main Process (IPC)                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │            cropperService.js                     │    │
│  │  + generatePreview(filePath) → base64 image     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## DOCX 预览页面布局

```
┌─────────────────────────────────────────┐
│              Page Frame                  │
│  ┌───────────────────────────────────┐  │
│  │         Header Area               │  │  ← 页眉区域 (flex item)
│  │   [页眉内容，如：第一试卷网...]    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │         Main Content              │  │  ← 正文区域 (flex: 1)
│  │   [HTML 内容，按比例缩放]          │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │         Footer Area               │  │  ← 页脚区域 (flex item)
│  │   [页脚内容，如：第一试卷网...]    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Components and Interfaces

### 1. CropPreview.vue (新组件)

负责渲染预览画布和裁剪遮罩。

```javascript
// Props
{
  previewImage: String,      // Base64 图像数据
  previewHtml: String,       // DOCX HTML 内容
  pageWidth: Number,         // 页面宽度 (mm)
  pageHeight: Number,        // 页面高度 (mm)
  fileType: String,          // 文件类型 'pdf' | 'docx'
  cropSettings: {
    top: Number,
    bottom: Number,
    left: Number,
    right: Number
  },
  headers: Array,            // 页眉内容数组
  footers: Array             // 页脚内容数组
}

// Emits
{
  'preview-error': (message: String) => void
}
```

### 2. DOCX 预览缩放策略 (Bug Fix)

**问题**: 当前使用固定的 595px 宽度和 transform: scale() 导致内容显示过小。

**解决方案**: 
1. 使用容器实际宽度作为预览宽度基准
2. 根据页面宽高比计算预览高度
3. HTML 内容使用 CSS zoom 或直接设置宽度，而非 transform: scale()

```javascript
// 缩放计算逻辑
const MM_TO_PX = 96 / 25.4  // 1mm ≈ 3.78px

// 计算预览尺寸 - 基于容器宽度
const scale = computed(() => {
  if (!props.pageWidth || !props.pageHeight) return 1
  // 使用容器宽度的 90% 作为预览宽度
  const targetWidth = containerWidth.value * 0.9
  // 计算基于页面实际尺寸的缩放比例
  const pageWidthPx = props.pageWidth * MM_TO_PX
  return targetWidth / pageWidthPx
})

// 预览尺寸
const previewWidth = computed(() => containerWidth.value * 0.9)
const previewHeight = computed(() => {
  const aspectRatio = props.pageHeight / props.pageWidth
  return previewWidth.value * aspectRatio
})
```

### 3. 页眉页脚布局策略 (Bug Fix)

**问题**: 当前使用 position: absolute 导致页眉页脚与正文重叠。

**解决方案**: 使用 flexbox 垂直布局，页眉页脚作为独立的 flex item。

```html
<div class="page-frame" :style="pageFrameStyle">
  <!-- 使用 flexbox 垂直布局 -->
  <div class="page-content-wrapper">
    <!-- 页眉区域 - 固定高度 -->
    <div class="header-area" v-if="hasHeader">
      <div class="header-content">{{ headers[0] }}</div>
    </div>
    
    <!-- 正文内容 - flex: 1 占据剩余空间 -->
    <div class="main-content-area">
      <div class="html-content" v-html="previewHtml"></div>
    </div>
    
    <!-- 页脚区域 - 固定高度 -->
    <div class="footer-area" v-if="hasFooter">
      <div class="footer-content">{{ footers[0] }}</div>
    </div>
  </div>
</div>
```

```css
.page-content-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.header-area {
  flex-shrink: 0;
  padding: 8px 12px;
  background: rgba(24, 144, 255, 0.08);
  border-bottom: 1px dashed #91d5ff;
}

.main-content-area {
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

.footer-area {
  flex-shrink: 0;
  padding: 8px 12px;
  background: rgba(24, 144, 255, 0.08);
  border-top: 1px dashed #91d5ff;
}
```

### 4. DOCX 预览内容分页限制策略 (Bug Fix)

**问题**: 当前 mammoth 将整个文档转换为连续的 HTML，预览显示的内容超出了实际一页纸能容纳的内容。

**解决方案**: 
1. 计算预览框对应的实际页面内容区域高度
2. 使用 CSS `max-height` 和 `overflow: hidden` 限制 HTML 内容的显示高度
3. 确保只显示一页纸能容纳的内容

```javascript
// 计算内容区域的最大高度
const contentMaxHeight = computed(() => {
  if (!props.pageHeight || !props.margins) return 'auto'
  
  // 页面高度减去上下边距，得到内容区域高度（毫米）
  const contentHeightMm = props.pageHeight - props.margins.topMm - props.margins.bottomMm
  
  // 转换为预览框中的像素高度
  // 预览框高度 / 页面高度 = 缩放比例
  const scale = previewHeight.value / props.pageHeight
  const contentHeightPx = contentHeightMm * scale
  
  // 减去页眉页脚区域的高度（如果有）
  const headerFooterHeight = (hasHeader.value ? 40 : 0) + (hasFooter.value ? 40 : 0)
  
  return `${contentHeightPx - headerFooterHeight}px`
})

// 应用到 HTML 内容样式
const htmlContentStyle = computed(() => ({
  zoom: contentScale.value,
  width: '595px',
  maxHeight: contentMaxHeight.value,
  overflow: 'hidden'
}))
```

**关键点**:
- 使用页面边距信息计算实际内容区域高度
- 根据预览缩放比例转换为像素高度
- 使用 `overflow: hidden` 裁剪超出部分

### 2. cropperService.js 扩展

添加预览生成方法：

```javascript
/**
 * 生成 PDF 第一页的预览图像
 * @param {string} filePath - PDF 文件路径
 * @param {number} maxWidth - 最大宽度 (像素)
 * @returns {Promise<{image: string, width: number, height: number}>}
 */
async function generatePdfPreview(filePath, maxWidth = 400)

/**
 * 获取 DOCX 文档的页面尺寸
 * @param {string} filePath - DOCX 文件路径
 * @returns {Promise<{width: number, height: number}>}
 */
async function getDocxPageSize(filePath)
```

### 3. IPC 接口扩展

```javascript
// preload.js 新增
crop: {
  // 现有方法...
  generatePreview: (filePath) => ipcRenderer.invoke('crop:generatePreview', filePath)
}
```

## Data Models

### PreviewData

```typescript
interface PreviewData {
  image: string | null;      // Base64 编码的图像，DOCX 为 null
  html: string | null;       // DOCX HTML 内容，PDF 为 null
  pageWidth: number;         // 页面宽度 (mm)
  pageHeight: number;        // 页面高度 (mm)
  fileType: 'pdf' | 'docx';  // 文件类型
  headers: string[];         // 页眉内容数组
  footers: string[];         // 页脚内容数组
}
```

### CropOverlayConfig

```typescript
interface CropOverlayConfig {
  // 遮罩颜色配置
  maskColor: string;         // 默认: 'rgba(255, 0, 0, 0.25)'
  borderColor: string;       // 默认: '#1890ff'
  borderWidth: number;       // 默认: 2
}
```

### PageLayoutConfig

```typescript
interface PageLayoutConfig {
  // 页眉页脚高度配置 (像素)
  headerHeight: number;      // 默认: 30
  footerHeight: number;      // 默认: 30
  contentPadding: number;    // 默认: 12
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: PDF Preview Generation

*For any* valid PDF file, calling `generatePdfPreview` SHALL return a non-empty base64 image string and positive page dimensions.

**Validates: Requirements 1.1**

### Property 2: Invalid File Error Handling

*For any* invalid file input (non-existent path, corrupted file, unsupported format), the preview generation SHALL return an error with a descriptive message rather than throwing an unhandled exception.

**Validates: Requirements 1.3**

### Property 3: Page Dimension Extraction

*For any* valid PDF or DOCX document, the extracted page dimensions (width and height) SHALL be positive numbers in millimeters.

**Validates: Requirements 4.1**

### Property 4: Cropped Dimension Calculation

*For any* page dimensions (width, height) and crop settings (top, bottom, left, right), the resulting dimensions SHALL be calculated as:
- resultWidth = pageWidth - left - right
- resultHeight = pageHeight - top - bottom

**Validates: Requirements 4.2**

### Property 5: Invalid Crop Detection

*For any* crop settings where `(left + right >= pageWidth)` OR `(top + bottom >= pageHeight)`, the system SHALL flag this as an invalid configuration.

**Validates: Requirements 4.3**

### Property 6: Aspect Ratio Preservation

*For any* page dimensions and container dimensions, the scaled preview dimensions SHALL maintain the original aspect ratio (width/height ratio remains constant within floating-point tolerance).

**Validates: Requirements 5.2, 6.3**

### Property 7: Preview Scale Based on Container Width

*For any* container width and page dimensions, the preview width SHALL be calculated as a proportion of the container width (not a fixed pixel value), and the scale factor SHALL use the page's actual width in mm as the reference.

**Validates: Requirements 6.1, 6.2, 6.4**

### Property 8: Vertical Layout Flow (No Overlap)

*For any* DOCX preview with headers and/or footers, the layout SHALL use flexbox column direction, ensuring header, main content, and footer are vertically stacked without overlap.

**Validates: Requirements 7.3**

### Property 9: Content Area Height Calculation

*For any* page height and header/footer configuration, the main content area height SHALL equal the total page height minus the header height minus the footer height.

**Validates: Requirements 7.5**

### Property 10: Page Content Boundary Clipping

*For any* DOCX preview, the visible content height SHALL NOT exceed the calculated page content area height (page height minus top margin minus bottom margin minus header/footer space).

**Validates: Requirements 8.1, 8.2, 8.3**

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| File not found | Return error object with message "文件不存在" |
| Corrupted PDF | Return error object with message "无法读取 PDF 文件" |
| Unsupported format | Return error object with message "不支持的文件格式" |
| Invalid crop settings | Display warning in UI, disable crop button |
| Preview generation timeout | Show placeholder with retry option |

## Testing Strategy

### Unit Tests
- Test dimension calculation functions with specific examples
- Test error handling with known invalid inputs
- Test aspect ratio calculation edge cases

### Property-Based Tests
- Use fast-check library for JavaScript property-based testing
- Generate random valid PDF dimensions and crop settings
- Verify calculation properties hold across all generated inputs
- Minimum 100 iterations per property test

### Test Configuration
```javascript
// vitest.config.js
export default {
  test: {
    // Property tests may take longer
    testTimeout: 30000
  }
}
```

