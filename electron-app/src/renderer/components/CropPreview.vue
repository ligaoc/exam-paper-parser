<template>
  <div class="crop-preview">
    <div class="preview-header">
      <span class="title">预览</span>
      <span class="dimensions" v-if="pageWidth && pageHeight">
        {{ pageWidth.toFixed(1) }} × {{ pageHeight.toFixed(1) }} mm
      </span>
    </div>
    
    <div class="preview-container" ref="containerRef">
      <!-- PDF 预览 (图像) -->
      <div class="preview-wrapper" v-if="previewImage" :style="wrapperStyle">
        <img 
          :src="previewImage" 
          class="preview-image"
          @load="onImageLoad"
        />
        <!-- 裁剪遮罩 -->
        <div class="crop-overlay">
          <div class="mask top" :style="topMaskStyle"></div>
          <div class="mask bottom" :style="bottomMaskStyle"></div>
          <div class="mask left" :style="leftMaskStyle"></div>
          <div class="mask right" :style="rightMaskStyle"></div>
          <div class="crop-border" :style="cropBorderStyle"></div>
        </div>
      </div>
      
      <!-- DOCX 预览 (HTML) - 只显示正文内容 -->
      <div class="preview-wrapper docx-preview" v-else-if="previewHtml" :style="wrapperStyle">
        <div class="page-frame">
          <div class="main-content-area" :style="mainContentStyle">
            <div class="html-content" v-html="previewHtml" :style="htmlContentStyle"></div>
          </div>
        </div>
        <!-- 裁剪遮罩 -->
        <div class="crop-overlay">
          <div class="mask top" :style="topMaskStyle"></div>
          <div class="mask bottom" :style="bottomMaskStyle"></div>
          <div class="mask left" :style="leftMaskStyle"></div>
          <div class="mask right" :style="rightMaskStyle"></div>
          <div class="crop-border" :style="cropBorderStyle"></div>
        </div>
      </div>
      
      <!-- 无预览状态 -->
      <div class="no-preview" v-else>
        <span class="icon">📋</span>
        <span class="text">选择文件后显示预览</span>
      </div>
    </div>
    
    <!-- 裁剪后尺寸信息 -->
    <div class="crop-info" v-if="pageWidth && pageHeight">
      <!-- 页眉显示 -->
      <div class="header-footer-display" v-if="hasHeader">
        <span class="hf-label">📄 页眉:</span>
        <span class="hf-content">{{ headerText }}</span>
      </div>
      
      <div class="info-row">
        <span class="label">裁剪后:</span>
        <span class="value" :class="{ warning: isInvalidCrop }">
          {{ croppedWidth.toFixed(1) }} × {{ croppedHeight.toFixed(1) }} mm
        </span>
      </div>
      <div class="warning-message" v-if="isInvalidCrop">
        ⚠️ 裁剪设置无效：裁剪后尺寸为零或负数
      </div>
      <!-- DOCX 页眉页脚提示 -->
      <div class="docx-hint" v-if="fileType === 'docx'">
        <span class="hint-icon">ℹ️</span>
        <span class="hint-text">页眉页脚将保留，裁剪只影响正文边距</span>
      </div>
      
      <!-- 页脚显示 -->
      <div class="header-footer-display" v-if="hasFooter">
        <span class="hf-label">📄 页脚:</span>
        <span class="hf-content">{{ footerText }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

export default {
  name: 'CropPreview',
  props: {
    previewImage: {
      type: String,
      default: null
    },
    previewHtml: {
      type: String,
      default: null
    },
    pageWidth: {
      type: Number,
      default: 0
    },
    pageHeight: {
      type: Number,
      default: 0
    },
    fileType: {
      type: String,
      default: null
    },
    cropSettings: {
      type: Object,
      default: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
    },
    headers: {
      type: Array,
      default: () => []
    },
    footers: {
      type: Array,
      default: () => []
    },
    margins: {
      type: Object,
      default: () => ({ topMm: 25.4, bottomMm: 25.4, headerMm: 12.7, footerMm: 12.7 })
    }
  },
  emits: ['preview-error'],
  setup(props) {
    const containerRef = ref(null)
    const containerWidth = ref(600)
    const containerHeight = ref(800)
    
    // 毫米转像素的比例（假设 96 DPI 屏幕）
    const MM_TO_PX = 96 / 25.4
    
    // 检查是否有页眉页脚
    const hasHeader = computed(() => props.headers && props.headers.length > 0)
    const hasFooter = computed(() => props.footers && props.footers.length > 0)
    
    // 页眉页脚文本（提取纯文本显示）
    const headerText = computed(() => {
      if (!hasHeader.value) return ''
      // 从 HTML 中提取纯文本
      const div = document.createElement('div')
      div.innerHTML = props.headers[0] || ''
      return div.textContent || div.innerText || '(页眉)'
    })
    
    const footerText = computed(() => {
      if (!hasFooter.value) return ''
      const div = document.createElement('div')
      div.innerHTML = props.footers[0] || ''
      return div.textContent || div.innerText || '(页脚)'
    })
    
    // 计算预览尺寸 - 基于容器宽度，保持宽高比
    const previewWidth = computed(() => {
      if (!props.pageWidth || !props.pageHeight) return 400
      // 使用容器宽度的 95% 作为预览宽度上限
      const maxWidth = containerWidth.value * 0.95
      // 计算基于高度的宽度限制
      const aspectRatio = props.pageWidth / props.pageHeight
      const maxHeightBasedWidth = (containerHeight.value * 0.95) * aspectRatio
      // 取较小值，确保预览完全可见
      return Math.min(maxWidth, maxHeightBasedWidth)
    })
    
    const previewHeight = computed(() => {
      if (!props.pageWidth || !props.pageHeight) return 566
      // 根据宽高比计算高度
      const aspectRatio = props.pageHeight / props.pageWidth
      return previewWidth.value * aspectRatio
    })
    
    // 裁剪后尺寸
    const croppedWidth = computed(() => {
      return Math.max(0, props.pageWidth - props.cropSettings.left - props.cropSettings.right)
    })
    const croppedHeight = computed(() => {
      return Math.max(0, props.pageHeight - props.cropSettings.top - props.cropSettings.bottom)
    })
    
    // 是否无效裁剪
    const isInvalidCrop = computed(() => {
      return croppedWidth.value <= 0 || croppedHeight.value <= 0
    })
    
    // 样式计算
    const wrapperStyle = computed(() => ({
      width: `${previewWidth.value}px`,
      height: `${previewHeight.value}px`
    }))
    
    // HTML 内容缩放比例 - 让内容填充预览框
    // mammoth 生成的 HTML 默认按照约 595px (A4 72dpi) 宽度渲染
    // 我们需要将其放大到预览框宽度
    const contentScale = computed(() => {
      const originalWidth = 595 // mammoth 默认渲染宽度
      // 减去 padding (12px * 2 = 24px)
      const availableWidth = previewWidth.value - 24
      return availableWidth / originalWidth
    })
    
    // 计算内容区域的最大高度（用于分页限制）
    // 这确保预览只显示一页纸能容纳的内容
    const contentMaxHeight = computed(() => {
      if (!props.pageHeight || !props.margins) return null
      
      // 页面高度减去上下边距，得到内容区域高度（毫米）
      const topMarginMm = props.margins.topMm || 25.4
      const bottomMarginMm = props.margins.bottomMm || 25.4
      const contentHeightMm = props.pageHeight - topMarginMm - bottomMarginMm
      
      // 计算内容区域占页面高度的比例
      const contentRatio = contentHeightMm / props.pageHeight
      
      // 预览框高度中，内容区域应该占的像素高度
      const contentHeightPx = previewHeight.value * contentRatio
      
      // 减去 padding (12px * 2 = 24px)
      return Math.max(0, contentHeightPx - 24)
    })
    
    // 计算 HTML 内容的最大高度（在 zoom 之前的原始高度）
    // 这个高度应用在 .html-content 上，在 zoom 缩放之前
    const htmlContentMaxHeight = computed(() => {
      if (contentMaxHeight.value === null) return null
      
      // contentMaxHeight 是期望在预览框中显示的高度（zoom 后）
      // 由于 zoom 会缩放内容，我们需要反向计算原始高度
      // 显示高度 = 原始高度 * zoom
      // 原始高度 = 显示高度 / zoom
      return contentMaxHeight.value / contentScale.value
    })
    
    const htmlContentStyle = computed(() => {
      const style = {
        zoom: contentScale.value,
        width: '595px'
      }
      
      // 应用高度限制（在 zoom 之前的原始高度）
      if (htmlContentMaxHeight.value !== null && htmlContentMaxHeight.value > 0) {
        style.maxHeight = `${htmlContentMaxHeight.value}px`
        style.overflow = 'hidden'
      }
      
      return style
    })
    
    // 主内容区域样式
    const mainContentStyle = computed(() => {
      return {}
    })
    
    // 遮罩样式
    const topMaskStyle = computed(() => {
      if (!props.pageHeight) return { height: '0%' }
      const topPx = (props.cropSettings.top / props.pageHeight) * 100
      return { height: `${Math.min(topPx, 100)}%` }
    })
    
    const bottomMaskStyle = computed(() => {
      if (!props.pageHeight) return { height: '0%' }
      const bottomPx = (props.cropSettings.bottom / props.pageHeight) * 100
      return { height: `${Math.min(bottomPx, 100)}%` }
    })
    
    const leftMaskStyle = computed(() => {
      if (!props.pageWidth || !props.pageHeight) return { width: '0%' }
      const leftPx = (props.cropSettings.left / props.pageWidth) * 100
      const topPx = (props.cropSettings.top / props.pageHeight) * 100
      const bottomPx = (props.cropSettings.bottom / props.pageHeight) * 100
      return { 
        width: `${Math.min(leftPx, 100)}%`,
        top: `${Math.min(topPx, 100)}%`,
        bottom: `${Math.min(bottomPx, 100)}%`
      }
    })
    
    const rightMaskStyle = computed(() => {
      if (!props.pageWidth || !props.pageHeight) return { width: '0%' }
      const rightPx = (props.cropSettings.right / props.pageWidth) * 100
      const topPx = (props.cropSettings.top / props.pageHeight) * 100
      const bottomPx = (props.cropSettings.bottom / props.pageHeight) * 100
      return { 
        width: `${Math.min(rightPx, 100)}%`,
        top: `${Math.min(topPx, 100)}%`,
        bottom: `${Math.min(bottomPx, 100)}%`
      }
    })
    
    const cropBorderStyle = computed(() => {
      if (!props.pageWidth || !props.pageHeight) return {}
      const top = (props.cropSettings.top / props.pageHeight) * 100
      const bottom = (props.cropSettings.bottom / props.pageHeight) * 100
      const left = (props.cropSettings.left / props.pageWidth) * 100
      const right = (props.cropSettings.right / props.pageWidth) * 100
      return {
        top: `${Math.min(top, 100)}%`,
        left: `${Math.min(left, 100)}%`,
        right: `${Math.min(right, 100)}%`,
        bottom: `${Math.min(bottom, 100)}%`
      }
    })
    
    const onImageLoad = () => {
      // 图像加载完成
    }
    
    const updateContainerSize = () => {
      if (containerRef.value) {
        const width = containerRef.value.clientWidth
        const height = containerRef.value.clientHeight
        if (width > 0) containerWidth.value = width
        if (height > 0) containerHeight.value = height
      }
    }
    
    // 监听预览数据变化，重新计算尺寸
    watch([() => props.previewImage, () => props.previewHtml], () => {
      nextTick(() => {
        updateContainerSize()
      })
    })
    
    onMounted(() => {
      nextTick(() => {
        updateContainerSize()
      })
      setTimeout(updateContainerSize, 100)
      window.addEventListener('resize', updateContainerSize)
    })
    
    onUnmounted(() => {
      window.removeEventListener('resize', updateContainerSize)
    })
    
    return {
      containerRef,
      hasHeader,
      hasFooter,
      headerText,
      footerText,
      previewWidth,
      previewHeight,
      croppedWidth,
      croppedHeight,
      isInvalidCrop,
      wrapperStyle,
      htmlContentStyle,
      mainContentStyle,
      topMaskStyle,
      bottomMaskStyle,
      leftMaskStyle,
      rightMaskStyle,
      cropBorderStyle,
      onImageLoad
    }
  }
}
</script>

<style scoped>
.crop-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 600px;
  background: #fafafa;
  border-radius: 8px;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f0f0f0;
  border-bottom: 1px solid #e8e8e8;
}

.preview-header .title {
  font-weight: 500;
  color: #333;
}

.preview-header .dimensions {
  font-size: 12px;
  color: #666;
}

.preview-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  min-height: 500px;
  overflow: hidden;
  background: #e8e8e8;
}

.preview-wrapper {
  position: relative;
  background: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.preview-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.docx-preview {
  overflow: hidden;
}

.page-frame {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: white;
}

/* Flexbox 垂直布局容器 */
.page-content-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

/* 页眉区域 - 固定高度 */
.header-area {
  flex-shrink: 0;
  padding: 8px 12px;
  background: rgba(24, 144, 255, 0.1);
  border-bottom: 1px dashed #91d5ff;
}

.header-content {
  font-size: 11px;
  color: #666;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 正文内容区域 - 占据剩余空间 */
.main-content-area {
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

.html-content {
  font-family: 'SimSun', 'Microsoft YaHei', serif;
  font-size: 12px;
  line-height: 1.6;
  color: #333;
}

.html-content :deep(p) {
  margin: 0 0 8px 0;
}

.html-content :deep(h1) {
  font-size: 16px;
  margin: 10px 0 8px 0;
  text-align: center;
}

.html-content :deep(h2) {
  font-size: 14px;
  margin: 8px 0 6px 0;
}

.html-content :deep(h3) {
  font-size: 13px;
  margin: 6px 0 4px 0;
}

.html-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.html-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  margin: 8px 0;
}

.html-content :deep(td),
.html-content :deep(th) {
  border: 1px solid #ddd;
  padding: 4px;
}

.html-content :deep(strong),
.html-content :deep(b) {
  font-weight: bold;
}

/* 页脚区域 - 固定高度 */
.footer-area {
  flex-shrink: 0;
  padding: 8px 12px;
  background: rgba(24, 144, 255, 0.1);
  border-top: 1px dashed #91d5ff;
}

.footer-content {
  font-size: 11px;
  color: #666;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #999;
}

.no-preview .icon {
  font-size: 64px;
  opacity: 0.5;
}

.no-preview .text {
  font-size: 14px;
}

/* 裁剪遮罩 */
.crop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.mask {
  position: absolute;
  background: rgba(255, 0, 0, 0.25);
}

.mask.top {
  top: 0;
  left: 0;
  right: 0;
}

.mask.bottom {
  bottom: 0;
  left: 0;
  right: 0;
}

.mask.left {
  left: 0;
  position: absolute;
}

.mask.right {
  right: 0;
  position: absolute;
}

.crop-border {
  position: absolute;
  border: 2px dashed #1890ff;
  pointer-events: none;
}

/* 裁剪信息 */
.crop-info {
  padding: 12px 16px;
  background: #f5f5f5;
  border-top: 1px solid #e8e8e8;
}

/* 页眉页脚显示区域 */
.header-footer-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: rgba(24, 144, 255, 0.08);
  border: 1px solid #91d5ff;
  border-radius: 4px;
}

.header-footer-display .hf-label {
  color: #1890ff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.header-footer-display .hf-content {
  color: #666;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-row .label {
  color: #666;
  font-size: 13px;
}

.info-row .value {
  color: #333;
  font-weight: 500;
  font-size: 13px;
}

.info-row .value.warning {
  color: #ff4d4f;
}

.warning-message {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  color: #ff4d4f;
  font-size: 12px;
}

/* DOCX 页眉页脚提示 */
.docx-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.docx-hint .hint-icon {
  font-size: 14px;
}

.docx-hint .hint-text {
  color: #1890ff;
  font-size: 12px;
}
</style>
