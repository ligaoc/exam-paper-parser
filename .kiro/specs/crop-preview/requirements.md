# Requirements Document

## Introduction

本功能为文档裁剪模块添加实时预览能力，让用户在设置裁剪参数（上、下、左、右边距）时能够直观地看到裁剪效果，避免盲目设置导致的反复调整。

## Glossary

- **Crop_Preview**: 裁剪预览组件，显示文档页面的缩略图并标注裁剪区域
- **Crop_Settings**: 裁剪设置，包含上、下、左、右四个边距值（单位：毫米）
- **Preview_Canvas**: 预览画布，用于渲染文档页面和裁剪标记的 Canvas 元素
- **Crop_Overlay**: 裁剪遮罩层，用半透明颜色标识将被裁剪掉的区域
- **Page_Thumbnail**: 页面缩略图，文档页面的图像预览
- **Header_Footer_Area**: 页眉页脚区域，显示文档的页眉和页脚内容

## Requirements

### Requirement 1: 文档预览生成

**User Story:** As a user, I want to see a preview of my document page, so that I can understand what content will be affected by cropping.

#### Acceptance Criteria

1. WHEN a PDF file is selected, THE Crop_Preview SHALL generate and display a thumbnail of the first page
2. WHEN a DOCX file is selected, THE Crop_Preview SHALL display a placeholder preview indicating the document dimensions
3. IF the file cannot be previewed, THEN THE Crop_Preview SHALL display an error message with the reason

### Requirement 2: 裁剪区域可视化

**User Story:** As a user, I want to see the crop boundaries overlaid on the preview, so that I can understand exactly what will be removed.

#### Acceptance Criteria

1. THE Crop_Overlay SHALL display semi-transparent masks on the areas that will be cropped
2. WHEN crop settings change, THE Crop_Overlay SHALL update immediately to reflect the new boundaries
3. THE Crop_Overlay SHALL use distinct colors to differentiate cropped areas from retained content
4. THE Preview_Canvas SHALL display dimension labels showing the crop margins in millimeters

### Requirement 3: 实时预览更新

**User Story:** As a user, I want the preview to update in real-time as I adjust crop settings, so that I can fine-tune the parameters efficiently.

#### Acceptance Criteria

1. WHEN any margin value changes, THE Crop_Preview SHALL update within 100ms
2. THE Crop_Preview SHALL maintain smooth visual updates without flickering
3. WHILE the user is dragging a margin input, THE Crop_Preview SHALL show continuous updates

### Requirement 4: 页面尺寸显示

**User Story:** As a user, I want to see the document's page dimensions, so that I can set appropriate crop values.

#### Acceptance Criteria

1. WHEN a document is loaded, THE Crop_Preview SHALL display the page width and height in millimeters
2. THE Crop_Preview SHALL display the resulting dimensions after cropping is applied
3. IF crop settings would result in zero or negative dimensions, THEN THE Crop_Preview SHALL display a warning

### Requirement 5: 预览缩放与适配

**User Story:** As a user, I want the preview to fit properly in the available space, so that I can see the entire page clearly.

#### Acceptance Criteria

1. THE Preview_Canvas SHALL scale the page thumbnail to fit within the preview container
2. THE Preview_Canvas SHALL maintain the page's aspect ratio when scaling
3. WHEN the container size changes, THE Preview_Canvas SHALL resize accordingly

### Requirement 6: DOCX 预览尺寸与 Word 一致

**User Story:** As a user, I want the DOCX preview to display at a size similar to how it appears in Word, so that I can accurately judge the crop effect.

#### Acceptance Criteria

1. WHEN a DOCX file is previewed, THE Crop_Preview SHALL render the content at a size proportional to the actual page dimensions
2. THE Crop_Preview SHALL use the document's actual page width (e.g., 210mm for A4) as the reference for scaling
3. THE Crop_Preview SHALL ensure the preview fills the available container width while maintaining aspect ratio
4. THE Crop_Preview SHALL NOT use fixed pixel widths that result in content appearing too small

### Requirement 7: 页眉页脚正确拼接显示

**User Story:** As a user, I want to see the header and footer content properly positioned in the preview, so that I understand the complete page layout.

#### Acceptance Criteria

1. WHEN a DOCX file has headers, THE Crop_Preview SHALL display the header content at the top of the page frame
2. WHEN a DOCX file has footers, THE Crop_Preview SHALL display the footer content at the bottom of the page frame
3. THE Header_Footer_Area SHALL be positioned in a vertical flow with the main content (not overlapping)
4. THE Header_Footer_Area SHALL be visually distinguished from the main content area
5. THE Crop_Preview SHALL correctly calculate the content area height accounting for header and footer space

### Requirement 8: DOCX 预览内容分页限制

**User Story:** As a user, I want the DOCX preview to show only the content that fits on one page, so that I can accurately see what will be cropped on the first page.

#### Acceptance Criteria

1. WHEN a DOCX file is previewed, THE Crop_Preview SHALL limit the displayed content to what fits within one page boundary
2. THE Crop_Preview SHALL calculate the content area height based on page dimensions minus margins
3. THE Crop_Preview SHALL clip or hide content that exceeds the first page boundary
4. THE Crop_Preview SHALL NOT display content from subsequent pages in the preview
5. THE Crop_Preview SHALL use the page height and margins to determine the visible content area

