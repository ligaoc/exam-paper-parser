/**
 * Word 文档解析服务
 * 使用 mammoth 库解析 .docx 文件
 */

const mammoth = require('mammoth')
const fs = require('fs')
const path = require('path')

/**
 * 解析 Word 文档
 * @param {string} filePath - 文档路径
 * @returns {Promise<{text: string, paragraphs: Array, headers: Array, footers: Array}>}
 */
async function parse(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }
  
  // 检查文件格式
  if (ext !== '.docx' && ext !== '.doc') {
    throw new Error(`不支持的文件格式: ${ext}`)
  }
  
  // .doc 文件需要特殊处理（mammoth 只支持 .docx）
  if (ext === '.doc') {
    // 尝试直接用 mammoth 解析，某些 .doc 文件可能兼容
    // 如果失败，提示用户转换格式
    try {
      return await parseDocx(filePath)
    } catch (error) {
      throw new Error('无法解析 .doc 文件，请将其转换为 .docx 格式后重试')
    }
  }
  
  return await parseDocx(filePath)
}

/**
 * 解析 .docx 文件
 * @param {string} filePath - 文档路径
 */
async function parseDocx(filePath) {
  // 提取纯文本
  const textResult = await mammoth.extractRawText({ path: filePath })
  const text = textResult.value
  
  // 提取带样式的内容（用于识别标题等）
  const htmlResult = await mammoth.convertToHtml({ path: filePath })
  const html = htmlResult.value
  
  // 解析段落
  const paragraphs = parseParagraphs(text)
  
  // 尝试提取页眉页脚（mammoth 对页眉页脚支持有限）
  const { headers, footers } = await extractHeadersFooters(filePath)
  
  return {
    text,
    html,
    paragraphs,
    headers,
    footers,
    messages: textResult.messages.concat(htmlResult.messages)
  }
}

/**
 * 解析文本为段落数组
 * @param {string} text - 文档文本
 */
function parseParagraphs(text) {
  const lines = text.split('\n')
  const paragraphs = []
  
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed) {
      paragraphs.push({
        index,
        text: trimmed,
        original: line
      })
    }
  })
  
  return paragraphs
}

/**
 * 提取页眉页脚
 * mammoth 不直接支持页眉页脚，这里使用 JSZip 直接读取 docx 内部结构
 * @param {string} filePath - 文档路径
 */
async function extractHeadersFooters(filePath) {
  const headers = []
  const footers = []
  
  try {
    // docx 文件本质是 zip 文件
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(filePath)
    const zipEntries = zip.getEntries()
    
    for (const entry of zipEntries) {
      const name = entry.entryName
      
      // 页眉文件: word/header1.xml, word/header2.xml, etc.
      if (name.match(/word\/header\d*\.xml/)) {
        const content = zip.readAsText(entry)
        const text = extractTextFromXml(content)
        if (text.trim()) {
          headers.push(text.trim())
        }
      }
      
      // 页脚文件: word/footer1.xml, word/footer2.xml, etc.
      if (name.match(/word\/footer\d*\.xml/)) {
        const content = zip.readAsText(entry)
        const text = extractTextFromXml(content)
        if (text.trim()) {
          footers.push(text.trim())
        }
      }
    }
  } catch (error) {
    // 如果提取失败，返回空数组（不影响主要功能）
    console.warn('提取页眉页脚失败:', error.message)
  }
  
  return { headers, footers }
}

/**
 * 从 XML 中提取文本内容
 * @param {string} xml - XML 字符串
 */
function extractTextFromXml(xml) {
  // 简单的文本提取：移除所有 XML 标签
  // 匹配 <w:t> 标签中的文本（Word 文档的文本节点）
  const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
  const texts = textMatches.map(match => {
    const textMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/)
    return textMatch ? textMatch[1] : ''
  })
  
  return texts.join('')
}

/**
 * 检查文件是否为支持的 Word 格式
 * @param {string} filePath - 文件路径
 */
function isSupported(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.docx' || ext === '.doc'
}

module.exports = {
  parse,
  parseDocx,
  parseParagraphs,
  extractHeadersFooters,
  isSupported
}
