/**
 * Word 文档解析服务
 * 使用 mammoth 库解析 .docx 文件
 * 支持表格结构提取
 */

const mammoth = require('mammoth')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

// ============================================
// 表格数据结构工厂函数
// ============================================

/**
 * 创建单元格对象
 * @param {Object} options - 单元格选项
 * @param {string} options.text - 单元格文本内容
 * @param {number} options.rowIndex - 行索引
 * @param {number} options.colIndex - 列索引
 * @param {number} [options.rowspan=1] - 行跨度
 * @param {number} [options.colspan=1] - 列跨度
 * @param {boolean} [options.isMerged=false] - 是否被其他单元格合并覆盖
 * @param {Array} [options.images=[]] - 单元格内的图片数组
 * @returns {Object} 单元格对象
 */
function createCell(options) {
  return {
    text: options.text || '',
    rowIndex: options.rowIndex,
    colIndex: options.colIndex,
    rowspan: options.rowspan || 1,
    colspan: options.colspan || 1,
    isMerged: options.isMerged || false,
    images: options.images || []
  }
}

/**
 * 创建行对象
 * @param {Object} options - 行选项
 * @param {number} options.index - 行索引
 * @param {Array} [options.cells=[]] - 单元格数组
 * @param {boolean} [options.isHeader=false] - 是否为表头行
 * @returns {Object} 行对象
 */
function createRow(options) {
  return {
    index: options.index,
    cells: options.cells || [],
    isHeader: options.isHeader || false
  }
}

/**
 * 创建表格对象
 * @param {Object} options - 表格选项
 * @param {number} options.position - 在文档中的位置索引
 * @param {number} [options.rowCount=0] - 行数
 * @param {number} [options.colCount=0] - 列数
 * @param {Array} [options.rows=[]] - 行数组
 * @returns {Object} 表格对象
 */
function createTable(options) {
  return {
    id: uuidv4(),
    position: options.position,
    rowCount: options.rowCount || 0,
    colCount: options.colCount || 0,
    rows: options.rows || [],
    html: ''
  }
}

/**
 * 创建内容块对象
 * @param {Object} options - 内容块选项
 * @param {string} options.type - 类型：'paragraph' 或 'table'
 * @param {number} options.index - 在文档中的顺序
 * @param {string|Object} options.content - 段落文本或表格对象
 * @returns {Object} 内容块对象
 */
function createContentBlock(options) {
  return {
    type: options.type,
    index: options.index,
    content: options.content
  }
}

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
  
  // 提取表格（新增）
  const tables = await extractTables(filePath)
  
  // 提取图片（新增）
  const images = await extractImages(filePath)
  
  // 构建有序内容块（新增）
  const contentBlocks = await buildContentBlocks(filePath)
  
  return {
    text,
    html,
    paragraphs,
    headers,
    footers,
    tables,           // 新增：表格数组
    images,           // 新增：图片数组
    contentBlocks,    // 新增：有序内容块
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
 * 解码 XML 实体
 * @param {string} text - 包含 XML 实体的文本
 * @returns {string} 解码后的文本
 */
function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * 从 XML 中提取文本内容
 * @param {string} xml - XML 字符串
 */
function extractTextFromXml(xml) {
  // 提取文本时需要处理：
  // 1. <w:t> 标签中的文本内容
  // 2. <w:tab/> 制表符 - 转换为制表符字符
  // 3. <w:br/> 换行符 - 转换为换行符
  
  // 先将制表符和换行符替换为占位符
  let processedXml = xml
    .replace(/<w:tab\s*\/>/g, '\t')  // 制表符
    .replace(/<w:br\s*\/>/g, '\n')   // 换行符
  
  // 匹配 <w:t> 标签中的文本（Word 文档的文本节点）
  const textMatches = processedXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
  const texts = textMatches.map(match => {
    const textMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/)
    return textMatch ? decodeXmlEntities(textMatch[1]) : ''
  })
  
  // 合并文本，保留制表符和换行符
  let result = ''
  let lastIndex = 0
  
  // 重新遍历，按顺序提取文本和特殊字符
  const tokenRegex = /<w:t[^>]*>([^<]*)<\/w:t>|(\t)|(\n)/g
  let match
  while ((match = tokenRegex.exec(processedXml)) !== null) {
    if (match[1] !== undefined) {
      // 文本内容
      result += decodeXmlEntities(match[1])
    } else if (match[2]) {
      // 制表符
      result += '\t'
    } else if (match[3]) {
      // 换行符
      result += '\n'
    }
  }
  
  return result
}

// ============================================
// 表格解析函数
// ============================================

/**
 * 从单元格 XML 中提取文本内容
 * 保留多段落分隔（段落之间用换行符分隔）
 * @param {string} cellXml - 单元格 XML 字符串
 * @returns {string} 单元格文本
 */
function extractCellText(cellXml) {
  // 匹配所有段落 <w:p>...</w:p>
  const paragraphRegex = /<w:p[^>]*>[\s\S]*?<\/w:p>/g
  const paragraphs = cellXml.match(paragraphRegex) || []
  
  const texts = paragraphs.map(pXml => {
    // 从段落中提取所有文本
    return extractTextFromXml(pXml)
  })
  
  // 用换行符连接多个段落
  return texts.filter(t => t).join('\n')
}

/**
 * 从单元格 XML 中提取完整内容（文本和图片）
 * @param {string} cellXml - 单元格 XML 字符串
 * @param {Object} imageRels - 图片关系映射 { rId: { target: 'word/media/xxx.png' } }
 * @param {Object} imageCache - 图片缓存 { 'word/media/xxx.png': { mimeType, base64, dataUrl } }
 * @returns {Object} { text: string, images: Array }
 */
function extractCellContent(cellXml, imageRels, imageCache) {
  // 提取文本
  const text = extractCellText(cellXml)
  
  // 提取图片
  const images = []
  const drawingRegex = /<w:drawing[^>]*>[\s\S]*?<\/w:drawing>/g
  let drawingMatch
  
  while ((drawingMatch = drawingRegex.exec(cellXml)) !== null) {
    const drawingXml = drawingMatch[0]
    
    // 提取图片引用 ID (r:embed="rIdX")
    const blipMatch = drawingXml.match(/r:embed="([^"]*)"/)
    if (blipMatch) {
      const rId = blipMatch[1]
      const imageRelInfo = imageRels[rId]
      
      if (imageRelInfo) {
        const imagePath = imageRelInfo.target
        const cachedImage = imageCache[imagePath]
        
        if (cachedImage) {
          images.push({
            id: uuidv4(),
            rId: rId,
            path: imagePath,
            mimeType: cachedImage.mimeType,
            base64: cachedImage.base64,
            dataUrl: cachedImage.dataUrl
          })
        }
      }
    }
  }
  
  return { text, images }
}

/**
 * 解析单元格的合并信息
 * @param {string} cellXml - 单元格 XML 字符串
 * @returns {Object} 合并信息 { colspan, vMergeType }
 */
function parseCellMergeInfo(cellXml) {
  let colspan = 1
  let vMergeType = null // null: 无合并, 'restart': 合并起始, 'continue': 被合并
  
  // 解析水平合并 <w:gridSpan w:val="N"/>
  const gridSpanMatch = cellXml.match(/<w:gridSpan\s+w:val="(\d+)"/)
  if (gridSpanMatch) {
    colspan = parseInt(gridSpanMatch[1], 10)
  }
  
  // 解析垂直合并 <w:vMerge .../>
  // <w:vMerge w:val="restart"/> 表示合并起始
  // <w:vMerge/> 或 <w:vMerge w:val="continue"/> 表示被合并
  const vMergeMatch = cellXml.match(/<w:vMerge(?:\s+w:val="([^"]*)")?[^>]*\/>/)
  if (vMergeMatch) {
    if (vMergeMatch[1] === 'restart') {
      vMergeType = 'restart'
    } else {
      vMergeType = 'continue'
    }
  }
  
  return { colspan, vMergeType }
}

/**
 * 解析单个表格 XML
 * @param {string} tableXml - 表格 XML 字符串
 * @param {number} position - 表格在文档中的位置索引
 * @param {Object} [imageRels={}] - 图片关系映射
 * @param {Object} [imageCache={}] - 图片缓存
 * @returns {Object} 表格对象
 */
function parseTableXml(tableXml, position, imageRels = {}, imageCache = {}) {
  // 获取列数（从 tblGrid 中）
  const gridColMatches = tableXml.match(/<w:gridCol[^>]*\/>/g) || []
  const colCount = gridColMatches.length
  
  // 解析所有行 <w:tr>...</w:tr>
  const rowRegex = /<w:tr[^>]*>[\s\S]*?<\/w:tr>/g
  const rowMatches = tableXml.match(rowRegex) || []
  
  const rows = []
  // 用于追踪垂直合并：vMergeTracker[colIndex] = { startRowIndex, rowspan }
  const vMergeTracker = {}
  
  rowMatches.forEach((rowXml, rowIndex) => {
    // 检查是否为表头行
    // 1. 检查 <w:tblHeader/> 标记
    // 2. 如果是第一行且包含粗体样式，也认为是表头
    let isHeader = /<w:tblHeader\s*\/>/.test(rowXml)
    
    // 启发式：第一行如果包含粗体文本，可能是表头
    if (!isHeader && rowIndex === 0) {
      // 检查是否有粗体样式 <w:b/> 或 <w:b w:val="true"/>
      isHeader = /<w:b(?:\s+w:val="(?:true|1)")?[^>]*\/>/.test(rowXml)
    }
    
    // 解析所有单元格 <w:tc>...</w:tc>
    const cellRegex = /<w:tc[^>]*>[\s\S]*?<\/w:tc>/g
    const cellMatches = rowXml.match(cellRegex) || []
    
    const cells = []
    let colIndex = 0
    
    cellMatches.forEach(cellXml => {
      // 跳过被垂直合并占用的列
      while (vMergeTracker[colIndex] && vMergeTracker[colIndex].endRow > rowIndex) {
        // 创建一个被合并的占位单元格
        cells.push(createCell({
          text: '',
          rowIndex,
          colIndex,
          rowspan: 1,
          colspan: 1,
          isMerged: true,
          images: []
        }))
        colIndex++
      }
      
      // 提取单元格内容（文本和图片）
      const { text, images } = extractCellContent(cellXml, imageRels, imageCache)
      
      // 解析合并信息
      const { colspan, vMergeType } = parseCellMergeInfo(cellXml)
      
      if (vMergeType === 'continue') {
        // 这是一个被垂直合并的单元格
        cells.push(createCell({
          text: '',
          rowIndex,
          colIndex,
          rowspan: 1,
          colspan,
          isMerged: true,
          images: []
        }))
        
        // 更新合并追踪器中的 rowspan
        for (let c = colIndex; c < colIndex + colspan; c++) {
          if (vMergeTracker[c]) {
            vMergeTracker[c].endRow = rowIndex + 1
          }
        }
      } else {
        // 普通单元格或垂直合并起始单元格
        const cell = createCell({
          text,
          rowIndex,
          colIndex,
          rowspan: 1, // 稍后计算
          colspan,
          isMerged: false,
          images
        })
        cells.push(cell)
        
        // 如果是垂直合并起始，初始化追踪器
        if (vMergeType === 'restart') {
          for (let c = colIndex; c < colIndex + colspan; c++) {
            vMergeTracker[c] = {
              startRowIndex: rowIndex,
              endRow: rowIndex + 1,
              cell: cell
            }
          }
        }
      }
      
      colIndex += colspan
    })
    
    // 填充剩余的被合并单元格
    while (colIndex < colCount) {
      if (vMergeTracker[colIndex] && vMergeTracker[colIndex].endRow > rowIndex) {
        cells.push(createCell({
          text: '',
          rowIndex,
          colIndex,
          rowspan: 1,
          colspan: 1,
          isMerged: true,
          images: []
        }))
      }
      colIndex++
    }
    
    rows.push(createRow({
      index: rowIndex,
      cells,
      isHeader
    }))
  })
  
  // 计算垂直合并的 rowspan
  for (const colIndex in vMergeTracker) {
    const tracker = vMergeTracker[colIndex]
    const rowspan = tracker.endRow - tracker.startRowIndex
    if (tracker.cell && rowspan > 1) {
      tracker.cell.rowspan = rowspan
    }
  }
  
  // 创建表格对象
  const table = createTable({
    position,
    rowCount: rows.length,
    colCount: colCount || (rows[0]?.cells.length || 0),
    rows
  })
  
  // 生成 HTML
  table.html = generateTableHtml(table)
  
  return table
}

/**
 * 生成表格的 HTML 表示
 * @param {Object} table - 表格对象
 * @returns {string} HTML 字符串
 */
function generateTableHtml(table) {
  let html = '<table border="1" cellpadding="4" cellspacing="0">\n'
  
  for (const row of table.rows) {
    html += row.isHeader ? '  <thead><tr>\n' : '  <tr>\n'
    
    for (const cell of row.cells) {
      // 跳过被合并的单元格
      if (cell.isMerged) continue
      
      const tag = row.isHeader ? 'th' : 'td'
      let attrs = ''
      
      if (cell.rowspan > 1) {
        attrs += ` rowspan="${cell.rowspan}"`
      }
      if (cell.colspan > 1) {
        attrs += ` colspan="${cell.colspan}"`
      }
      
      // 构建单元格内容
      let cellContent = ''
      
      // 添加图片
      if (cell.images && cell.images.length > 0) {
        for (const img of cell.images) {
          cellContent += `<img src="${img.dataUrl}" style="max-width: 200px; max-height: 150px;" />`
        }
      }
      
      // 添加文本（转义 HTML 特殊字符并保留换行）
      if (cell.text) {
        const escapedText = cell.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
        
        if (cellContent) {
          cellContent += '<br>' + escapedText
        } else {
          cellContent = escapedText
        }
      }
      
      html += `    <${tag}${attrs}>${cellContent}</${tag}>\n`
    }
    
    html += row.isHeader ? '  </tr></thead>\n' : '  </tr>\n'
  }
  
  html += '</table>'
  return html
}

/**
 * 从 DOCX 文件中提取所有表格
 * @param {string} filePath - DOCX 文件路径
 * @returns {Promise<Array>} 表格数组
 */
async function extractTables(filePath) {
  const tables = []
  
  try {
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(filePath)
    
    // 读取 word/document.xml
    const documentEntry = zip.getEntry('word/document.xml')
    if (!documentEntry) {
      console.warn('未找到 word/document.xml')
      return tables
    }
    
    const documentXml = zip.readAsText(documentEntry)
    
    // 读取并解析图片关系映射
    const relsEntry = zip.getEntry('word/_rels/document.xml.rels')
    let imageRels = {}
    let oleRels = {}
    
    if (relsEntry) {
      const relsXml = zip.readAsText(relsEntry)
      const rels = parseRelationships(relsXml)
      imageRels = rels.imageRels
      oleRels = rels.oleRels
    }
    
    // 构建被 OLE 对象引用的文件路径集合
    const oleTargets = new Set(Object.values(oleRels).map(r => r.target))
    
    // 预加载所有真实图片
    const imageCache = {}
    const zipEntries = zip.getEntries()
    for (const entry of zipEntries) {
      if (entry.entryName.startsWith('word/media/')) {
        const ext = path.extname(entry.entryName).toLowerCase()
        
        // 跳过 OLE 预览图格式
        if (isOlePreviewFormat(ext)) continue
        // 跳过不支持的格式
        if (!isSupportedImageFormat(ext)) continue
        // 跳过被 OLE 对象引用的文件
        if (oleTargets.has(entry.entryName)) continue
        
        const mimeTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.bmp': 'image/bmp',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml'
        }
        const mimeType = mimeTypes[ext] || 'image/png'
        const imageData = zip.readFile(entry)
        const base64 = imageData.toString('base64')
        imageCache[entry.entryName] = {
          mimeType,
          base64,
          dataUrl: `data:${mimeType};base64,${base64}`
        }
      }
    }
    
    // 查找所有表格 <w:tbl>...</w:tbl>
    const tableRegex = /<w:tbl[^>]*>[\s\S]*?<\/w:tbl>/g
    let match
    let position = 0
    
    while ((match = tableRegex.exec(documentXml)) !== null) {
      const tableXml = match[0]
      const table = parseTableXml(tableXml, position, imageRels, imageCache)
      tables.push(table)
      position++
    }
  } catch (error) {
    console.warn('提取表格失败:', error.message)
  }
  
  return tables
}

/**
 * 构建有序的内容块列表
 * 按文档顺序返回段落、表格和图片的混合列表
 * 注意：表格内的图片和段落不会被重复提取
 * @param {string} filePath - DOCX 文件路径
 * @returns {Promise<Array>} 内容块数组
 */
async function buildContentBlocks(filePath) {
  const contentBlocks = []
  
  try {
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(filePath)
    
    // 读取 word/document.xml
    const documentEntry = zip.getEntry('word/document.xml')
    if (!documentEntry) {
      console.warn('未找到 word/document.xml')
      return contentBlocks
    }
    
    const documentXml = zip.readAsText(documentEntry)
    
    // 提取 <w:body> 内容
    const bodyMatch = documentXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/)
    if (!bodyMatch) {
      console.warn('未找到 w:body 元素')
      return contentBlocks
    }
    
    const bodyXml = bodyMatch[1]
    
    // 读取并解析图片关系映射（区分真实图片和 OLE 对象）
    const relsEntry = zip.getEntry('word/_rels/document.xml.rels')
    let imageRels = {}
    let oleRels = {}
    
    if (relsEntry) {
      const relsXml = zip.readAsText(relsEntry)
      const rels = parseRelationships(relsXml)
      imageRels = rels.imageRels
      oleRels = rels.oleRels
    }
    
    // 构建被 OLE 对象引用的文件路径集合
    const oleTargets = new Set(Object.values(oleRels).map(r => r.target))
    
    // 预加载所有真实图片（过滤 OLE 预览图）
    const imageCache = {}
    const zipEntries = zip.getEntries()
    for (const entry of zipEntries) {
      if (entry.entryName.startsWith('word/media/')) {
        const ext = path.extname(entry.entryName).toLowerCase()
        
        // 跳过 OLE 预览图格式（EMF/WMF）
        if (isOlePreviewFormat(ext)) continue
        // 跳过不支持的格式
        if (!isSupportedImageFormat(ext)) continue
        // 跳过被 OLE 对象引用的文件
        if (oleTargets.has(entry.entryName)) continue
        
        const mimeTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.bmp': 'image/bmp',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml'
        }
        const mimeType = mimeTypes[ext] || 'image/png'
        const imageData = zip.readFile(entry)
        const base64 = imageData.toString('base64')
        imageCache[entry.entryName] = {
          mimeType,
          base64,
          dataUrl: `data:${mimeType};base64,${base64}`
        }
      }
    }
    
    // 第一步：找出所有表格的位置范围
    const tableRanges = []
    const tableRegex = /<w:tbl[^>]*>[\s\S]*?<\/w:tbl>/g
    let tableMatch
    while ((tableMatch = tableRegex.exec(bodyXml)) !== null) {
      tableRanges.push({
        start: tableMatch.index,
        end: tableMatch.index + tableMatch[0].length,
        xml: tableMatch[0]
      })
    }
    
    // 辅助函数：检查位置是否在任何表格范围内
    function isInsideTable(position) {
      for (const range of tableRanges) {
        if (position >= range.start && position < range.end) {
          return true
        }
      }
      return false
    }
    
    // 第二步：收集所有顶层元素（表格和不在表格内的图片）
    const elements = []
    
    // 添加表格
    for (const range of tableRanges) {
      elements.push({
        type: 'table',
        start: range.start,
        end: range.end,
        xml: range.xml
      })
    }
    
    // 添加不在表格内的图片
    const drawingRegex = /<w:drawing[^>]*>[\s\S]*?<\/w:drawing>/g
    let drawingMatch
    while ((drawingMatch = drawingRegex.exec(bodyXml)) !== null) {
      const drawingXml = drawingMatch[0]
      const drawingStart = drawingMatch.index
      
      // 跳过表格内的图片（图片已在表格单元格中处理）
      if (isInsideTable(drawingStart)) {
        continue
      }
      
      // 检查是否在 w:object 标签内（OLE 对象的预览图）
      const beforeDrawing = bodyXml.substring(Math.max(0, drawingStart - 200), drawingStart)
      if (beforeDrawing.includes('<w:object') && !beforeDrawing.includes('</w:object>')) {
        continue
      }
      
      // 提取图片引用 ID
      const blipMatch = drawingXml.match(/r:embed="([^"]*)"/)
      if (blipMatch) {
        const rId = blipMatch[1]
        
        // 跳过 OLE 对象引用
        if (oleRels[rId]) continue
        
        const imageRelInfo = imageRels[rId]
        if (imageRelInfo) {
          const imagePath = imageRelInfo.target
          if (imageCache[imagePath]) {
            elements.push({
              type: 'image',
              start: drawingStart,
              end: drawingStart + drawingXml.length,
              rId: rId,
              imagePath: imagePath,
              imageData: imageCache[imagePath]
            })
          }
        }
      }
    }
    
    // 按位置排序
    elements.sort((a, b) => a.start - b.start)
    
    // 第三步：构建内容块，跳过表格范围内的段落
    let index = 0
    let tableIndex = 0
    let imageIndex = 0
    let lastIndex = 0
    
    for (const element of elements) {
      // 处理元素之前的段落（排除表格内的段落）
      const beforeXml = bodyXml.substring(lastIndex, element.start)
      const paragraphsBefore = extractParagraphsFromXmlExcludingTables(beforeXml, tableRanges, lastIndex)
      
      for (const pText of paragraphsBefore) {
        if (pText.trim()) {
          contentBlocks.push(createContentBlock({
            type: 'paragraph',
            index: index++,
            content: pText.trim()
          }))
        }
      }
      
      // 处理元素
      if (element.type === 'table') {
        const table = parseTableXml(element.xml, tableIndex++, imageRels, imageCache)
        contentBlocks.push(createContentBlock({
          type: 'table',
          index: index++,
          content: table
        }))
      } else if (element.type === 'image') {
        contentBlocks.push(createContentBlock({
          type: 'image',
          index: index++,
          content: {
            id: uuidv4(),
            position: imageIndex++,
            ...element.imageData
          }
        }))
      }
      
      lastIndex = element.end
    }
    
    // 处理最后一个元素之后的段落
    const afterXml = bodyXml.substring(lastIndex)
    const paragraphsAfter = extractParagraphsFromXmlExcludingTables(afterXml, tableRanges, lastIndex)
    
    for (const pText of paragraphsAfter) {
      if (pText.trim()) {
        contentBlocks.push(createContentBlock({
          type: 'paragraph',
          index: index++,
          content: pText.trim()
        }))
      }
    }
  } catch (error) {
    console.warn('构建内容块失败:', error.message)
  }
  
  return contentBlocks
}

/**
 * 从 XML 片段中提取段落文本，排除表格内的段落
 * @param {string} xml - XML 片段
 * @param {Array} tableRanges - 表格位置范围数组
 * @param {number} baseOffset - XML 片段在原始文档中的起始偏移
 * @returns {Array<string>} 段落文本数组
 */
function extractParagraphsFromXmlExcludingTables(xml, tableRanges, baseOffset) {
  const paragraphs = []
  const paragraphRegex = /<w:p[^>]*>[\s\S]*?<\/w:p>/g
  let match
  
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const pXml = match[0]
    const absolutePosition = baseOffset + match.index
    
    // 检查段落是否在表格范围内
    let insideTable = false
    for (const range of tableRanges) {
      if (absolutePosition >= range.start && absolutePosition < range.end) {
        insideTable = true
        break
      }
    }
    
    // 只提取不在表格内的段落
    if (!insideTable) {
      const text = extractTextFromXml(pXml)
      paragraphs.push(text)
    }
  }
  
  return paragraphs
}

// ============================================
// 图片提取函数
// ============================================

/**
 * 解析关系文件，区分真正的图片和 OLE 对象
 * @param {string} relsXml - 关系文件 XML 内容
 * @returns {Object} { imageRels, oleRels } 图片和 OLE 对象的关系映射
 */
function parseRelationships(relsXml) {
  const imageRels = {}  // 真正的图片
  const oleRels = {}    // OLE 对象（包括 MathType 公式）
  
  // 关系类型常量
  const IMAGE_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
  const OLE_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject'
  const PACKAGE_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/package'
  
  // 通用正则匹配所有 Relationship
  const relRegex = /<Relationship[^>]+>/gi
  let match
  
  while ((match = relRegex.exec(relsXml)) !== null) {
    const relTag = match[0]
    
    // 提取属性
    const idMatch = relTag.match(/Id="([^"]*)"/)
    const targetMatch = relTag.match(/Target="([^"]*)"/)
    const typeMatch = relTag.match(/Type="([^"]*)"/)
    
    if (!idMatch || !targetMatch || !typeMatch) continue
    
    const id = idMatch[1]
    const target = targetMatch[1].replace(/^\.\.\//, 'word/').replace(/^media\//, 'word/media/')
    const type = typeMatch[1]
    
    // 根据类型分类
    if (type === IMAGE_TYPE || type.includes('/image')) {
      imageRels[id] = {
        target,
        type: 'image'
      }
    } else if (type === OLE_TYPE || type === PACKAGE_TYPE || type.includes('/oleObject') || type.includes('/package')) {
      oleRels[id] = {
        target,
        type: 'ole'
      }
    }
  }
  
  return { imageRels, oleRels }
}

/**
 * 检查文件扩展名是否为支持的图片格式
 * 过滤掉 EMF/WMF 等通常用于 OLE 对象预览的格式
 * @param {string} ext - 文件扩展名（小写，带点）
 * @returns {boolean} 是否为支持的图片格式
 */
function isSupportedImageFormat(ext) {
  // 支持的真实图片格式
  const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg']
  return supportedFormats.includes(ext)
}

/**
 * 检查文件扩展名是否为 OLE 预览图格式
 * @param {string} ext - 文件扩展名（小写，带点）
 * @returns {boolean} 是否为 OLE 预览图格式
 */
function isOlePreviewFormat(ext) {
  // EMF/WMF 通常是 OLE 对象（如 MathType 公式）的预览图
  const olePreviewFormats = ['.emf', '.wmf', '.tiff', '.tif']
  return olePreviewFormats.includes(ext)
}

/**
 * 从 DOCX 文件中提取所有图片
 * 通过关系类型和文件格式双重过滤，排除 OLE 对象预览图
 * @param {string} filePath - DOCX 文件路径
 * @returns {Promise<Array>} 图片数组
 */
async function extractImages(filePath) {
  const images = []
  
  try {
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(filePath)
    const zipEntries = zip.getEntries()
    
    // 读取并解析关系文件
    const relsEntry = zip.getEntry('word/_rels/document.xml.rels')
    let imageRels = {}
    let oleRels = {}
    
    if (relsEntry) {
      const relsXml = zip.readAsText(relsEntry)
      const rels = parseRelationships(relsXml)
      imageRels = rels.imageRels
      oleRels = rels.oleRels
    }
    
    // 构建被 OLE 对象引用的文件路径集合
    const oleTargets = new Set(Object.values(oleRels).map(r => r.target))
    
    // 构建被真实图片关系引用的文件路径集合
    const imageTargets = new Set(Object.values(imageRels).map(r => r.target))
    
    // 提取 word/media/ 目录下的图片
    let position = 0
    for (const entry of zipEntries) {
      const name = entry.entryName
      
      if (name.startsWith('word/media/')) {
        const ext = path.extname(name).toLowerCase()
        
        // 过滤条件：
        // 1. 必须是支持的图片格式（排除 EMF/WMF）
        // 2. 不能是 OLE 对象的目标文件
        // 3. 如果是 EMF/WMF 格式，即使在 imageRels 中也要排除（可能是公式预览图）
        
        if (isOlePreviewFormat(ext)) {
          // EMF/WMF 格式直接跳过，这些通常是 OLE 对象预览图
          console.log(`跳过 OLE 预览图格式: ${name}`)
          continue
        }
        
        if (!isSupportedImageFormat(ext)) {
          // 不支持的格式跳过
          console.log(`跳过不支持的图片格式: ${name}`)
          continue
        }
        
        if (oleTargets.has(name)) {
          // 被 OLE 对象引用的文件跳过
          console.log(`跳过 OLE 对象引用的文件: ${name}`)
          continue
        }
        
        const mimeTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.bmp': 'image/bmp',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml'
        }
        
        const mimeType = mimeTypes[ext] || 'image/png'
        const imageData = zip.readFile(entry)
        const base64 = imageData.toString('base64')
        
        images.push({
          id: uuidv4(),
          position: position++,
          fileName: path.basename(name),
          path: name,
          mimeType: mimeType,
          base64: base64,
          dataUrl: `data:${mimeType};base64,${base64}`
        })
      }
    }
  } catch (error) {
    console.warn('提取图片失败:', error.message)
  }
  
  return images
}

/**
 * 从文档 XML 中获取图片在文档中的位置信息
 * @param {string} documentXml - 文档 XML
 * @returns {Array} 图片位置信息数组
 */
function getImagePositionsFromXml(documentXml) {
  const positions = []
  
  // 匹配图片引用 <a:blip r:embed="rId..."/>
  const blipRegex = /<a:blip[^>]*r:embed="([^"]*)"[^>]*\/>/g
  let match
  let index = 0
  
  while ((match = blipRegex.exec(documentXml)) !== null) {
    positions.push({
      rId: match[1],
      xmlIndex: match.index,
      index: index++
    })
  }
  
  return positions
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
  isSupported,
  // 表格数据结构工厂函数
  createCell,
  createRow,
  createTable,
  createContentBlock,
  // 表格解析函数
  extractTables,
  parseTableXml,
  extractCellText,
  extractCellContent,
  parseCellMergeInfo,
  generateTableHtml,
  buildContentBlocks,
  extractParagraphsFromXmlExcludingTables,
  // 图片提取函数
  extractImages,
  getImagePositionsFromXml,
  // 关系解析函数
  parseRelationships,
  isSupportedImageFormat,
  isOlePreviewFormat,
  // XML 工具函数
  decodeXmlEntities,
  extractTextFromXml
}
