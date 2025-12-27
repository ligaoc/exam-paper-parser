/**
 * PDF 文档解析服务
 * 使用 pdfjs-dist 库解析 PDF 文件，提取带样式的文本信息
 * 支持字号识别、图片提取、表格检测
 */

const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

// ============================================
// PDF.js 初始化（Node.js 环境兼容）
// ============================================

// 在 Node.js 环境中提供 DOMMatrix polyfill
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1
      this.is2D = true
      this.isIdentity = true
      
      if (init) {
        if (Array.isArray(init)) {
          if (init.length === 6) {
            [this.a, this.b, this.c, this.d, this.e, this.f] = init
            this.m11 = this.a; this.m12 = this.b
            this.m21 = this.c; this.m22 = this.d
            this.m41 = this.e; this.m42 = this.f
          } else if (init.length === 16) {
            [this.m11, this.m12, this.m13, this.m14,
             this.m21, this.m22, this.m23, this.m24,
             this.m31, this.m32, this.m33, this.m34,
             this.m41, this.m42, this.m43, this.m44] = init
            this.a = this.m11; this.b = this.m12
            this.c = this.m21; this.d = this.m22
            this.e = this.m41; this.f = this.m42
            this.is2D = false
          }
        }
      }
    }
    
    static fromMatrix(other) {
      return new DOMMatrix([other.a, other.b, other.c, other.d, other.e, other.f])
    }
    
    multiply(other) {
      const result = new DOMMatrix()
      result.a = this.a * other.a + this.c * other.b
      result.b = this.b * other.a + this.d * other.b
      result.c = this.a * other.c + this.c * other.d
      result.d = this.b * other.c + this.d * other.d
      result.e = this.a * other.e + this.c * other.f + this.e
      result.f = this.b * other.e + this.d * other.f + this.f
      return result
    }
    
    translate(tx, ty) {
      const result = new DOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f])
      result.e = this.a * tx + this.c * ty + this.e
      result.f = this.b * tx + this.d * ty + this.f
      return result
    }
    
    scale(sx, sy) {
      sy = sy || sx
      return new DOMMatrix([this.a * sx, this.b * sx, this.c * sy, this.d * sy, this.e, this.f])
    }
    
    inverse() {
      const det = this.a * this.d - this.b * this.c
      if (det === 0) return new DOMMatrix()
      return new DOMMatrix([
        this.d / det, -this.b / det,
        -this.c / det, this.a / det,
        (this.c * this.f - this.d * this.e) / det,
        (this.b * this.e - this.a * this.f) / det
      ])
    }
    
    transformPoint(point) {
      return {
        x: this.a * point.x + this.c * point.y + this.e,
        y: this.b * point.x + this.d * point.y + this.f
      }
    }
  }
}

// Path2D polyfill
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {
    constructor() { this.commands = [] }
    moveTo(x, y) { this.commands.push({ type: 'moveTo', x, y }) }
    lineTo(x, y) { this.commands.push({ type: 'lineTo', x, y }) }
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      this.commands.push({ type: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y })
    }
    quadraticCurveTo(cpx, cpy, x, y) {
      this.commands.push({ type: 'quadraticCurveTo', cpx, cpy, x, y })
    }
    closePath() { this.commands.push({ type: 'closePath' }) }
    rect(x, y, w, h) { this.commands.push({ type: 'rect', x, y, w, h }) }
  }
}

let pdfjsLib = null

/**
 * 动态加载 pdfjs-dist（ESM 模块）
 */
async function getPdfjsLib() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  }
  return pdfjsLib
}

// ============================================
// 核心解析函数
// ============================================

/**
 * 解析 PDF 文档（增强版）
 * @param {string} filePath - 文档路径
 * @returns {Promise<Object>} 解析结果
 */
async function parse(filePath) {
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }
  
  // 检查文件格式
  const ext = path.extname(filePath).toLowerCase()
  if (ext !== '.pdf') {
    throw new Error(`不支持的文件格式: ${ext}`)
  }
  
  const pdfjs = await getPdfjsLib()
  
  // 读取文件
  const dataBuffer = fs.readFileSync(filePath)
  const data = new Uint8Array(dataBuffer)
  
  // 加载 PDF 文档
  const loadingTask = pdfjs.getDocument({ data })
  const pdf = await loadingTask.promise
  
  const numPages = pdf.numPages
  const allTextItems = []
  const pageTexts = []
  
  // 遍历每一页
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    
    // 收集该页的文本项
    const pageItems = textContent.items.map(item => ({
      str: item.str,
      height: item.height || 10.5,
      width: item.width || 0,
      transform: item.transform || [1, 0, 0, 1, 0, 0],
      fontName: item.fontName || '',
      pageNumber: pageNum,
      // transform[4] = x, transform[5] = y
      x: item.transform ? item.transform[4] : 0,
      y: item.transform ? item.transform[5] : 0
    }))
    
    allTextItems.push(...pageItems)
    
    // 构建该页的纯文本
    const pageText = pageItems.map(item => item.str).join(' ')
    pageTexts.push({
      pageNumber: pageNum,
      text: pageText.trim()
    })
  }
  
  // 合并所有文本
  const fullText = pageTexts.map(p => p.text).join('\n\n')
  
  // 提取带样式的段落
  const styledParagraphs = mergeTextItemsToParagraphs(allTextItems)
  
  // 提取图片
  const images = await extractImages(filePath)
  
  // 检测表格
  const tables = detectTables(allTextItems)
  
  // 构建内容块
  const contentBlocks = buildContentBlocks(styledParagraphs, tables, images)
  
  return {
    // 向后兼容的属性
    text: fullText,
    pages: pageTexts,
    metadata: {
      numPages: numPages,
      info: {},
      version: '1.0'
    },
    // 新增属性
    styledParagraphs,
    images,
    tables,
    contentBlocks
  }
}

// ============================================
// 文本项合并为段落
// ============================================

/**
 * 将文本项合并为带样式的段落
 * @param {Array} textItems - 文本项数组
 * @returns {Array} 带样式的段落数组
 */
function mergeTextItemsToParagraphs(textItems) {
  if (!textItems || textItems.length === 0) {
    return []
  }
  
  // 按页分组
  const pageGroups = new Map()
  textItems.forEach(item => {
    if (!pageGroups.has(item.pageNumber)) {
      pageGroups.set(item.pageNumber, [])
    }
    pageGroups.get(item.pageNumber).push(item)
  })
  
  const paragraphs = []
  let paragraphIndex = 0
  
  // 处理每一页
  for (const [pageNumber, items] of pageGroups) {
    // 按 Y 坐标分组（同一行的文本项）
    const lineGroups = groupByLine(items)
    
    // 处理每一行
    for (const lineItems of lineGroups) {
      // 按 X 坐标排序
      lineItems.sort((a, b) => a.x - b.x)
      
      // 合并文本
      const text = lineItems.map(item => item.str).join('')
      
      // 跳过空行
      if (!text.trim()) {
        continue
      }
      
      // 计算字号（取最大值）
      const fontSize = Math.max(...lineItems.map(item => item.height || 10.5))
      
      // 检测粗体（基于字体名称）
      const isBold = lineItems.some(item => 
        item.fontName && (
          item.fontName.toLowerCase().includes('bold') ||
          item.fontName.toLowerCase().includes('black') ||
          item.fontName.toLowerCase().includes('heavy')
        )
      )
      
      // 计算该行的 Y 坐标（从页面顶部算起）
      // PDF 坐标系 Y 向上增加，我们需要转换为从上到下
      // 使用该行最大的 Y 值（因为 PDF 中 Y 越大越靠上）
      const maxY = Math.max(...lineItems.map(item => item.y))
      // 假设页面高度约 842（A4 纸），转换为从顶部算起的距离
      const yFromTop = 842 - maxY
      
      paragraphs.push({
        index: paragraphIndex++,
        text: text.trim(),
        fontSize: fontSize,
        isBold: isBold,
        paragraphStyle: null,
        sortKey: (isBold ? 1000 : 0) + fontSize,
        pageNumber: pageNumber,
        y: yFromTop // 从页面顶部算起的距离
      })
    }
  }
  
  return paragraphs
}

/**
 * 按 Y 坐标分组（同一行的文本项）
 * @param {Array} items - 文本项数组
 * @param {number} tolerance - Y 坐标容差（默认 3）
 * @returns {Array<Array>} 分组后的文本项数组
 */
function groupByLine(items, tolerance = 3) {
  if (!items || items.length === 0) {
    return []
  }
  
  // 按 Y 坐标排序（从上到下，Y 值从大到小）
  const sorted = [...items].sort((a, b) => b.y - a.y)
  
  const lines = []
  let currentLine = [sorted[0]]
  let currentY = sorted[0].y
  // 使用该行最大字号作为基准
  let currentMaxHeight = sorted[0].height || 10.5
  
  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i]
    const itemHeight = item.height || 10.5
    
    // 动态容差：基于当前行最大字号的一半
    const dynamicTolerance = Math.max(tolerance, currentMaxHeight * 0.6)
    
    // 如果 Y 坐标差异在容差范围内，视为同一行
    // 上下标通常 Y 坐标偏移较小，但字号明显较小
    if (Math.abs(item.y - currentY) <= dynamicTolerance) {
      currentLine.push(item)
      // 更新最大字号
      if (itemHeight > currentMaxHeight) {
        currentMaxHeight = itemHeight
      }
    } else {
      // 新的一行
      lines.push(currentLine)
      currentLine = [item]
      currentY = item.y
      currentMaxHeight = itemHeight
    }
  }
  
  // 添加最后一行
  if (currentLine.length > 0) {
    lines.push(currentLine)
  }
  
  return lines
}

// ============================================
// 图片提取
// ============================================

/**
 * 从 PDF 中提取图片
 * @param {string} filePath - PDF 文件路径
 * @returns {Promise<Array>} 图片数组
 */
async function extractImages(filePath) {
  const images = []
  
  try {
    const pdfjs = await getPdfjsLib()
    const dataBuffer = fs.readFileSync(filePath)
    const data = new Uint8Array(dataBuffer)
    
    const loadingTask = pdfjs.getDocument({ data })
    const pdf = await loadingTask.promise
    
    let imageIndex = 0
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.0 })
      
      try {
        const operatorList = await page.getOperatorList()
        const OPS = pdfjs.OPS
        
        // 追踪变换矩阵以获取图片位置
        let currentTransform = [1, 0, 0, 1, 0, 0]
        const transformStack = []
        
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i]
          const args = operatorList.argsArray[i]
          
          // 追踪变换矩阵
          if (fn === OPS.save) {
            transformStack.push([...currentTransform])
          } else if (fn === OPS.restore) {
            if (transformStack.length > 0) {
              currentTransform = transformStack.pop()
            }
          } else if (fn === OPS.transform) {
            // 矩阵乘法
            const [a, b, c, d, e, f] = args
            const [a2, b2, c2, d2, e2, f2] = currentTransform
            currentTransform = [
              a * a2 + b * c2,
              a * b2 + b * d2,
              c * a2 + d * c2,
              c * b2 + d * d2,
              e * a2 + f * c2 + e2,
              e * b2 + f * d2 + f2
            ]
          }
          
          // 检查是否为图片绘制操作
          if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
            const imageName = args[0]
            
            try {
              // 获取图片对象
              const objs = page.objs
              const imageObj = await new Promise((resolve, reject) => {
                objs.get(imageName, (img) => {
                  if (img) resolve(img)
                  else reject(new Error('Image not found'))
                })
              })
              
              if (imageObj && imageObj.data) {
                // 计算图片在页面中的 Y 位置
                // PDF 坐标系原点在左下角，Y 向上增加
                // 我们需要转换为从上到下的顺序
                const imgY = currentTransform[5] // 图片的 Y 坐标
                const pageHeight = viewport.height
                const yFromTop = pageHeight - imgY // 从页面顶部算起的距离
                
                // 转换为 base64
                const imageData = extractImageData(imageObj)
                if (imageData) {
                  images.push({
                    id: uuidv4(),
                    position: imageIndex++,
                    pageNumber: pageNum,
                    mimeType: imageData.mimeType,
                    base64: imageData.base64,
                    dataUrl: `data:${imageData.mimeType};base64,${imageData.base64}`,
                    width: imageObj.width,
                    height: imageObj.height,
                    y: yFromTop // 添加 Y 坐标用于排序
                  })
                }
              }
            } catch (imgError) {
              // 单个图片提取失败，继续处理其他图片
              console.warn(`提取图片失败 (页${pageNum}):`, imgError.message)
            }
          }
        }
      } catch (pageError) {
        console.warn(`处理页面 ${pageNum} 图片失败:`, pageError.message)
      }
    }
  } catch (error) {
    console.warn('提取 PDF 图片失败:', error.message)
  }
  
  return images
}

/**
 * 从 PDF 图片对象提取数据
 * @param {Object} imageObj - PDF 图片对象
 * @returns {Object|null} { mimeType, base64 }
 */
function extractImageData(imageObj) {
  try {
    if (!imageObj || !imageObj.data) {
      return null
    }
    
    const { data, width, height } = imageObj
    
    // 使用 canvas 将原始像素数据转换为 PNG
    try {
      const { createCanvas } = require('canvas')
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')
      
      // 创建 ImageData
      // PDF.js 返回的数据可能是 RGB 或 RGBA 格式
      const imageData = ctx.createImageData(width, height)
      
      // 检测数据格式（RGB 还是 RGBA）
      const expectedRGBA = width * height * 4
      const expectedRGB = width * height * 3
      
      if (data.length === expectedRGBA) {
        // RGBA 格式，直接复制
        imageData.data.set(data)
      } else if (data.length === expectedRGB) {
        // RGB 格式，需要添加 alpha 通道
        for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
          imageData.data[j] = data[i]       // R
          imageData.data[j + 1] = data[i + 1] // G
          imageData.data[j + 2] = data[i + 2] // B
          imageData.data[j + 3] = 255         // A
        }
      } else {
        // 尝试作为 RGBA 处理
        const len = Math.min(data.length, imageData.data.length)
        for (let i = 0; i < len; i++) {
          imageData.data[i] = data[i]
        }
        // 填充 alpha 通道
        for (let i = 3; i < imageData.data.length; i += 4) {
          if (imageData.data[i] === 0) {
            imageData.data[i] = 255
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0)
      
      // 转换为 PNG base64
      const pngDataUrl = canvas.toDataURL('image/png')
      const base64 = pngDataUrl.replace(/^data:image\/png;base64,/, '')
      
      return {
        mimeType: 'image/png',
        base64: base64
      }
    } catch (canvasError) {
      console.warn('Canvas 转换失败，尝试直接输出:', canvasError.message)
      // 降级：直接输出原始数据（可能无法显示）
      const base64 = Buffer.from(data).toString('base64')
      return {
        mimeType: 'image/png',
        base64: base64
      }
    }
  } catch (error) {
    console.warn('提取图片数据失败:', error.message)
    return null
  }
}

// ============================================
// 表格检测
// ============================================

/**
 * 检测表格结构
 * 注意：PDF 的表格检测比较困难，当前实现暂时禁用
 * 因为基于文本位置的检测容易把普通段落误判为表格
 * @param {Array} textItems - 文本项数组
 * @returns {Array} 表格数组
 */
function detectTables(textItems) {
  // 暂时禁用 PDF 表格检测，避免误判
  // PDF 中的表格通常需要通过矢量图形（线条）来识别
  // 纯文本位置分析容易产生误判
  return []
  
  // 以下是原始实现，保留供参考
  /*
  const tables = []
  
  try {
    // 按页分组
    const pageGroups = new Map()
    textItems.forEach(item => {
      if (!pageGroups.has(item.pageNumber)) {
        pageGroups.set(item.pageNumber, [])
      }
      pageGroups.get(item.pageNumber).push(item)
    })
    
    let tableIndex = 0
    
    for (const [pageNumber, items] of pageGroups) {
      // 检测该页的表格
      const pageTables = detectTablesInPage(items, pageNumber, tableIndex)
      tables.push(...pageTables)
      tableIndex += pageTables.length
    }
  } catch (error) {
    console.warn('检测表格失败:', error.message)
  }
  
  return tables
  */
}

/**
 * 检测单页中的表格
 * @param {Array} items - 该页的文本项
 * @param {number} pageNumber - 页码
 * @param {number} startIndex - 起始索引
 * @returns {Array} 表格数组
 */
function detectTablesInPage(items, pageNumber, startIndex) {
  const tables = []
  
  // 按 Y 坐标分组
  const lines = groupByLine(items, 5)
  
  // 分析每行的 X 坐标分布，寻找对齐的列
  const columnCandidates = analyzeColumnAlignment(lines)
  
  // 如果检测到明显的列对齐（至少 3 列，至少 3 行），认为是表格
  if (columnCandidates.length >= 3 && lines.length >= 3) {
    // 检查是否有足够多的行具有相似的列结构
    const tableLines = findTableLines(lines, columnCandidates)
    
    if (tableLines.length >= 3) {
      const table = buildTableFromLines(tableLines, columnCandidates, startIndex, pageNumber)
      if (table) {
        tables.push(table)
      }
    }
  }
  
  return tables
}

/**
 * 分析列对齐
 * @param {Array<Array>} lines - 行数组
 * @returns {Array} 列边界数组
 */
function analyzeColumnAlignment(lines) {
  // 收集所有 X 坐标
  const xPositions = []
  lines.forEach(line => {
    line.forEach(item => {
      xPositions.push(Math.round(item.x))
    })
  })
  
  // 统计 X 坐标出现频率
  const xFrequency = new Map()
  xPositions.forEach(x => {
    // 使用 10 像素的桶进行分组
    const bucket = Math.round(x / 10) * 10
    xFrequency.set(bucket, (xFrequency.get(bucket) || 0) + 1)
  })
  
  // 找出高频的 X 坐标（可能是列边界）
  const threshold = lines.length * 0.3 // 至少 30% 的行在该位置有文本
  const columns = []
  
  for (const [x, count] of xFrequency) {
    if (count >= threshold) {
      columns.push(x)
    }
  }
  
  // 按 X 坐标排序
  columns.sort((a, b) => a - b)
  
  return columns
}

/**
 * 找出属于表格的行
 * @param {Array<Array>} lines - 所有行
 * @param {Array} columns - 列边界
 * @returns {Array<Array>} 表格行
 */
function findTableLines(lines, columns) {
  const tableLines = []
  
  for (const line of lines) {
    // 检查该行是否与列对齐
    let alignedCount = 0
    
    for (const item of line) {
      const x = Math.round(item.x / 10) * 10
      if (columns.includes(x)) {
        alignedCount++
      }
    }
    
    // 如果该行有多个文本项与列对齐，认为是表格行
    if (alignedCount >= 2) {
      tableLines.push(line)
    }
  }
  
  return tableLines
}

/**
 * 从行构建表格对象
 * @param {Array<Array>} lines - 表格行
 * @param {Array} columns - 列边界
 * @param {number} position - 表格位置索引
 * @param {number} pageNumber - 页码
 * @returns {Object} 表格对象
 */
function buildTableFromLines(lines, columns, position, pageNumber) {
  const rows = []
  
  for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
    const line = lines[rowIndex]
    const cells = []
    
    // 将文本项分配到对应的列
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const colX = columns[colIndex]
      const nextColX = columns[colIndex + 1] || Infinity
      
      // 找出属于该列的文本项
      const cellItems = line.filter(item => {
        const x = Math.round(item.x / 10) * 10
        return x >= colX && x < nextColX
      })
      
      // 合并文本
      const cellText = cellItems.map(item => item.str).join(' ').trim()
      
      cells.push({
        text: cellText,
        rowIndex: rowIndex,
        colIndex: colIndex,
        rowspan: 1,
        colspan: 1,
        isMerged: false,
        images: []
      })
    }
    
    rows.push({
      index: rowIndex,
      cells: cells,
      isHeader: rowIndex === 0 // 假设第一行是表头
    })
  }
  
  const table = {
    id: uuidv4(),
    position: position,
    pageNumber: pageNumber,
    rowCount: rows.length,
    colCount: columns.length,
    rows: rows,
    html: generateTableHtml(rows)
  }
  
  return table
}

/**
 * 生成表格 HTML
 * @param {Array} rows - 行数组
 * @returns {string} HTML 字符串
 */
function generateTableHtml(rows) {
  let html = '<table border="1" cellpadding="4" cellspacing="0">\n'
  
  for (const row of rows) {
    html += row.isHeader ? '  <thead><tr>\n' : '  <tr>\n'
    
    for (const cell of row.cells) {
      if (cell.isMerged) continue
      
      const tag = row.isHeader ? 'th' : 'td'
      let attrs = ''
      
      if (cell.rowspan > 1) attrs += ` rowspan="${cell.rowspan}"`
      if (cell.colspan > 1) attrs += ` colspan="${cell.colspan}"`
      
      const escapedText = (cell.text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
      
      html += `    <${tag}${attrs}>${escapedText}</${tag}>\n`
    }
    
    html += row.isHeader ? '  </tr></thead>\n' : '  </tr>\n'
  }
  
  html += '</table>'
  return html
}

// ============================================
// 内容块构建
// ============================================

/**
 * 构建有序内容块
 * @param {Array} paragraphs - 段落数组
 * @param {Array} tables - 表格数组
 * @param {Array} images - 图片数组
 * @returns {Array} 内容块数组
 */
function buildContentBlocks(paragraphs, tables, images) {
  const blocks = []
  
  // 添加段落（段落已经按 Y 坐标排序了）
  for (const p of paragraphs) {
    blocks.push({
      type: 'paragraph',
      pageNumber: p.pageNumber,
      y: p.y || 0, // 段落的 Y 坐标（从页面顶部算起）
      content: p.text
    })
  }
  
  // 添加表格
  for (const t of tables) {
    blocks.push({
      type: 'table',
      pageNumber: t.pageNumber,
      y: t.y || 0,
      content: t
    })
  }
  
  // 添加图片
  for (const img of images) {
    blocks.push({
      type: 'image',
      pageNumber: img.pageNumber,
      y: img.y || 0, // 图片的 Y 坐标（从页面顶部算起）
      content: img
    })
  }
  
  // 按页码和 Y 坐标排序（先按页码，同一页内按 Y 坐标从上到下）
  blocks.sort((a, b) => {
    const pageDiff = (a.pageNumber || 0) - (b.pageNumber || 0)
    if (pageDiff !== 0) return pageDiff
    return (a.y || 0) - (b.y || 0)
  })
  
  // 添加索引
  blocks.forEach((block, index) => {
    block.index = index
  })
  
  return blocks
}

// ============================================
// 兼容旧版本的函数
// ============================================

/**
 * 获取 PDF 页数
 * @param {string} filePath - 文档路径
 */
async function getPageCount(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }
  
  const pdfjs = await getPdfjsLib()
  const dataBuffer = fs.readFileSync(filePath)
  const data = new Uint8Array(dataBuffer)
  
  const loadingTask = pdfjs.getDocument({ data })
  const pdf = await loadingTask.promise
  
  return pdf.numPages
}

/**
 * 检查文件是否为支持的 PDF 格式
 * @param {string} filePath - 文件路径
 */
function isSupported(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.pdf'
}

/**
 * 检查 PDF 是否为文字型（非扫描件）
 * @param {string} filePath - 文档路径
 */
async function isTextBased(filePath) {
  try {
    const result = await parse(filePath)
    const textLength = result.text.replace(/\s/g, '').length
    const avgCharsPerPage = textLength / result.metadata.numPages
    return avgCharsPerPage > 100
  } catch (error) {
    return false
  }
}

module.exports = {
  parse,
  getPageCount,
  isSupported,
  isTextBased,
  // 新增导出
  extractImages,
  detectTables,
  mergeTextItemsToParagraphs,
  groupByLine
}
