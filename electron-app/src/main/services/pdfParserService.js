/**
 * PDF 文档解析服务
 * 使用 pdf-parse 库解析文字型 PDF 文件
 */

const pdfParse = require('pdf-parse')
const fs = require('fs')
const path = require('path')

/**
 * 解析 PDF 文档
 * @param {string} filePath - 文档路径
 * @returns {Promise<{text: string, pages: Array, metadata: Object}>}
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
  
  // 读取文件
  const dataBuffer = fs.readFileSync(filePath)
  
  // 解析 PDF
  const data = await pdfParse(dataBuffer, {
    // 自定义页面渲染函数，用于获取每页内容
    pagerender: renderPage
  })
  
  // 解析每页内容
  const pages = parsePages(data.text, data.numpages)
  
  return {
    text: data.text,
    pages: pages,
    metadata: {
      numPages: data.numpages,
      info: data.info,
      version: data.version
    }
  }
}

/**
 * 自定义页面渲染函数
 * @param {Object} pageData - 页面数据
 */
async function renderPage(pageData) {
  const textContent = await pageData.getTextContent()
  const strings = textContent.items.map(item => item.str)
  return strings.join(' ')
}

/**
 * 将文本按页分割
 * @param {string} text - 完整文本
 * @param {number} numPages - 页数
 */
function parsePages(text, numPages) {
  // pdf-parse 返回的文本通常用换页符分隔
  // 但这不是100%可靠，这里做简单处理
  const pages = []
  
  // 尝试按换页符分割
  const pageTexts = text.split('\f')
  
  if (pageTexts.length === numPages) {
    pageTexts.forEach((pageText, index) => {
      pages.push({
        pageNumber: index + 1,
        text: pageText.trim()
      })
    })
  } else {
    // 如果分割不准确，将所有内容作为一页
    pages.push({
      pageNumber: 1,
      text: text.trim()
    })
  }
  
  return pages
}

/**
 * 获取 PDF 页数
 * @param {string} filePath - 文档路径
 */
async function getPageCount(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }
  
  const dataBuffer = fs.readFileSync(filePath)
  const data = await pdfParse(dataBuffer)
  
  return data.numpages
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
 * 通过检查提取的文本长度来判断
 * @param {string} filePath - 文档路径
 */
async function isTextBased(filePath) {
  try {
    const result = await parse(filePath)
    // 如果提取的文本很少，可能是扫描件
    const textLength = result.text.replace(/\s/g, '').length
    const avgCharsPerPage = textLength / result.metadata.numPages
    
    // 假设每页至少有100个字符才算文字型PDF
    return avgCharsPerPage > 100
  } catch (error) {
    return false
  }
}

module.exports = {
  parse,
  getPageCount,
  isSupported,
  isTextBased
}
