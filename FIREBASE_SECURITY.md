# Firebase Security Rules 建议

## 当前安全问题

1. **API Key 暴露**: Firebase API Key 硬编码在前端代码中。虽然这是 Firebase 的预期设计，但没有配置 Security Rules 会导致数据库完全开放。

2. **数据库无保护**: 当前 Realtime Database 没有安全规则，任何人都可以：
   - 读写 `catV2`、`auth`、`messages` 节点
   - 伪造授权码 hash
   - 删除或篡改猫咪状态
   - 发送恶意留言

## 推荐的 Security Rules

在 Firebase Console > Realtime Database > Rules 中设置：

```json
{
  "rules": {
    "catV2": {
      ".read": true,
      ".write": true,
      ".validate": "newData.hasChildren(['hunger', 'mood', 'energy', 'lastUpdate'])",
      "hunger": {
        ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100"
      },
      "mood": {
        ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100"
      },
      "energy": {
        ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100"
      },
      "totalFeeds": {
        ".validate": "newData.isNumber() && newData.val() >= 0"
      },
      "totalPets": {
        ".validate": "newData.isNumber() && newData.val() >= 0"
      },
      "totalPlays": {
        ".validate": "newData.isNumber() && newData.val() >= 0"
      }
    },
    "auth": {
      ".read": true,
      ".write": "!data.exists()",
      "codeHash": {
        ".validate": "newData.isString() && newData.val().length == 64"
      }
    },
    "messages": {
      ".read": true,
      "$messageId": {
        ".write": true,
        ".validate": "newData.hasChildren(['text', 'time']) && newData.child('text').isString() && newData.child('text').val().length <= 30 && newData.child('time').isNumber()"
      }
    }
  }
}
```

## Security Rules 说明

### `catV2` 节点
- **读写权限**: 允许所有人读写（符合共享宠物的设计）
- **数据校验**: 
  - 必须包含基本字段
  - 属性值限制在 0-100 之间
  - 统计数字不能为负数

### `auth` 节点  
- **读权限**: 允许读取（客户端需要获取 hash 进行比对）
- **写权限**: 仅当数据不存在时允许写入（防止恶意修改授权码）
- **Hash 校验**: 确保是 64 字符的 SHA-256 hash

### `messages` 节点
- **读权限**: 允许所有人读取
- **写权限**: 允许写入新消息
- **内容校验**: 留言长度不超过 30 字符，必须包含时间戳

## 进一步安全建议

1. **启用 App Check**: 防止来自非法应用的请求
2. **设置配额限制**: 在 Firebase Console 设置每日读写限制
3. **监控异常**: 启用 Firebase Analytics 监控异常访问模式
4. **定期轮换**: 如发现滥用，可重新生成项目密钥

## 当前代码中的安全改进

已实现的安全措施：
- ✅ IIFE 封装防止全局函数被外部调用
- ✅ 留言频率限制（5秒冷却）
- ✅ 留言长度限制（30字符）
- ✅ 留言数量限制（保留最新20条）
- ✅ 使用 ServerValue.TIMESTAMP 防止时间篡改

注意: 真正的安全控制必须在服务端实现。当前的客户端验证只能防止意外错误，不能防止恶意攻击。
