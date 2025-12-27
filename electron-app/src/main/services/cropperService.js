/**
 * 文档裁剪服务
 * 支持调整 PDF 和 Word 文档的边距
 */

const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

// PDF.js 用于渲染预览
let pdfjsLib = null
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  }
  return pdfjsLib
}

// 单位转换常量
// 1 inch = 25.4 mm
// 1 point = 1/72 inch
const MM_TO_POINTS = 72 / 25.4  // 约 2.834645669

/**
 * 毫米转换为 PDF 点数
 * @param {number} mm - 毫米值
 * @returns {number} 点数
 */
function mmToPoints(mm) {
  return mm * MM_TO_POINTS
}

/**
 * PDF 点数转换为毫米
 * @param {number} points - 点数
 * @returns {number} 毫米值
 */
function pointsToMm(points) {
  return points / MM_TO_POINTS
}

/**
 * 裁剪 PDF 文档
 * @param {string} inputPath - 输入文件路径
 * @param {Object} settings - 裁剪设置
 * @param {number} settings.top - 上边距 (mm)
 * @param {number} settings.bottom - 下边距 (mm)
 * @param {number} settings.left - 左边距 (mm)
 * @param {number} settings.right - 右边距 (mm)
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<string>} 输出文件路径
 */
async function cropPdf(inputPath, settings, outputPath) {
  // 检查输入文件
  if (!fs.existsSync(inputPath)) {
    throw new Error(`文件不存在: ${inputPath}`)
  }
  
  // 读取 PDF 文件
  const pdfBytes = fs.readFileSync(inputPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  
  // 转换边距为点数
  const topPts = mmToPoints(settings.top || 0)
  const bottomPts = mmToPoints(settings.bottom || 0)
  const leftPts = mmToPoints(settings.left || 0)
  const rightPts = mmToPoints(settings.right || 0)
  
  // 获取所有页面
  const pages = pdfDoc.getPages()
  
  // 对每一页应用裁剪
  for (const page of pages) {
    const { width, height } = page.getSize()
    
    // 计算新的裁剪框 (CropBox)
    // CropBox 定义了页面的可见区域
    // 格式: [left, bottom, right, top] (从左下角开始)
    const cropBox = {
      left: leftPts,
      bottom: bottomPts,
      right: width - rightPts,
      top: height - topPts
    }
    
    // 设置 CropBox
    page.setCropBox(cropBox.left, cropBox.bottom, cropBox.right - cropBox.left, cropBox.top - cropBox.bottom)
  }
  
  // 保存裁剪后的 PDF
  const croppedPdfBytes = await pdfDoc.save()
  
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  fs.writeFileSync(outputPath, croppedPdfBytes)
  
  // 返回纯字符串路径
  return String(outputPath)
}

/**
 * 裁剪 Word 文档 (调整页边距)
 * 注意：这会修改文档的页边距设置，而不是真正的裁剪
 * 保留所有原始格式、样式、图片等内容
 * @param {string} inputPath - 输入文件路径
 * @param {Object} settings - 裁剪设置
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<string>} 输出文件路径
 */
async function cropDocx(inputPath, settings, outputPath) {
  // 检查输入文件
  if (!fs.existsSync(inputPath)) {
    throw new Error(`文件不存在: ${inputPath}`)
  }
  
  const AdmZip = require('adm-zip')
  
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // 直接从源文件读取（不先复制，避免文件锁定问题）
  const zip = new AdmZip(inputPath)
  
  // 读取 document.xml
  let documentXml = ''
  try {
    documentXml = zip.readAsText('word/document.xml')
  } catch (e) {
    throw new Error('无法读取文档内容，文件可能已损坏')
  }
  
  if (!documentXml) {
    throw new Error('文档内容为空')
  }
  
  // 转换毫米为 twips (1 inch = 1440 twips, 1 mm = 1440/25.4 ≈ 56.69 twips)
  const MM_TO_TWIPS = 1440 / 25.4
  const topTwips = Math.round((settings.top || 0) * MM_TO_TWIPS)
  const bottomTwips = Math.round((settings.bottom || 0) * MM_TO_TWIPS)
  const leftTwips = Math.round((settings.left || 0) * MM_TO_TWIPS)
  const rightTwips = Math.round((settings.right || 0) * MM_TO_TWIPS)
  
  // 修改 document.xml 中的页边距
  let modifiedDocXml = documentXml
  
  // 页边距标签 - 匹配带有各种属性的 pgMar 标签
  const pgMarPattern = /<w:pgMar[^/>]*(?:\/>|>[^<]*<\/w:pgMar>)/g
  const newPgMar = `<w:pgMar w:top="${topTwips}" w:right="${rightTwips}" w:bottom="${bottomTwips}" w:left="${leftTwips}" w:header="720" w:footer="720" w:gutter="0"/>`
  
  if (pgMarPattern.test(modifiedDocXml)) {
    // 重置正则表达式的 lastIndex
    pgMarPattern.lastIndex = 0
    // 替换现有的页边距设置
    modifiedDocXml = modifiedDocXml.replace(pgMarPattern, newPgMar)
  } else {
    // 如果没有页边距设置，在 sectPr 中添加
    const sectPrPattern = /<w:sectPr([^>]*)>/g
    if (sectPrPattern.test(modifiedDocXml)) {
      sectPrPattern.lastIndex = 0
      modifiedDocXml = modifiedDocXml.replace(sectPrPattern, (_match, attrs) => {
        return `<w:sectPr${attrs}>` + newPgMar
      })
    } else {
      // 如果连 sectPr 都没有，在 body 结束前添加
      const bodyEndPattern = /<\/w:body>/
      if (bodyEndPattern.test(modifiedDocXml)) {
        modifiedDocXml = modifiedDocXml.replace(bodyEndPattern, 
          `<w:sectPr>${newPgMar}</w:sectPr></w:body>`)
      }
    }
  }
  
  // 更新 zip 中的文件
  zip.updateFile('word/document.xml', Buffer.from(modifiedDocXml, 'utf-8'))
  
  // 写入到输出路径（不是同一个文件，避免文件锁定）
  zip.writeZip(outputPath)
  
  // 返回纯字符串路径
  return String(outputPath)
}

/**
 * 裁剪文档（自动检测格式）
 * @param {string} inputPath - 输入文件路径
 * @param {Object} settings - 裁剪设置
 * @param {string} outputPath - 输出文件路径（可选，默认在原文件名后加 _cropped）
 * @returns {Promise<string>} 输出文件路径
 */
async function cropDocument(inputPath, settings, outputPath = null) {
  const ext = path.extname(inputPath).toLowerCase()
  
  // 生成默认输出路径
  if (!outputPath) {
    const dir = path.dirname(inputPath)
    const name = path.basename(inputPath, ext)
    outputPath = path.join(dir, `${name}_cropped${ext}`)
  }
  
  // 确保路径是字符串
  outputPath = String(outputPath)
  
  // 根据文件类型选择裁剪方法
  if (ext === '.pdf') {
    return await cropPdf(inputPath, settings, outputPath)
  } else if (ext === '.docx') {
    return await cropDocx(inputPath, settings, outputPath)
  } else if (ext === '.doc') {
    throw new Error('.doc 格式不支持裁剪，请先转换为 .docx 格式')
  } else {
    throw new Error(`不支持的文件格式: ${ext}`)
  }
}

/**
 * 获取 PDF 页面信息
 * @param {string} filePath - PDF 文件路径
 * @returns {Promise<Object>} 页面信息
 */
async function getPdfPageInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }
  
  const pdfBytes = fs.readFileSync(filePath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  
  const pageInfos = pages.map((page, index) => {
    const { width, height } = page.getSize()
    const cropBox = page.getCropBox()
    const mediaBox = page.getMediaBox()
    
    return {
      pageNumber: index + 1,
      width: pointsToMm(width),
      height: pointsToMm(height),
      widthPts: width,
      heightPts: height,
      cropBox: cropBox ? {
        x: pointsToMm(cropBox.x),
        y: pointsToMm(cropBox.y),
        width: pointsToMm(cropBox.width),
        height: pointsToMm(cropBox.height)
      } : null,
      mediaBox: mediaBox ? {
        x: pointsToMm(mediaBox.x),
        y: pointsToMm(mediaBox.y),
        width: pointsToMm(mediaBox.width),
        height: pointsToMm(mediaBox.height)
      } : null
    }
  })
  
  return {
    pageCount: pages.length,
    pages: pageInfos
  }
}

/**
 * 验证裁剪设置
 * @param {Object} settings - 裁剪设置
 * @returns {Object} 验证结果
 */
function validateSettings(settings) {
  const errors = []
  
  if (settings.top < 0) errors.push('上边距不能为负数')
  if (settings.bottom < 0) errors.push('下边距不能为负数')
  if (settings.left < 0) errors.push('左边距不能为负数')
  if (settings.right < 0) errors.push('右边距不能为负数')
  
  // 检查边距是否过大（假设最大 500mm）
  const MAX_MARGIN = 500
  if (settings.top > MAX_MARGIN) errors.push(`上边距不能超过 ${MAX_MARGIN}mm`)
  if (settings.bottom > MAX_MARGIN) errors.push(`下边距不能超过 ${MAX_MARGIN}mm`)
  if (settings.left > MAX_MARGIN) errors.push(`左边距不能超过 ${MAX_MARGIN}mm`)
  if (settings.right > MAX_MARGIN) errors.push(`右边距不能超过 ${MAX_MARGIN}mm`)
  
  return {
    valid: errors.length === 0,
    errors: errors
  }
}

module.exports = {
  cropDocument,
  cropPdf,
  cropDocx,
  getPdfPageInfo,
  validateSettings,
  mmToPoints,
  pointsToMm,
  generatePdfPreview,
  getDocxPreview
}

/**
 * 生成 PDF 第一页的预览图像
 * @param {string} filePath - PDF 文件路径
 * @param {number} maxWidth - 最大宽度 (像素)，默认 400
 * @returns {Promise<{image: string, width: number, height: number, fileType: string}>}
 */
async function generatePdfPreview(filePath, maxWidth = 400) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }

  try {
    const { createCanvas } = require('canvas')
    const pdfjs = await getPdfjs()
    
    // 读取 PDF 文件
    const data = new Uint8Array(fs.readFileSync(filePath))
    const pdf = await pdfjs.getDocument({ data }).promise
    
    // 获取第一页
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.0 })
    
    // 计算缩放比例
    const scale = maxWidth / viewport.width
    const scaledViewport = page.getViewport({ scale })
    
    // 创建 canvas
    const canvas = createCanvas(scaledViewport.width, scaledViewport.height)
    const context = canvas.getContext('2d')
    
    // 渲染页面
    await page.render({
      canvasContext: context,
      viewport: scaledViewport
    }).promise
    
    // 转换为 base64
    const image = canvas.toDataURL('image/png')
    
    // 获取页面尺寸（毫米）
    const pageWidthMm = pointsToMm(viewport.width)
    const pageHeightMm = pointsToMm(viewport.height)
    
    return {
      image,
      width: pageWidthMm,
      height: pageHeightMm,
      fileType: 'pdf'
    }
  } catch (error) {
    throw new Error(`无法生成 PDF 预览: ${error.message}`)
  }
}

/**
 * 获取 DOCX 文档的页面尺寸和边距信息
 * @param {string} filePath - DOCX 文件路径
 * @returns {{widthMm: number, heightMm: number, margins: Object}}
 */
function getDocxPageInfo(filePath) {
  const AdmZip = require('adm-zip')
  const zip = new AdmZip(filePath)
  
  // 读取 document.xml 获取页面尺寸
  let documentXml = ''
  try {
    documentXml = zip.readAsText('word/document.xml')
  } catch (e) {
    throw new Error('无法读取文档内容')
  }
  
  // 默认 A4 尺寸 (twips)
  let widthTwips = 11906  // 210mm
  let heightTwips = 16838 // 297mm
  
  // 默认边距 (twips) - Word 默认边距约 1 inch = 1440 twips
  let topMargin = 1440
  let bottomMargin = 1440
  let headerDistance = 720  // 页眉距顶部
  let footerDistance = 720  // 页脚距底部
  
  // 尝试从 sectPr 中提取页面尺寸
  const pgSzMatch = documentXml.match(/<w:pgSz[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/)
  if (pgSzMatch) {
    widthTwips = parseInt(pgSzMatch[1], 10)
    heightTwips = parseInt(pgSzMatch[2], 10)
  } else {
    const pgSzMatch2 = documentXml.match(/<w:pgSz[^>]*w:h="(\d+)"[^>]*w:w="(\d+)"/)
    if (pgSzMatch2) {
      heightTwips = parseInt(pgSzMatch2[1], 10)
      widthTwips = parseInt(pgSzMatch2[2], 10)
    }
  }
  
  // 提取边距信息
  const pgMarMatch = documentXml.match(/<w:pgMar[^>]*>/)
  if (pgMarMatch) {
    const pgMarStr = pgMarMatch[0]
    const topMatch = pgMarStr.match(/w:top="(\d+)"/)
    const bottomMatch = pgMarStr.match(/w:bottom="(\d+)"/)
    const headerMatch = pgMarStr.match(/w:header="(\d+)"/)
    const footerMatch = pgMarStr.match(/w:footer="(\d+)"/)
    
    if (topMatch) topMargin = parseInt(topMatch[1], 10)
    if (bottomMatch) bottomMargin = parseInt(bottomMatch[1], 10)
    if (headerMatch) headerDistance = parseInt(headerMatch[1], 10)
    if (footerMatch) footerDistance = parseInt(footerMatch[1], 10)
  }
  
  // 转换 twips 为毫米
  const TWIPS_TO_MM = 25.4 / 1440
  return {
    widthMm: widthTwips * TWIPS_TO_MM,
    heightMm: heightTwips * TWIPS_TO_MM,
    margins: {
      topMm: topMargin * TWIPS_TO_MM,
      bottomMm: bottomMargin * TWIPS_TO_MM,
      headerMm: headerDistance * TWIPS_TO_MM,
      footerMm: footerDistance * TWIPS_TO_MM
    }
  }
}

/**
 * 提取 DOCX 的页眉页脚文本
 * @param {string} filePath - DOCX 文件路径
 * @returns {{headers: string[], footers: string[]}}
 */
function extractDocxHeadersFooters(filePath) {
  const AdmZip = require('adm-zip')
  const headers = []
  const footers = []
  
  try {
    const zip = new AdmZip(filePath)
    const zipEntries = zip.getEntries()
    
    for (const entry of zipEntries) {
      const name = entry.entryName
      
      // 页眉文件
      if (name.match(/word\/header\d*\.xml/)) {
        const content = zip.readAsText(entry)
        const text = extractTextFromDocxXml(content)
        if (text.trim()) {
          headers.push(text.trim())
        }
      }
      
      // 页脚文件
      if (name.match(/word\/footer\d*\.xml/)) {
        const content = zip.readAsText(entry)
        const text = extractTextFromDocxXml(content)
        if (text.trim()) {
          footers.push(text.trim())
        }
      }
    }
  } catch (error) {
    console.warn('提取页眉页脚失败:', error.message)
  }
  
  return { headers, footers }
}

/**
 * 从 DOCX XML 中提取文本
 * @param {string} xml - XML 字符串
 * @returns {string}
 */
function extractTextFromDocxXml(xml) {
  const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
  return textMatches.map(match => {
    const textMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/)
    return textMatch ? textMatch[1] : ''
  }).join('')
}

/**
 * 获取 DOCX 文档的预览
 * @param {string} filePath - DOCX 文件路径
 * @param {number} maxWidth - 最大宽度 (像素)，默认 400
 * @returns {Promise<{html: string, width: number, height: number, fileType: string, headers: string[], footers: string[], margins: Object}>}
 */
async function getDocxPreview(filePath, maxWidth = 400) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }

  try {
    // 获取页面尺寸和边距
    const { widthMm, heightMm, margins } = getDocxPageInfo(filePath)
    
    // 提取页眉页脚
    const { headers, footers } = extractDocxHeadersFooters(filePath)
    
    // 使用 mammoth 转换为 HTML
    const mammoth = require('mammoth')
    const result = await mammoth.convertToHtml({ path: filePath }, {
      convertImage: mammoth.images.imgElement(function(image) {
        return image.read("base64").then(function(imageBuffer) {
          return {
            src: "data:" + image.contentType + ";base64," + imageBuffer
          }
        })
      })
    })
    
    return {
      html: result.value,
      width: widthMm,
      height: heightMm,
      fileType: 'docx',
      headers: headers,
      footers: footers,
      margins: margins
    }
  } catch (error) {
    throw new Error(`无法获取 DOCX 预览: ${error.message}`)
  }
}
