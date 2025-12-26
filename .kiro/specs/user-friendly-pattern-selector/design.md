# Design Document: User-Friendly Pattern Selector

## Overview

本设计将规则管理界面中的正则表达式输入改为下拉选择方式。核心思路：
1. 建立一个通用的模式库，模式不绑定特定级别
2. 用户可以为任意级别选择任意模式
3. 支持动态添加/删除题号级别

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      RuleManager.vue                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  题号级别配置区                                              ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ 一级题号  [PatternSelector] [删除级别]                  │││
│  │  │ 二级题号  [PatternSelector] [删除级别]                  │││
│  │  │ 三级题号  [PatternSelector] [删除级别]                  │││
│  │  │ [+ 添加级别]                                            │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │  分数模式   [PatternSelector]                               ││
│  │  括号模式   [PatternSelector]                               ││
│  │  下划线模式 [PatternSelector]                               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PatternSelector.vue (新组件)                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [下拉选择框: 选择模式 ▼]                                   ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ 已选模式:                                               │││
│  │  │ [中文数字+顿号 (一、二、三)] [×]                        │││
│  │  │ [阿拉伯数字+点号 (1. 2. 3.)] [×]                        │││
│  │  │ [自定义: ^[甲乙丙丁]+、] [×]                            │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │  [+ 添加自定义模式]                                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  patternPresets.js (新文件)                      │
│  - 通用模式预设 (不绑定级别)                                     │
│  - 分数模式预设                                                  │
│  - 括号/下划线模式预设                                           │
│  - 正则到预设的反向映射                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. PatternPresets 模块

新建 `electron-app/src/renderer/utils/patternPresets.js`：

```javascript
// 预设模式数据结构
interface PatternPreset {
  id: string;           // 唯一标识符
  label: string;        // 用户友好的标签
  regex: string;        // 对应的正则表达式
  examples: string[];   // 匹配示例
  category: string;     // 类别: 'question' | 'score' | 'bracket' | 'underline'
}

// 导出函数
function getQuestionPresets(): PatternPreset[]      // 获取题号模式预设
function getScorePresets(): PatternPreset[]         // 获取分数模式预设
function getBracketPresets(): PatternPreset[]       // 获取括号模式预设
function getUnderlinePresets(): PatternPreset[]     // 获取下划线模式预设
function findPresetByRegex(regex: string): PatternPreset | null
function validateRegex(pattern: string): boolean
```

### 2. PatternSelector 组件

新建 `electron-app/src/renderer/components/PatternSelector.vue`：

```vue
Props:
  - modelValue: string[]        // 当前选中的正则表达式数组
  - category: string            // 模式类别: 'question' | 'score' | 'bracket' | 'underline'
  - allowCustom: boolean        // 是否允许自定义模式 (默认 true)

Emits:
  - update:modelValue           // 更新选中的模式

Computed:
  - availablePresets            // 根据 category 获取可用预设
  - selectedItems               // 将 modelValue 转换为显示项 (预设或自定义)
```

### 3. RuleManager 组件更新

更新数据结构以支持动态级别：

```javascript
// 原结构
patterns: {
  level1: [],
  level2: [],
  level3: [],
  score: [],
  bracket: [],
  underline: []
}

// 新结构
patterns: {
  levels: [
    { name: '一级题号', patterns: [] },
    { name: '二级题号', patterns: [] },
    { name: '三级题号', patterns: [] }
  ],
  score: [],
  bracket: [],
  underline: []
}
```

## Data Models

### PatternPreset 数据结构

```javascript
{
  id: 'chinese_dun',
  label: '中文数字+顿号',
  regex: '^[一二三四五六七八九十]+[、]',
  examples: ['一、', '二、', '三、', '十、'],
  category: 'question'
}
```

### 题号模式预设完整列表

| ID | 标签 | 正则 | 示例 |
|---|---|---|---|
| chinese_dun | 中文数字+顿号 | `^[一二三四五六七八九十]+[、]` | 一、二、三、 |
| chinese_dot | 中文数字+点号 | `^[一二三四五六七八九十]+[．.]` | 一．二．三． |
| arabic_dun | 阿拉伯数字+顿号 | `^\d+[、]` | 1、2、3、 |
| arabic_dot | 阿拉伯数字+点号 | `^\d+[.．]` | 1. 2. 3. |
| arabic_paren_half | 阿拉伯数字+半角括号 | `^[(]\d+[)]` | (1) (2) (3) |
| arabic_paren_full | 阿拉伯数字+全角括号 | `^[（]\d+[）]` | （1）（2）（3） |
| circle_number | 圈数字 | `^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]` | ①②③④⑤ |
| letter_dot | 小写字母+点号 | `^[a-z][.．]` | a. b. c. |
| letter_paren | 小写字母+括号 | `^[a-z][)]` | a) b) c) |
| roman | 罗马数字 | `^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[、．.]?` | Ⅰ、Ⅱ、Ⅲ、 |

### 分数模式预设

| ID | 标签 | 正则 | 示例 |
|---|---|---|---|
| score_bracket | 括号内分数 | `[（(【\[]\s*(\d+)\s*分\s*[)）\]】]` | (5分) （10分） |
| score_total | 共X分格式 | `共\s*(\d+)\s*分` | 共5分 共10分 |
| score_simple | 简单分数 | `(\d+)\s*分` | 5分 10分 |

### 括号模式预设

| ID | 标签 | 正则 | 示例 |
|---|---|---|---|
| bracket_round | 圆括号 | `[（(][^)）]*[)）]` | (答案) （内容） |
| bracket_square | 方括号 | `[【\[][^\]】]*[\]】]` | [答案] 【内容】 |

### 下划线模式预设

| ID | 标签 | 正则 | 示例 |
|---|---|---|---|
| underline_underscore | 下划线 | `_{2,}` | ____ |
| underline_dash | 破折号 | `—{2,}` | ———— |

### 规则数据结构（更新后）

```javascript
// 存储结构 (保持向后兼容)
{
  id: 'rule-uuid',
  name: '规则名称',
  description: '描述',
  patterns: {
    levels: [
      { name: '一级题号', patterns: ['^[一二三四五六七八九十]+[、]'] },
      { name: '二级题号', patterns: ['^\d+[.．]', '^[(]\d+[)]'] },
      { name: '三级题号', patterns: ['^[a-z][.．]'] }
    ],
    score: ['[（(【\[]\s*(\d+)\s*分\s*[)）\]】]'],
    bracket: ['[（(][^)）]*[)）]'],
    underline: ['_{2,}']
  },
  isDefault: false,
  createdAt: '...',
  updatedAt: '...'
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Preset Data Completeness

*For any* pattern preset in the system, it must contain all required fields: id (non-empty string), label (non-empty string), regex (non-empty string), examples (non-empty array of strings), and category (one of 'question', 'score', 'bracket', 'underline').

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Preset Regex Validity

*For any* pattern preset, its regex field must be a valid JavaScript regular expression that can be compiled without errors using `new RegExp(regex)`.

**Validates: Requirements 2.2**

### Property 3: Regex-to-Preset Round Trip

*For any* pattern preset, calling `findPresetByRegex(preset.regex)` must return a preset with the same id.

**Validates: Requirements 6.1, 6.2**

### Property 4: Unknown Regex Returns Null

*For any* regex string that is not in the preset library, `findPresetByRegex(regex)` must return null.

**Validates: Requirements 6.3**

### Property 5: Regex Validation Function

*For any* valid JavaScript regex string, `validateRegex(regex)` must return true. *For any* invalid regex string (e.g., unclosed brackets), `validateRegex(regex)` must return false.

**Validates: Requirements 7.3**

### Property 6: Level Management Constraints

*For any* rule configuration, the levels array must contain at least 1 level. Adding a level increases the count by 1. Removing a level decreases the count by 1 (unless only 1 level remains).

**Validates: Requirements 4.1, 4.2**

### Property 7: New Level Initialization

*For any* newly added level, its patterns array must be empty (length 0).

**Validates: Requirements 4.3**

## Error Handling

### Invalid Regex Input
- 当用户输入自定义正则时，使用 `validateRegex()` 验证
- 无效正则显示错误提示："正则表达式格式错误"
- 不允许保存无效的正则

### Missing Preset Match
- 加载已有规则时，如果正则不匹配任何预设
- 显示为"自定义: [正则表达式]"
- 不影响规则的正常使用

### Minimum Level Constraint
- 尝试删除最后一个级别时，显示提示："至少需要保留一个题号级别"
- 删除按钮在只剩一个级别时禁用

### Empty Pattern List
- 允许某个级别没有选中任何模式
- 保存时该级别的模式数组为空

## Testing Strategy

### Unit Tests
- 测试每个预设的数据完整性
- 测试特定预设是否存在（如必须有"中文数字+顿号"选项）
- 测试正则验证函数的边界情况
- 测试级别添加/删除的边界情况

### Property-Based Tests
使用 fast-check 库进行属性测试：

1. **Preset Completeness Property**: 遍历所有预设，验证所有字段存在且有效
2. **Regex Validity Property**: 对所有预设的 regex 字段尝试编译
3. **Round Trip Property**: 对所有预设，验证 findPresetByRegex 能找回自己
4. **Unknown Regex Property**: 生成随机字符串，验证不匹配时返回 null
5. **Validation Property**: 生成有效和无效的正则字符串，验证验证函数行为
6. **Level Management Property**: 测试添加/删除级别的约束
7. **New Level Property**: 测试新级别初始化为空

### Test Configuration
- 每个属性测试运行至少 100 次迭代
- 使用 vitest 作为测试框架
- 使用 fast-check 作为属性测试库

## Migration Strategy

### 数据迁移

旧数据结构：
```javascript
patterns: {
  level1: [...],
  level2: [...],
  level3: [...],
  score: [...],
  bracket: [...],
  underline: []
}
```

新数据结构：
```javascript
patterns: {
  levels: [
    { name: '一级题号', patterns: [...] },
    { name: '二级题号', patterns: [...] },
    { name: '三级题号', patterns: [...] }
  ],
  score: [...],
  bracket: [...],
  underline: []
}
```

### 迁移逻辑

在 `ruleEngineService.js` 中添加迁移函数：

```javascript
function migratePatterns(oldPatterns) {
  // 如果已经是新格式，直接返回
  if (oldPatterns.levels) {
    return oldPatterns
  }
  
  // 转换旧格式到新格式
  return {
    levels: [
      { name: '一级题号', patterns: oldPatterns.level1 || [] },
      { name: '二级题号', patterns: oldPatterns.level2 || [] },
      { name: '三级题号', patterns: oldPatterns.level3 || [] }
    ],
    score: oldPatterns.score || [],
    bracket: oldPatterns.bracket || [],
    underline: oldPatterns.underline || []
  }
}
```

在加载规则时自动迁移，保存时使用新格式。
