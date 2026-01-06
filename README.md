# 企业微信兑换码生成器

企业微信侧边栏应用，用于为新用户生成专属兑换码（¥2.99）。每个企业微信用户仅能生成一次兑换码。

## 功能特点

- ✅ 新用户添加企业微信即可领取兑换码
- ✅ 每个用户仅限生成一次（根据企业微信用户ID判断）
- ✅ 自动生成唯一兑换码
- ✅ 支持HTTPS安全访问
- ✅ 完整的错误处理和用户提示
- ✅ 环境变量管理配置

## 技术栈

- **后端**: Node.js + Express 5.2.1
- **数据库**: PostgreSQL (pg 8.11.3)
- **前端**: 原生HTML5 + JavaScript
- **微伴集成**: 微伴OpenAPI SDK
- **其他**: dotenv (环境变量), uuid (生成唯一ID)

## 项目结构

```
.
├── server.js           # Express HTTPS服务器
├── db.js              # PostgreSQL数据库连接
├── index.html         # 前端页面（兑换码卡片）
├── package.json       # 项目配置
├── .env              # 环境变量（不提交到git）
├── .env.example      # 环境变量示例
├── cert.pem          # HTTPS证书
├── key.pem           # HTTPS私钥
└── README.md         # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
npm install
# 或
yarn install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`，并填写实际配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
POSTGRES_HOST=your-database-host
POSTGRES_PORT=5432
POSTGRES_DB=claude_code
POSTGRES_USER=your-username
POSTGRES_PASSWORD=your-password
POSTGRES_SSL=false

# 微伴助手配置
WEIBAN_CORP_ID=your-corp-id
WEIBAN_SECRET=your-secret

# 兑换码配置
COUPON_AMOUNT=2.99

# 服务器配置
PORT=8080
```

### 3. 启动服务

```bash
npm start
```

服务将在 `https://localhost:8080` 启动。

### 4. 配置企业微信侧边栏

1. 使用 ngrok 将本地服务暴露到公网：
   ```bash
   ngrok http 8080
   ```

2. 在微伴后台配置侧边栏链接：
   ```
   https://your-ngrok-url.ngrok.io/index.html
   ```

3. 在企业微信中打开客户侧边栏，即可看到兑换码卡片

## API接口

### 1. 健康检查

```http
GET /api/health
```

**响应示例**:
```json
{
  "errcode": 0,
  "errmsg": "ok",
  "status": "healthy",
  "config": {
    "corp_id": "1853441153286728705",
    "coupon_amount": "2.99"
  }
}
```

### 2. 创建兑换码

```http
POST /api/create-coupon
Content-Type: application/json

{
  "code": "企业微信传入的code参数"
}
```

**成功响应**（首次生成）:
```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "id": "uuid",
    "code": "WC2A3B4C5D",
    "amount": "2.99",
    "created_at": "2024-01-01T00:00:00Z",
    "description": "新用户添加企业微信奖励",
    "already_exists": false
  }
}
```

**成功响应**（已存在）:
```json
{
  "errcode": 40003,
  "errmsg": "您已经生成过兑换码了",
  "data": {
    "code": "WC2A3B4C5D",
    "created_at": "2024-01-01T00:00:00Z",
    "already_exists": true
  }
}
```

**错误响应**:
```json
{
  "errcode": 40001,
  "errmsg": "缺少code参数"
}
```

## 数据库表结构

项目使用 `coupons` 表存储兑换码信息，关键字段：

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | varchar(255) | 主键（UUID） |
| code | varchar(100) | 兑换码（唯一，格式：WC + 8位随机字符） |
| amount_cny | numeric(10, 2) | 金额（人民币元） |
| wecom_external_user_id | text | 企业微信用户ID（用于唯一性判断） |
| description | text | 备注："新用户添加企业微信奖励" |
| is_active | boolean | 是否激活 |
| max_uses | integer | 最大使用次数（默认1） |
| used_count | integer | 已使用次数 |
| created_at | timestamp | 创建时间 |

## 业务逻辑

1. 用户在企业微信侧边栏打开页面，URL自动带上 `code` 参数
2. 用户点击"创建兑换码"按钮
3. 前端调用 `/api/create-coupon` 接口，传入 `code`
4. 后端通过 `code` 获取企业微信用户ID（`external_user_id`）
5. 检查数据库中是否已存在该用户的兑换码：
   - 如果存在：返回已有的兑换码
   - 如果不存在：生成新兑换码并保存到数据库
6. 前端展示兑换码给用户

## 安全措施

- ✅ HTTPS加密传输
- ✅ 环境变量管理敏感配置
- ✅ Access Token服务端缓存（不暴露给前端）
- ✅ 数据库连接池管理
- ✅ 唯一性校验（防止重复生成）

## 生产部署建议

1. **使用正式SSL证书**：替换自签名证书（cert.pem/key.pem）
2. **环境变量保护**：不要将 `.env` 提交到版本控制
3. **进程管理**：使用 PM2 或 Docker 管理进程
4. **日志监控**：添加日志收集和错误监控
5. **数据库备份**：定期备份 coupons 表
6. **IP白名单**：限制微伴API的访问来源

## 开发调试

### 本地测试

访问 `https://localhost:8080/index.html?debug=1` 可以看到调试信息，包括URL参数解析结果。

### 查看日志

服务运行时会输出详细日志：

```
=================================================
🚀 企业微信兑换码生成器已启动
=================================================
📡 HTTPS服务运行在: https://localhost:8080
💰 兑换码金额: ¥2.99
🏢 企业ID: 1853441153286728705
=================================================
✓ 数据库连接成功
→ 获取用户信息...
✓ 用户ID: 77
→ 检查用户是否已生成过兑换码...
→ 生成新兑换码...
✓ 兑换码生成成功: WC2A3B4C5D
```

## 常见问题

### 1. 数据库连接失败

检查 `.env` 中的数据库配置是否正确，确保数据库服务正在运行。

### 2. 无法获取企业微信用户信息

检查 `WEIBAN_CORP_ID` 和 `WEIBAN_SECRET` 是否配置正确。

### 3. 页面打开后没有URL参数

确保页面是从企业微信侧边栏打开的，而不是直接在浏览器中访问。

## License

MIT
