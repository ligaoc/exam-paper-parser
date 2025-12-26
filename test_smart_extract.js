/**
 * 测试智能层级识别功能
 */

const path = require('path')

// 直接引用模块
const docxParser = require('./electron-app/src/main/services/docxParserService')
const structureExtractor = require('./electron-app/src/main/services/structureExtractorService')

const filePath = './2022年广东省广州市中考化学真题（原卷版）.docx'

async function test() {
  console.log('='.repeat(60))
  console.log('测试智能层级识别')
  console.log('='.repeat(60))
  
  try {
    // 解析文档
    console.log('\n正在解析文档...')
    const result = await docxParser.parse(filePath)
    
    console.log(`\n文档解析完成:`)
    console.log(`  - 段落数: ${result.paragraphs.length}`)
    console.log(`  - 带样式段落数: ${result.styledParagraphs?.length || 0}`)
    
    if (!result.styledParagraphs || result.styledParagraphs.length === 0) {
      console.log('\n错误: 未能提取带样式的段落')
      return
    }
    
    // 使用智能识别
    console.log('\n正在进行智能层级识别...')
    const { questions, levelMapping } = structureExtractor.extractWithStyles(result.styledParagraphs)
    
    console.log(`\n识别到 ${questions.length} 个顶级题目`)
    
    // 显示级别映射
    console.log('\n【级别映射】')
    Object.entries(levelMapping).forEach(([key, info]) => {
      console.log(`  ${key} → 基础级别 ${info.baseLevel}, 子级别数 ${info.subLevels}`)
    })
    
    // 显示题目结构
    console.log('\n【题目结构】')
    
    function printQuestion(q, indent = 0) {
      const prefix = '  '.repeat(indent)
      const boldMark = q.isBold ? '[粗体]' : ''
      const scoreMark = q.score ? `(${q.score}分)` : ''
      console.log(`${prefix}[级别${q.level}] ${q.number} ${q.content.substring(0, 40)}... ${boldMark} ${scoreMark}`)
      
      if (q.children && q.children.length > 0) {
        q.children.forEach(child => printQuestion(child, indent + 1))
      }
    }
    
    questions.forEach(q => printQuestion(q))
    
    // 统计各级别数量
    console.log('\n【级别统计】')
    const levelStats = {}
    
    function countLevels(q) {
      levelStats[q.level] = (levelStats[q.level] || 0) + 1
      if (q.children) {
        q.children.forEach(countLevels)
      }
    }
    
    questions.forEach(countLevels)
    Object.entries(levelStats)
      .sort((a, b) => a[0] - b[0])
      .forEach(([level, count]) => {
        console.log(`  级别 ${level}: ${count} 个题目`)
      })
    
  } catch (error) {
    console.error('测试失败:', error)
  }
}

test()
