require('dotenv').config();
const { Pool } = require('pg');

// 创建数据库连接池
const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 测试数据库连接
pool.on('connect', () => {
    console.log('✓ 数据库连接成功');
});

pool.on('error', (err) => {
    console.error('✗ 数据库连接错误:', err);
});

// 辅助函数：执行查询
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('执行查询', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('查询错误', { text, error: error.message });
        throw error;
    }
}

module.exports = {
    pool,
    query
};
