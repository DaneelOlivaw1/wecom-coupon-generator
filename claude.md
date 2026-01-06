# Claude Code 开发文档

本项目由 Claude Code 协助开发，遵循以下开发规范和原则。

## 项目概述

企业微信兑换码生成器 - 为新用户添加企业微信后自动生成专属兑换码（¥2.99）。

## 技术栈

- **后端**: Node.js + Express 5.2.1 (HTTPS)
- **数据库**: PostgreSQL (pg 8.11.3)
- **前端**: 原生HTML + JavaScript
- **API集成**: 微伴OpenAPI SDK
- **配置管理**: dotenv

## 项目结构

```
.
├── server.js           # Express HTTPS服务器
├── db.js              # PostgreSQL数据库连接
├── index.html         # 前端页面（极简设计）
├── package.json       # 项目配置
├── .env              # 环境变量（不提交）
├── .env.example      # 环境变量示例
├── cert.pem          # HTTPS证书
├── key.pem           # HTTPS私钥
└── README.md         # 项目说明
```

## 开发规范

### 1. 代码风格

- **简洁优先**: 遵循"最小化"原则，不过度设计
- **纯HTML**: 前端使用原生HTML，避免复杂CSS框架
- **内联样式**: 所有样式直接使用内联style，保持简单
- **无外边距**: 所有组件设置 `margin: 0` 保持紧凑布局

### 2. 环境变量管理

所有配置项必须通过 `.env` 文件管理：

```env
# 数据库配置
POSTGRES_HOST=
POSTGRES_PORT=5432
POSTGRES_DB=claude_code
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_SSL=false

# 微伴助手配置
WEIBAN_CORP_ID=
WEIBAN_SECRET=

# 兑换码配置
COUPON_AMOUNT=2.99

# 服务器配置
PORT=8080
```

### 3. 数据库字段规范

兑换码记录必须遵循以下格式：

```sql
INSERT INTO coupons (
    id,                          -- coupon_时间戳_随机字符串
    code,                        -- NEW-XXXXXXXXXXXX
    discount_type,               -- 'credits'
    discount_value,              -- 0
    amount_cny,                  -- 2.99
    max_uses,                    -- 1
    used_count,                  -- 0
    is_active,                   -- true
    wecom_external_user_id,      -- 企业微信用户ID
    description,                 -- '新用户添加企业微信奖励'
    created_at                   -- NOW()
)
```

### 4. API设计规范

#### 响应格式

```javascript
// 成功
{
    "errcode": 0,
    "errmsg": "ok",
    "data": { ... }
}

// 失败
{
    "errcode": 40001,
    "errmsg": "错误信息"
}
```

#### 错误码

- `0`: 成功
- `40001`: 缺少参数
- `40002`: 无法获取用户信息
- `40003`: 用户已生成过兑换码
- `-1`: 服务器错误

### 5. 前端交互规范

- **Toast提示**: 使用微伴SDK的 `wb.showDialog('toast', 'success', 'message')`
- **不使用alert**: 避免浏览器原生弹窗，使用toast代替
- **极简UI**: 只显示必要的按钮和内容，无多余文字

### 6. 兑换码生成规则

```javascript
// 格式：NEW-XXXXXXXXXXXX
// NEW: 固定前缀
// 后缀: 12位随机大写字母数字（去除I、O避免混淆）
function generateCouponCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const prefix = 'NEW';
    let suffix = '';
    for (let i = 0; i < 12; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${suffix}`;
}
```

### 7. 话术模板

```
欢迎添加我们的企业微信！

添加企业微信奖励：{兑换码}
在https://aicodewith.com/dashboard/redeem这里兑换

如果您在体验过程中有任何问题请随时联系我！
```

## 安全措施

1. **HTTPS加密**: 所有通信使用HTTPS
2. **环境变量**: 敏感信息不hardcode，使用.env管理
3. **Access Token缓存**: 服务端管理，不暴露给前端
4. **唯一性校验**: 每个企业微信用户仅能生成一次

## 部署流程

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际配置

# 3. 启动服务
npm start
```

### 暴露到公网

```bash
# 使用ngrok
ngrok http https://localhost:8080
```

### 配置企业微信

在微伴后台配置侧边栏链接：
```
https://your-ngrok-url.ngrok-free.dev/index.html
```

## Git提交规范

参考 [Conventional Commits](https://www.conventionalcommits.org/)

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
perf: 性能优化
test: 测试
chore: 构建/工具链
```

## 参考项目

项目参考了 `custom-sidebar-module-demos/basic/` 的实现方式：
- API调用模式
- 微伴SDK使用
- HTTPS服务配置
- 简洁的HTML设计

## 开发原则

1. **Keep It Simple**: 保持代码简单直接
2. **No Over-Engineering**: 不过度设计，只实现需要的功能
3. **Environment First**: 所有配置优先使用环境变量
4. **Security by Default**: 默认安全，不暴露敏感信息
5. **Minimal UI**: 极简UI，只保留必要元素

## 维护说明

- **定期更新依赖**: `npm update`
- **监控日志**: 关注服务器日志中的错误
- **数据库备份**: 定期备份coupons表
- **证书更新**: HTTPS证书到期前更新

---

生成时间: 2026-01-05
Claude版本: Claude Sonnet 4.5
