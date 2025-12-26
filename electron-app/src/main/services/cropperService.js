/**
 * 文档裁剪服务
 * 支持调整 PDF 和 Word 文档的边距
 */

const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

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
  
  return outputPath
}

/**
 * 裁剪 Word 文档 (调整页边距)
 * 注意：这会修改文档的页边距设置，而不是真正的裁剪
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
  
  // docx 文件本质是 zip 文件
  const zip = new AdmZip(inputPath)
  
  // 读取 document.xml
  const documentXml = zip.readAsText('word/document.xml')
  
  // 读取或创建 settings.xml (包含页边距设置)
  let settingsXml = ''
  try {
    settingsXml = zip.readAsText('word/settings.xml')
  } catch (e) {
    // 如果没有 settings.xml，创建一个基本的
    settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:settings>'
  }
  
  // 转换毫米为 twips (1 inch = 1440 twips, 1 mm = 1440/25.4 ≈ 56.69 twips)
  const MM_TO_TWIPS = 1440 / 25.4
  const topTwips = Math.round((settings.top || 0) * MM_TO_TWIPS)
  const bottomTwips = Math.round((settings.bottom || 0) * MM_TO_TWIPS)
  const leftTwips = Math.round((settings.left || 0) * MM_TO_TWIPS)
  const rightTwips = Math.round((settings.right || 0) * MM_TO_TWIPS)
  
  // 修改 document.xml 中的页边距
  // 查找 <w:sectPr> 节点并修改 <w:pgMar>
  let modifiedDocXml = documentXml
  
  // 页边距标签
  const pgMarPattern = /<w:pgMar[^>]*\/>/g
  const newPgMar = `<w:pgMar w:top="${topTwips}" w:right="${rightTwips}" w:bottom="${bottomTwips}" w:left="${leftTwips}" w:header="720" w:footer="720" w:gutter="0"/>`
  
  if (pgMarPattern.test(modifiedDocXml)) {
    // 替换现有的页边距设置
    modifiedDocXml = modifiedDocXml.replace(pgMarPattern, newPgMar)
  } else {
    // 如果没有页边距设置，在 sectPr 中添加
    const sectPrPattern = /<w:sectPr[^>]*>/
    if (sectPrPattern.test(modifiedDocXml)) {
      modifiedDocXml = modifiedDocXml.replace(sectPrPattern, (match) => {
        return match + newPgMar
      })
    }
  }
  
  // 更新 zip 中的文件
  zip.updateFile('word/document.xml', Buffer.from(modifiedDocXml, 'utf-8'))
  
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // 保存修改后的文件
  zip.writeZip(outputPath)
  
  return outputPath
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
  pointsToMm
}
