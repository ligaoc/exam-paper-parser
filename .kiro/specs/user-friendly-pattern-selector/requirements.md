# Requirements Document

## Introduction

本功能旨在改进规则管理界面中的模式配置体验。当前系统要求用户直接输入正则表达式来定义题号识别模式，这对于不熟悉正则表达式的普通用户来说过于复杂。

核心改进思路：
1. 提供一个通用的"匹配模式库"，包含各种常见的题号格式（如"中文数字+顿号"、"阿拉伯数字+点号"等）
2. 用户可以为任意级别选择任意模式（同一个模式可以用于一级、二级或三级）
3. 允许用户自定义题号级别数量（不限于固定的三级）

## Glossary

- **Pattern_Selector**: 模式选择器组件，提供下拉选择界面让用户选择预定义的匹配模式
- **Pattern_Preset**: 预设模式，包含用户友好的描述和对应的正则表达式，不绑定特定级别
- **Pattern_Library**: 模式库，存储所有可用的预设模式
- **Question_Level**: 题号级别，用户可自定义的层级（如一级、二级、三级等）
- **Rule_Engine**: 规则引擎服务，管理识别规则的创建、更新和应用
- **Score_Pattern**: 分数模式，用于匹配分值标记

## Requirements

### Requirement 1: 通用模式库

**User Story:** 作为系统管理员，我希望系统提供一套通用的预定义模式，这些模式不绑定特定级别，用户可以自由分配到任意级别。

#### Acceptance Criteria

1. THE Pattern_Library SHALL provide predefined pattern presets that are not bound to any specific level
2. WHEN displaying a pattern preset, THE Pattern_Selector SHALL show a user-friendly label describing what the pattern matches (e.g., "中文数字+顿号（一、二、三）")
3. WHEN displaying a pattern preset, THE Pattern_Selector SHALL show example matches to help users understand the pattern
4. THE Pattern_Preset SHALL contain the display label, example matches, and the corresponding regex pattern

### Requirement 2: 题号模式预设

**User Story:** 作为用户，我希望能从预设列表中选择常见的题号格式，而不是手动编写正则表达式。

#### Acceptance Criteria

1. THE Pattern_Library SHALL provide the following question number presets:
   - 中文数字+顿号（一、二、三、...）
   - 中文数字+点号（一．二．三．...）
   - 阿拉伯数字+顿号（1、2、3、...）
   - 阿拉伯数字+点号（1. 2. 3. ...）
   - 阿拉伯数字+半角括号（(1) (2) (3) ...）
   - 阿拉伯数字+全角括号（（1）（2）（3）...）
   - 圈数字（①②③④⑤...）
   - 小写字母+点号（a. b. c. ...）
   - 小写字母+括号（a) b) c) ...）
   - 罗马数字（Ⅰ、Ⅱ、Ⅲ、...）
2. WHEN a user selects a preset, THE Pattern_Selector SHALL use the corresponding regex pattern for matching

### Requirement 3: 下拉选择界面

**User Story:** 作为普通用户，我希望通过下拉菜单选择模式，而不是手动输入正则表达式。

#### Acceptance Criteria

1. WHEN a user configures a question level, THE Pattern_Selector SHALL display a dropdown/select interface with all available presets
2. WHEN a user selects a preset from the dropdown, THE Pattern_Selector SHALL add that pattern to the level's pattern list
3. WHEN displaying selected patterns, THE Pattern_Selector SHALL show the user-friendly label and examples, not the raw regex
4. WHEN a user wants to remove a pattern, THE Pattern_Selector SHALL provide a delete button for each selected pattern
5. THE Pattern_Selector SHALL allow multiple patterns to be selected for each level

### Requirement 4: 自定义级别数量

**User Story:** 作为用户，我希望能自定义题号级别的数量，以便适应不同试卷的结构。

#### Acceptance Criteria

1. THE Rule_Manager SHALL allow users to add new question levels beyond the default three levels
2. THE Rule_Manager SHALL allow users to remove question levels (minimum one level required)
3. WHEN a new level is added, THE Rule_Manager SHALL provide an empty pattern list for that level
4. THE Rule_Manager SHALL display levels in order (一级、二级、三级、四级...)

### Requirement 5: 分数和其他模式预设

**User Story:** 作为用户，我希望能选择常见的分数标记和其他辅助模式。

#### Acceptance Criteria

1. THE Pattern_Library SHALL provide the following score presets:
   - 括号内分数（(5分)、（10分）、[5分]、【10分】）
   - 共X分格式（共5分、共10分）
   - 简单分数格式（5分、10分）
2. THE Pattern_Library SHALL provide bracket and underline presets for fill-in-the-blank detection

### Requirement 6: 数据兼容性

**User Story:** 作为系统管理员，我希望新的选择方式与现有数据兼容。

#### Acceptance Criteria

1. WHEN loading existing rules with raw regex patterns, THE Pattern_Selector SHALL attempt to match them to known presets
2. IF an existing regex pattern matches a known preset, THEN THE Pattern_Selector SHALL display the user-friendly label
3. IF an existing regex pattern does not match any preset, THEN THE Pattern_Selector SHALL display it as "自定义模式" with the regex shown
4. WHEN saving rules, THE Rule_Engine SHALL store the actual regex patterns for backward compatibility

### Requirement 7: 自定义模式输入

**User Story:** 作为高级用户，我希望在需要时仍能添加自定义正则表达式。

#### Acceptance Criteria

1. THE Pattern_Selector SHALL provide an "添加自定义模式" option
2. WHEN a user chooses to add a custom pattern, THE Pattern_Selector SHALL display a text input for entering regex
3. WHEN a custom regex is entered, THE Pattern_Selector SHALL validate it and show an error if invalid
4. THE Pattern_Selector SHALL clearly distinguish custom patterns from preset patterns in the UI
