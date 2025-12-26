/**
 * 分析 DOCX 文件的样式结构
 * 检查是否使用了 Word 的标题样式、大纲级别等
 */

const AdmZip = require('./electron-app/node_modules/adm-zip')
const path = require('path')

const filePath = './2022年广东省广州市中考化学真题（原卷版）.docx'

async function analyzeDocx() {
  console.log('='.repeat(60))
  console.log('分析文件:', filePath)
  console.log('='.repeat(60))
  
  const zip = new AdmZip(filePath)
  
  // 1. 先看 styles.xml - 文档定义的样式
  console.log('\n【1. 文档样式定义 (styles.xml)】\n')
  const stylesEntry = zip.getEntry('word/styles.xml')
  if (stylesEntry) {
    const stylesXml = zip.readAsText(stylesEntry)
    
    // 提取所有样式定义
    const styleRegex = /<w:style[^>]*w:styleId="([^"]*)"[^>]*>[\s\S]*?<\/w:style>/g
    let match
    const styles = []
    
    while ((match = styleRegex.exec(stylesXml)) !== null) {
      const styleXml = match[0]
      const styleId = match[1]
      
      // 提取样式名称
      const nameMatch = styleXml.match(/<w:name\s+w:val="([^"]*)"/)
      const name = nameMatch ? nameMatch[1] : '未命名'
      
      // 提取样式类型
      const typeMatch = styleXml.match(/w:type="([^"]*)"/)
      const type = typeMatch ? typeMatch[1] : 'unknown'
      
      // 检查大纲级别
      const outlineLvlMatch = styleXml.match(/<w:outlineLvl\s+w:val="(\d+)"/)
      const outlineLevel = outlineLvlMatch ? parseInt(outlineLvlMatch[1]) : null
      
      // 检查是否基于其他样式
      const basedOnMatch = styleXml.match(/<w:basedOn\s+w:val="([^"]*)"/)
      const basedOn = basedOnMatch ? basedOnMatch[1] : null
      
      if (type === 'paragraph') {
        styles.push({ styleId, name, type, outlineLevel, basedOn })
      }
    }
    
    console.log('段落样式列表:')
    styles.forEach(s => {
      let info = `  - ${s.styleId}: "${s.name}"`
      if (s.outlineLevel !== null) info += ` [大纲级别: ${s.outlineLevel}]`
      if (s.basedOn) info += ` (基于: ${s.basedOn})`
      console.log(info)
    })
  }
  
  // 2. 分析 document.xml - 实际内容的样式使用
  console.log('\n【2. 文档内容样式使用 (document.xml)】\n')
  const documentEntry = zip.getEntry('word/document.xml')
  if (documentEntry) {
    const documentXml = zip.readAsText(documentEntry)
    
    // 提取所有段落及其样式
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g
    let pMatch
    const paragraphStyles = {}
    const paragraphsWithStyle = []
    let paragraphCount = 0
    
    while ((pMatch = paragraphRegex.exec(documentXml)) !== null) {
      paragraphCount++
      const pXml = pMatch[0]
      
      // 提取段落样式
      const pStyleMatch = pXml.match(/<w:pStyle\s+w:val="([^"]*)"/)
      const pStyle = pStyleMatch ? pStyleMatch[1] : null
      
      // 提取大纲级别（直接在段落属性中）
      const outlineLvlMatch = pXml.match(/<w:outlineLvl\s+w:val="(\d+)"/)
      const outlineLevel = outlineLvlMatch ? parseInt(outlineLvlMatch[1]) : null
      
      // 提取段落文本
      const textMatches = pXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
      const text = textMatches.map(t => {
        const m = t.match(/<w:t[^>]*>([^<]*)<\/w:t>/)
        return m ? m[1] : ''
      }).join('')
      
      // 提取字体大小
      const szMatch = pXml.match(/<w:sz\s+w:val="(\d+)"/)
      const fontSize = szMatch ? parseInt(szMatch[1]) / 2 : null // Word 用半点
      
      // 检查是否粗体
      const isBold = /<w:b(?:\s|\/|>)/.test(pXml) && !/<w:b\s+w:val="(?:false|0)"/.test(pXml)
      
      if (pStyle) {
        paragraphStyles[pStyle] = (paragraphStyles[pStyle] || 0) + 1
      }
      
      // 只记录前30个有内容的段落
      if (text.trim() && paragraphsWithStyle.length < 30) {
        paragraphsWithStyle.push({
          index: paragraphCount,
          style: pStyle,
          outlineLevel,
          fontSize,
          isBold,
          text: text.substring(0, 50) + (text.length > 50 ? '...' : '')
        })
      }
    }
    
    console.log(`总段落数: ${paragraphCount}`)
    console.log('\n使用的段落样式统计:')
    Object.entries(paragraphStyles)
      .sort((a, b) => b[1] - a[1])
      .forEach(([style, count]) => {
        console.log(`  - ${style}: ${count} 次`)
      })
    
    // 统计字号分布
    const fontSizeStats = {}
    const allParagraphs = []
    
    // 重新遍历获取所有段落的字号
    paragraphRegex.lastIndex = 0
    while ((pMatch = paragraphRegex.exec(documentXml)) !== null) {
      const pXml = pMatch[0]
      const szMatch = pXml.match(/<w:sz\s+w:val="(\d+)"/)
      const fontSize = szMatch ? parseInt(szMatch[1]) / 2 : null
      const isBold = /<w:b(?:\s|\/|>)/.test(pXml) && !/<w:b\s+w:val="(?:false|0)"/.test(pXml)
      
      const textMatches = pXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
      const text = textMatches.map(t => {
        const m = t.match(/<w:t[^>]*>([^<]*)<\/w:t>/)
        return m ? m[1] : ''
      }).join('')
      
      if (text.trim()) {
        const key = `${fontSize || '默认'}pt${isBold ? '+粗体' : ''}`
        fontSizeStats[key] = (fontSizeStats[key] || 0) + 1
        
        // 检测是否有题号
        const hasQuestionNum = /^[一二三四五六七八九十]+[、．.]|^\d+[.．、]|^[（(]\d+[)）]|^[①②③④⑤⑥⑦⑧⑨⑩]/.test(text.trim())
        
        if (hasQuestionNum && allParagraphs.length < 50) {
          allParagraphs.push({
            fontSize: fontSize || '默认',
            isBold,
            text: text.substring(0, 60) + (text.length > 60 ? '...' : '')
          })
        }
      }
    }
    
    console.log('\n字号分布统计:')
    Object.entries(fontSizeStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([size, count]) => {
        console.log(`  ${size}: ${count} 个段落`)
      })
    
    // 新方案：按字号分组，然后按题号格式细分
    console.log('\n【新方案：字号优先 + 格式细分】\n')
    
    // 定义题号格式及其优先级（同字号内的子级别）
    const questionPatterns = [
      { name: '中文数字', regex: /^[一二三四五六七八九十]+[、．.]/, subLevel: 0 },
      { name: '阿拉伯数字', regex: /^\d+[.．、]\s*/, subLevel: 1 },
      { name: '中文括号数字', regex: /^（\d+）/, subLevel: 2 },
      { name: '英文括号数字', regex: /^\(\d+\)/, subLevel: 2 },
      { name: '圈数字', regex: /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/, subLevel: 3 },
      { name: '小写字母', regex: /^[a-z][.．)）]/, subLevel: 4 },
    ]
    
    // 收集所有带题号的段落
    const questionsWithFormat = []
    paragraphRegex.lastIndex = 0
    while ((pMatch = paragraphRegex.exec(documentXml)) !== null) {
      const pXml = pMatch[0]
      const szMatch = pXml.match(/<w:sz\s+w:val="(\d+)"/)
      const fontSize = szMatch ? parseInt(szMatch[1]) / 2 : 10.5 // 默认字号约10.5pt
      const isBold = /<w:b(?:\s|\/|>)/.test(pXml) && !/<w:b\s+w:val="(?:false|0)"/.test(pXml)
      
      const textMatches = pXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
      const text = textMatches.map(t => {
        const m = t.match(/<w:t[^>]*>([^<]*)<\/w:t>/)
        return m ? m[1] : ''
      }).join('').trim()
      
      if (!text) continue
      
      // 检测题号格式
      for (const pattern of questionPatterns) {
        if (pattern.regex.test(text)) {
          questionsWithFormat.push({
            fontSize,
            isBold,
            formatName: pattern.name,
            subLevel: pattern.subLevel,
            text: text.substring(0, 50) + (text.length > 50 ? '...' : '')
          })
          break
        }
      }
    }
    
    // 按字号分组
    const fontSizeGroups = {}
    questionsWithFormat.forEach(q => {
      const key = `${q.fontSize}${q.isBold ? '+粗体' : ''}`
      if (!fontSizeGroups[key]) {
        fontSizeGroups[key] = { fontSize: q.fontSize, isBold: q.isBold, items: [] }
      }
      fontSizeGroups[key].items.push(q)
    })
    
    // 按字号从大到小排序
    const sortedGroups = Object.values(fontSizeGroups).sort((a, b) => {
      if (a.isBold !== b.isBold) return b.isBold ? 1 : -1 // 粗体优先
      return b.fontSize - a.fontSize // 字号大的优先
    })
    
    // 计算最终级别
    let baseLevel = 1
    sortedGroups.forEach(group => {
      // 统计该字号下的格式分布
      const formatStats = {}
      group.items.forEach(item => {
        formatStats[item.formatName] = (formatStats[item.formatName] || 0) + 1
      })
      
      console.log(`字号 ${group.fontSize}pt${group.isBold ? '+粗体' : ''} → 基础级别 ${baseLevel}`)
      console.log(`  格式分布: ${JSON.stringify(formatStats)}`)
      
      // 显示该组的题目示例
      const shown = new Set()
      group.items.forEach(item => {
        if (!shown.has(item.formatName)) {
          shown.add(item.formatName)
          const finalLevel = baseLevel + item.subLevel
          console.log(`  → ${item.formatName} = 级别${finalLevel}: "${item.text}"`)
        }
      })
      
      // 计算下一组的基础级别
      const maxSubLevel = Math.max(...group.items.map(i => i.subLevel))
      baseLevel += maxSubLevel + 1
      console.log('')
    })
  }
  
  // 3. 检查编号定义 (numbering.xml)
  console.log('\n【3. 编号/列表定义 (numbering.xml)】\n')
  const numberingEntry = zip.getEntry('word/numbering.xml')
  if (numberingEntry) {
    const numberingXml = zip.readAsText(numberingEntry)
    
    // 检查抽象编号定义
    const abstractNumRegex = /<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>[\s\S]*?<\/w:abstractNum>/g
    let numMatch
    let abstractNumCount = 0
    
    while ((numMatch = abstractNumRegex.exec(numberingXml)) !== null) {
      abstractNumCount++
      const numXml = numMatch[0]
      const numId = numMatch[1]
      
      // 提取各级别的编号格式
      const lvlRegex = /<w:lvl\s+w:ilvl="(\d+)"[^>]*>[\s\S]*?<\/w:lvl>/g
      let lvlMatch
      const levels = []
      
      while ((lvlMatch = lvlRegex.exec(numXml)) !== null) {
        const lvlXml = lvlMatch[0]
        const ilvl = lvlMatch[1]
        
        // 编号格式
        const numFmtMatch = lvlXml.match(/<w:numFmt\s+w:val="([^"]*)"/)
        const numFmt = numFmtMatch ? numFmtMatch[1] : 'unknown'
        
        // 编号文本
        const lvlTextMatch = lvlXml.match(/<w:lvlText\s+w:val="([^"]*)"/)
        const lvlText = lvlTextMatch ? lvlTextMatch[1] : ''
        
        levels.push({ ilvl, numFmt, lvlText })
      }
      
      if (levels.length > 0) {
        console.log(`  抽象编号 ${numId}:`)
        levels.forEach(l => {
          console.log(`    级别${l.ilvl}: 格式=${l.numFmt}, 文本="${l.lvlText}"`)
        })
      }
    }
    
    console.log(`\n共定义了 ${abstractNumCount} 个抽象编号`)
  } else {
    console.log('  未找到 numbering.xml - 文档没有使用 Word 的列表/编号功能')
  }
  
  // 4. 总结
  console.log('\n' + '='.repeat(60))
  console.log('【分析结论】')
  console.log('='.repeat(60))
}

analyzeDocx().catch(console.error)
