# changle.me 技术分析文档

> 最后更新：2026-02-13  
> 项目类型：双人共享虚拟猫咪互动网站  
> 在线地址：https://changle.me

---

## 一、项目概览

这是一个面向情侣（源宝 & 咪宝）的虚拟猫咪（Yian喵）养成网站。所有数据通过 Firebase Realtime Database 实时同步，支持双人同时在线互动。站点托管在 GitHub Pages，AI 聊天通过 Cloudflare Worker 代理调用 Claude API。

### 核心用户旅程

```
输入暗号 → 进入主页 → 与Yian喵互动（喂食/抚摸/玩耍）
                     → 查看恋爱面板/运势/任务/留言板
                     → 和Yian喵群聊（AI对话）
                     → 发送悄悄话给对方
```

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | 原生 HTML/CSS/JS | 无框架，单页应用 |
| **数据库** | Firebase Realtime Database | 亚太东南1区（asia-southeast1） |
| **AI代理** | Cloudflare Worker | 自定义域名 `api.changle.me` |
| **AI模型** | Claude Opus 4.5 | 通过 `zhongzhuan.win` 中转 |
| **托管** | GitHub Pages | 自定义域名 `changle.me` |
| **版本控制** | Git + GitHub | `Infinity1037/Infinity1037.github.io` |

---

## 三、文件结构

```
changle.me/
├── index.html              # 23KB - 页面结构（所有HTML）
├── script.js               # 137KB - 全部业务逻辑（~3270行）
├── style.css               # 73KB - 全部样式
├── cloudflare-worker.js    # 2.7KB - AI代理Worker代码
├── CNAME                   # 自定义域名配置
├── FIREBASE_SECURITY.md    # Firebase安全规则说明
├── README.md               # 项目简介
└── profile/                # 头像资源
    ├── yuan.jpg             # 源宝头像
    └── mi.jpg               # 咪宝头像
```

---

## 四、代码架构（script.js 模块划分）

整个应用被包裹在一个 IIFE `(function() { ... })()` 中，避免全局污染。

### 模块索引

| 行号范围 | 模块 | 职责 |
|----------|------|------|
| 1-22 | Firebase 配置 | 初始化 Firebase，声明所有 ref |
| 24-92 | 授权码验证 | SHA-256 哈希验证暗号 |
| 94-145 | 游戏设置 | 常量定义（属性值、食物、对话库） |
| 146-191 | DOM 缓存 | `cacheDOM()` 一次性缓存所有 DOM 元素 |
| 204-248 | 时间更新 | 时钟显示 + 主题自动切换 |
| 250-368 | 每日运势 | 抽签系统（Firebase transaction 保证并发安全） |
| 370-453 | 接鱼小游戏 | 随机生成可点击的鱼 |
| 455-511 | 成就徽章 | 14个成就，基于互动次数/签到/等级 |
| 513-567 | 随机事件 | 15%概率触发，60秒冷却 |
| 569-692 | 每日任务 | 种子随机选3个任务，localStorage 记录进度 |
| 694-777 | 双人互动 | 检测对方操作，显示toast+爱心涟漪 |
| 779-878 | 留言板 | 实时监听15条，限30字，5秒冷却 |
| 881-930 | 在线指示器 | `presence` 节点实现 |
| 932-1000 | 悄悄话信箱 | 单向消息，已读标记 |
| 1002-1044 | 睡眠模式 | 23:00-05:00自动睡眠 + 梦话 |
| 1046-1258 | 猫咪显示 | 等级、签到、属性条、表情、气泡 |
| 1261-1308 | 粒子特效 | emoji粒子系统，最多36个同屏 |
| 1310-1477 | 喂食/抚摸/玩耍 | 核心互动，含食物菜单、冷却、combo |
| 1479-1622 | Firebase 同步 | 状态同步+衰减+本地缓存 |
| 1624-1647 | 浮动装饰 | 可爱emoji缓缓上浮 |
| 1649-1700 | Yian喵小日记 | 基于当日状态生成日记 |
| 1702-1829 | 情侣功能 | 恋爱天数 + 里程碑 + 情话打字机 |
| 1831-1893 | 双人连击 | 30秒内双人操作触发彩蛋 |
| 1895-1936 | 摇一摇撸猫 | DeviceMotion API |
| 1938-1984 | 天气动画 | 白天云朵/夜晚星星 |
| 1986-2073 | 猫咪装扮 | 9种配饰，等级解锁 |
| 2075-2250 | 节日系统 | 公历+农历节日，覆盖2025-2028 |
| 2252-2472 | 主初始化 | `initApp()` 绑定所有事件和定时器 |
| 2474-2623 | 底部导航面板 | 面板开关 + 右滑关闭手势 |
| 2625-2678 | 工具函数 | 振动、可见性优化、键盘适配、返回键 |
| 2679-3232 | AI聊天模块 | 多会话群聊 + 流式AI回复 |
| 3234-3272 | 页面启动 | DOMContentLoaded 入口 |

---

## 五、Firebase 数据结构

```
shared-cat-default-rtdb/
├── auth/
│   └── codeHash: string (64位SHA-256)
├── catV2/
│   ├── hunger: number (0-100)
│   ├── mood: number (0-100)
│   ├── energy: number (0-100)
│   ├── lastUpdate: timestamp
│   ├── totalFeeds: number
│   ├── totalPets: number
│   ├── totalPlays: number
│   ├── streak: number
│   ├── lastVisitDate: string (YYYY-MM-DD)
│   └── accessory: string (配饰ID)
├── messages/
│   └── {pushId}/
│       ├── text: string (<=30字)
│       └── time: timestamp
├── dailyFortune/
│   └── {YYYY-MM-DD}/
│       ├── level: string
│       ├── msg: string
│       ├── color: string
│       └── bonus: { hunger?, mood?, energy? }
├── recentActions/
│   └── {pushId}/
│       ├── type: string (feed|pet|play)
│       ├── sid: string (session ID)
│       └── time: timestamp
├── whisper/
│   └── {pushId}/
│       ├── text: string
│       ├── from: string (session ID)
│       ├── time: timestamp
│       └── read: boolean
├── presence/
│   └── {sessionId}/
│       ├── online: boolean
│       └── lastSeen: timestamp
└── aiGroupSessions/
    └── {pushId}/
        ├── createdBy: string (源宝|咪宝)
        ├── createdAt: timestamp
        ├── lastMsg: string (<=30字预览)
        ├── lastTs: timestamp
        └── messages/
            └── {pushId}/
                ├── role: string (user|assistant)
                ├── content: string
                ├── sender: string (源宝|咪宝|Yian喵)
                └── ts: timestamp
```

### Firebase Rules（当前）

```json
{
  "rules": {
    "catV2": { ".read": true, ".write": true, /* 含字段验证 */ },
    "auth": { ".read": true, ".write": "!data.exists()" },
    "messages": { ".read": true, "$messageId": { ".write": true, /* 含验证 */ } },
    "dailyFortune": { ".read": true, "$date": { ".write": "!data.exists()" } },
    "recentActions": { ".read": true, "$actionId": { ".write": true } },
    "whisper": { ".read": true, ".write": true },
    "presence": { ".read": true, ".write": true },
    "aiGroupSessions": { ".read": true, ".write": true }
  }
}
```

---

## 六、AI 聊天架构

### 数据流

```
用户输入 → saveMessage(Firebase) → requestAiReply()
                                      ↓
                                fetchWithTimeout(30s)
                                      ↓
                            Cloudflare Worker (api.changle.me)
                                      ↓ (25s timeout)
                            zhongzhuan.win (中转API)
                                      ↓
                            Claude Opus 4.5 (aws.amazon)
                                      ↓ (SSE stream)
                            Worker 流式转发 → 前端逐字渲染
                                      ↓
                            saveMessage(Firebase) ← 完整回复
```

### 关键参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `AI_MODEL` | `aws.amazon/claude-opus-4-5:once` | 模型标识 |
| `AI_MAX_CONTEXT` | 50 | 上下文消息数（实际取 50*2=100 条再裁剪） |
| `AI_MAX_MESSAGES` | 100 | 每次加载的最大消息数 |
| `AI_TIMEOUT` | 30000ms | 前端超时 |
| Worker 超时 | 25000ms | Worker 上游请求超时 |
| `max_tokens` | 300（上限500） | Worker 限制最大输出 |
| `temperature` | 0.8 | 回复随机性 |

### 系统提示词包含的实时数据

每次发送消息时实时采集，不缓存：

1. 当前时间 + 时段描述
2. 饱食度/心情值/活力值 + 语义描述
3. 猫咪等级 (Lv.1-10)
4. 睡眠状态 + 睡眠时间段
5. 当前配饰名称
6. 恋爱天数
7. 连续签到天数
8. 累计喂食/摸摸/玩耍次数
9. 对方在线状态（DOM读取）
10. 今日运势（localStorage）
11. 每日任务进度 (X/3)
12. 已解锁成就列表
13. 最近3条留言板内容（DOM读取）
14. 网站主题（清晨/午后/傍晚/夜晚）

---

## 七、状态管理机制

### 属性衰减

| 属性 | 每小时衰减 | 最低值保护 |
|------|-----------|-----------|
| 饱食度 (hunger) | -6 | 5 |
| 心情值 (mood) | -4 | 5 |
| 活力值 (energy) | -3 | 5 |

衰减发生在两个地方：
1. **Firebase `on('value')`**：每次数据更新时根据 `lastUpdate` 计算衰减量
2. **本地 `localDecay()`**：每60秒检查一次，补充离线期间的衰减

### 数据同步策略

```
Firebase Realtime DB (权威源)
         ↕ on('value') 监听
       catState (内存)
         ↕ saveToLocalStorage()
       localStorage (离线缓存)
```

- 写操作：先更新 `catState` → 更新 UI → `saveToLocalStorage()` → `catRef.update()`
- 读操作：Firebase 优先，8秒超时后降级到 localStorage

### 用户标识

没有登录系统。用 `localStorage` 生成随机 `sessionId`（8位随机字符串），用于：
- 区分在线状态（presence）
- 区分悄悄话发送方
- 区分双人互动的操作来源
- **不用于** AI聊天身份（聊天身份通过手动选择 源宝/咪宝）

---

## 八、性能优化

### 已实现

1. **DOM 缓存** — `cacheDOM()` 启动时一次性缓存所有高频 DOM 元素
2. **页面可见性** — `document.hidden` 时停止浮动装饰生成
3. **粒子数量限制** — 同屏最多36个粒子
4. **鱼数量限制** — 同屏最多2条鱼
5. **Firebase 预连接** — `<link rel="preconnect">` 
6. **CSS/JS 版本号** — `?v=20260213h` 强制缓存刷新
7. **defer 加载** — Firebase SDK 和 script.js 都用 `defer`
8. **操作冷却** — 喂食/抚摸/玩耍 300ms 冷却
9. **徽章渲染优化** — HTML 字符串比对，无变化不重渲染
10. **iOS 键盘适配** — `visualViewport` API 动态调整

### 可优化方向

1. **script.js 体积** — 137KB 单文件，可考虑代码分割或压缩
2. **CSS 体积** — 73KB 单文件，有大量未使用的旧样式
3. **Firebase 监听器过多** — catV2、messages、fortune、actions、whisper、presence 共6个实时监听
4. **图片资源** — 头像无 WebP/压缩优化
5. **Service Worker** — 未实现离线缓存/PWA

---

## 九、安全分析

### 当前安全状况

| 项目 | 状态 | 风险等级 |
|------|------|---------|
| API Key 暴露 | ✅ 安全（存在 Worker 环境变量） | 低 |
| Firebase API Key | ⚠️ 前端可见（但这是正常的） | 低 |
| Firebase Rules | ⚠️ 部分节点过于宽松 | 中 |
| 授权码验证 | ✅ SHA-256 哈希比对 | 低 |
| CORS | ✅ Worker 配置了 CORS | 低 |

### Firebase Rules 改进建议

当前 `whisper`、`presence`、`aiGroupSessions` 都是完全开放读写，建议：
- 对 `aiGroupSessions` 添加消息长度验证
- 对 `whisper` 添加文本长度限制
- 对 `presence` 添加数据格式验证

---

## 十、功能完整清单

### 核心功能

| # | 功能 | 状态 | 数据源 |
|---|------|------|--------|
| 1 | 暗号验证 | ✅ | Firebase `auth` |
| 2 | Yian喵互动（喂食/抚摸/玩耍） | ✅ | Firebase `catV2` |
| 3 | 属性系统（饱食/心情/活力） | ✅ | Firebase `catV2` |
| 4 | 等级系统 (Lv.1-10) | ✅ | 计算值 |
| 5 | 睡眠模式 (23:00-05:00) | ✅ | 时间判断 |
| 6 | 连续签到 | ✅ | Firebase transaction |
| 7 | 食物菜单（5种，等级解锁） | ✅ | localStorage |
| 8 | 猫咪装扮（9种配饰） | ✅ | Firebase `catV2/accessory` |

### 社交功能

| # | 功能 | 状态 | 数据源 |
|---|------|------|--------|
| 9 | TA在线指示器 | ✅ | Firebase `presence` |
| 10 | 留言板（30字限制，5秒冷却） | ✅ | Firebase `messages` |
| 11 | 悄悄话信箱 | ✅ | Firebase `whisper` |
| 12 | 双人互动提示（对方操作可见） | ✅ | Firebase `recentActions` |
| 13 | 双人连击彩蛋 | ✅ | Firebase `recentActions` |

### 日常系统

| # | 功能 | 状态 | 数据源 |
|---|------|------|--------|
| 14 | 每日运势抽签 | ✅ | Firebase `dailyFortune` |
| 15 | 每日任务（3个/天） | ✅ | localStorage |
| 16 | 成就徽章（14个） | ✅ | 计算值 |
| 17 | 随机事件 | ✅ | 随机触发 |
| 18 | Yian喵小日记 | ✅ | 计算值 |

### AI 聊天

| # | 功能 | 状态 | 数据源 |
|---|------|------|--------|
| 19 | 多会话群聊 | ✅ | Firebase `aiGroupSessions` |
| 20 | AI流式回复 | ✅ | Cloudflare Worker + SSE |
| 21 | 实时数据感知（14项） | ✅ | 多源采集 |
| 22 | 超时处理 | ✅ | AbortController 30s |
| 23 | 会话删除 | ✅ | Firebase remove |

### 视觉/交互

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 24 | 4时段主题（清晨/午后/傍晚/夜晚） | ✅ | CSS class 切换 |
| 25 | 天气动画（云朵/星星） | ✅ | DOM 动态生成 |
| 26 | 可爱浮动装饰 | ✅ | emoji上浮 |
| 27 | 粒子特效 | ✅ | 操作反馈 |
| 28 | 戳猫 combo 系统 | ✅ | 最高50+ combo |
| 29 | 长按猫咪彩蛋 | ✅ | 600ms 长按 |
| 30 | 摇一摇撸猫 | ✅ | DeviceMotion |
| 31 | 情话打字机 | ✅ | 每日一句 |
| 32 | 恋爱天数 + 里程碑 | ✅ | 计算值 |
| 33 | 节日系统（公历+农历） | ✅ | 2025-2028 |
| 34 | 猫咪眨眼 | ✅ | 随机3-8秒 |
| 35 | 猫咪梦话 | ✅ | 睡眠时12秒间隔 |
| 36 | 底部面板右滑关闭 | ✅ | Touch事件 |
| 37 | iOS键盘适配 | ✅ | visualViewport |
| 38 | 返回键/手势关闭 | ✅ | popstate |

---

## 十一、已知问题和改进方向

### Bug / 技术债

1. **`catchFish` 中 `totalFeeds` 用本地递增** — 与其他喂食操作（用 `ServerValue.increment`）不一致，高并发下可能数据不准
2. **每日任务进度仅存 localStorage** — 换设备/清缓存后丢失，不同步
3. **`shakePet` 中仍称"猫咪"** — 应改为"Yian喵"
4. **运势抽签 `transaction` 回调** — 如果两人同时抽签，后者的 `committed` 为 false，但 `fortuneDrawn` 已被设为 true，导致无法重试
5. **留言板消息清理** — `orderByChild('time').once('value')` 全量读取后删除，数据量大时低效

### 功能扩展建议

| 优先级 | 方向 | 说明 |
|--------|------|------|
| 高 | PWA 支持 | 添加 manifest.json + Service Worker，支持桌面安装和离线访问 |
| 高 | 消息通知 | Web Push API，对方发悄悄话/留言时推送 |
| 中 | AI天气感知 | 接入免费天气API，让Yian喵能聊天气 |
| 中 | 换模型降本 | Claude Opus 4.5 最贵，可换 Sonnet 系列 |
| 中 | 代码压缩 | 用 terser/esbuild 压缩 JS/CSS |
| 低 | 相册功能 | 上传照片到 Firebase Storage |
| 低 | 语音消息 | Web Audio API 录音 + 存储 |
| 低 | AI联网搜索 | DuckDuckGo API 或接入天气/热搜 |

### 代码质量改进

1. **模块化** — 当前3270行单文件，可拆分为多个 ES Module
2. **TypeScript** — 加类型提示，减少运行时错误
3. **状态管理** — `catState` 作为全局变量到处直接修改，可封装为响应式
4. **错误监控** — 接入 Sentry 等服务，捕获线上错误
5. **单元测试** — 核心逻辑（衰减计算、等级计算、签到判断）可加测试

---

## 十二、部署流程

### 前端部署（GitHub Pages）

```bash
git add -A
git commit -m "描述"
git push origin main
# 自动部署到 changle.me（通过 CNAME 配置）
```

### Cloudflare Worker 部署

1. 登录 https://dash.cloudflare.com
2. Workers & Pages → 选择 `cat-chat-proxy`
3. 编辑代码 → 部署
4. 环境变量 `API_KEY` 已加密存储
5. 自定义域名 `api.changle.me` 已绑定

### Firebase 规则更新

1. 登录 https://console.firebase.google.com
2. 项目 `shared-cat` → Realtime Database → 规则
3. 编辑 JSON 规则 → 发布

---

## 十三、关键常量速查

```javascript
// 恋爱起始日
LOVE_START = new Date('2025-12-05T00:00:00')

// 属性衰减
DECAY_PER_HOUR = { hunger: 6, mood: 4, energy: 3 }

// 互动效果
FEED_EFFECT = { hunger: 20, mood: 8 }
PET_EFFECT  = { mood: 12, energy: 5 }
PLAY_EFFECT = { energy: 15, mood: 10, hunger: -5 }

// 等级阈值（累计互动次数）
Lv.1: 0  |  Lv.2: 8   |  Lv.3: 20  |  Lv.4: 40
Lv.5: 70 |  Lv.6: 120 |  Lv.7: 200 |  Lv.8: 300
Lv.9: 500|  Lv.10: 1000

// 睡眠时间
isSleeping = (hours >= 23 || hours < 5)

// AI配置
WORKER_URL = 'https://api.changle.me'
AI_MODEL   = 'aws.amazon/claude-opus-4-5:once'
AI_TIMEOUT = 30000ms
```

---

## 十四、localStorage 键值清单

| Key | 类型 | 用途 |
|-----|------|------|
| `cat_session_id` | string | 用户唯一标识（8位随机） |
| `catState` | JSON | 猫咪状态离线缓存 |
| `cat_accessory` | string | 当前装扮ID |
| `fortune_date` | string | 上次抽签日期 |
| `fortune_data` | JSON | 今日运势数据 |
| `quest_date` | string | 任务日期 |
| `quest_progress` | JSON | 任务进度 |
| `food_date` | string | 食物用量日期 |
| `food_used` | JSON | 各食物今日使用次数 |

---

*文档结束。如有更新请同步修改此文件。*
