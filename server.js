require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

// 微伴助手配置
const WEIBAN_CONFIG = {
    corp_id: process.env.WEIBAN_CORP_ID,
    secret: process.env.WEIBAN_SECRET
};

// Access Token缓存
let accessTokenCache = {
    token: null,
    expires_at: 0
};

// 中间件配置
app.use(express.json());
app.use(express.static(__dirname));

// ============================================
// 微伴API辅助函数
// ============================================

/**
 * 获取微伴access_token（带缓存）
 */
async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);

    // 如果token有效且距离过期还有5分钟以上，直接返回缓存
    if (accessTokenCache.token && accessTokenCache.expires_at > now + 300) {
        console.log('✓ 使用缓存的access_token');
        return accessTokenCache.token;
    }

    console.log('→ 获取新的access_token');
    console.log('→ 请求参数:', { corp_id: WEIBAN_CONFIG.corp_id, secret: '***' });

    try {
        const response = await fetch('https://open.weibanzhushou.com/open-api/access_token/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                corp_id: WEIBAN_CONFIG.corp_id,
                secret: WEIBAN_CONFIG.secret
            })
        });

        console.log('→ 响应状态:', response.status, response.statusText);

        const contentType = response.headers.get('content-type');
        console.log('→ 响应类型:', contentType);

        const text = await response.text();
        console.log('→ 响应内容:', text.substring(0, 200));

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`API返回非JSON格式: ${text.substring(0, 100)}`);
        }

        if (data.errcode !== 0) {
            throw new Error(`获取access_token失败: ${data.errmsg}`);
        }

        // 更新缓存
        accessTokenCache.token = data.access_token;
        accessTokenCache.expires_at = now + data.expires_in;

        console.log(`✓ 新access_token已获取，有效期至: ${new Date(accessTokenCache.expires_at * 1000).toLocaleString()}`);

        return data.access_token;
    } catch (error) {
        console.error('✗ 获取access_token出错:', error.message);
        throw error;
    }
}

/**
 * 获取企业微信用户信息
 */
async function getWeibanUserInfo(code) {
    const accessToken = await getAccessToken();

    try {
        // 1. 获取auth_info
        const authResponse = await fetch(
            `https://open.weibanzhushou.com/open-api/open_auth/sidebar/get_auth_info?access_token=${accessToken}&code=${code}`
        );
        const authData = await authResponse.json();

        if (authData.errcode !== 0) {
            throw new Error(`获取auth_info失败: ${authData.errmsg}`);
        }

        return {
            staff_id: authData.staff_id,
            external_user_id: authData.external_user_id,
            group_chat_id: authData.group_chat_id
        };
    } catch (error) {
        console.error('✗ 获取用户信息出错:', error);
        throw error;
    }
}

/**
 * 生成唯一兑换码
 * 格式：NEW-XXXXXXXXXXXX（NEW前缀-12个字母数字）
 * 示例：NEW-FBQ1NS2J8LXR
 */
function generateCouponCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符I、O

    // 固定前缀：NEW
    const prefix = 'NEW';

    // 生成后缀：12个大写字母数字
    let suffix = '';
    for (let i = 0; i < 12; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `${prefix}-${suffix}`;
}

/**
 * 生成兑换码ID
 * 格式：coupon_时间戳_随机字符串
 * 示例：coupon_1767597644153_fv8s7pg5n
 */
function generateCouponId() {
    const timestamp = Date.now();
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = 0; i < 13; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `coupon_${timestamp}_${randomStr}`;
}

// ============================================
// API路由
// ============================================

/**
 * 健康检查
 */
app.get('/api/health', async (req, res) => {
    try {
        // 测试数据库连接
        await db.query('SELECT 1');

        res.json({
            errcode: 0,
            errmsg: 'ok',
            status: 'healthy',
            config: {
                corp_id: WEIBAN_CONFIG.corp_id,
                coupon_amount: process.env.COUPON_AMOUNT
            }
        });
    } catch (error) {
        res.status(500).json({
            errcode: -1,
            errmsg: '服务异常',
            error: error.message
        });
    }
});

/**
 * 创建兑换码
 * 请求参数: { code: "企业微信code" }
 */
app.post('/api/create-coupon', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            errcode: 40001,
            errmsg: '缺少code参数'
        });
    }

    try {
        // 1. 获取企业微信用户信息
        console.log('→ 获取用户信息...');
        const userInfo = await getWeibanUserInfo(code);
        const { external_user_id } = userInfo;

        if (!external_user_id) {
            return res.status(400).json({
                errcode: 40002,
                errmsg: '无法获取企业微信用户ID'
            });
        }

        console.log(`✓ 用户ID: ${external_user_id}`);

        // 2. 检查该用户是否已生成过兑换码
        console.log('→ 检查用户是否已生成过兑换码...');
        const checkResult = await db.query(
            'SELECT id, code, created_at FROM coupons WHERE wecom_external_user_id = $1',
            [external_user_id]
        );

        if (checkResult.rows.length > 0) {
            const existingCoupon = checkResult.rows[0];
            console.log(`✗ 用户已生成过兑换码: ${existingCoupon.code}`);
            return res.json({
                errcode: 40003,
                errmsg: '您已经生成过兑换码了',
                data: {
                    code: existingCoupon.code,
                    created_at: existingCoupon.created_at,
                    already_exists: true
                }
            });
        }

        // 3. 生成新的兑换码
        console.log('→ 生成新兑换码...');
        const couponId = generateCouponId();
        const couponCode = generateCouponCode();
        const amount = parseFloat(process.env.COUPON_AMOUNT);

        const insertResult = await db.query(
            `INSERT INTO coupons (
                id,
                code,
                discount_type,
                discount_value,
                amount_cny,
                max_uses,
                used_count,
                is_active,
                wecom_external_user_id,
                description,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            RETURNING id, code, amount_cny, created_at`,
            [
                couponId,
                couponCode,
                'credits',  // 积分类型
                0,  // discount_value为0
                amount,
                1,  // 最多使用1次
                0,  // 已使用0次
                true,  // 激活状态
                external_user_id,
                '新用户添加企业微信奖励'
            ]
        );

        const newCoupon = insertResult.rows[0];
        console.log(`✓ 兑换码生成成功: ${newCoupon.code}`);

        res.json({
            errcode: 0,
            errmsg: 'ok',
            data: {
                id: newCoupon.id,
                code: newCoupon.code,
                amount: newCoupon.amount_cny,
                created_at: newCoupon.created_at,
                description: '新用户添加企业微信奖励',
                already_exists: false
            }
        });

    } catch (error) {
        console.error('✗ 创建兑换码失败:', error);
        res.status(500).json({
            errcode: -1,
            errmsg: '创建失败',
            error: error.message
        });
    }
});

// ============================================
// HTTPS服务器启动
// ============================================

const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 企业微信兑换码生成器已启动');
    console.log('='.repeat(50));
    console.log(`📡 HTTPS服务运行在: https://localhost:${PORT}`);
    console.log(`💰 兑换码金额: ¥${process.env.COUPON_AMOUNT}`);
    console.log(`🏢 企业ID: ${WEIBAN_CONFIG.corp_id}`);
    console.log('='.repeat(50));
});
