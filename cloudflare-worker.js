// ============================================
// Cloudflare Worker - AI 猫咪聊天代理
// 部署步骤见文件底部注释
// ============================================

export default {
  async fetch(request, env) {
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();

      // 限制 max_tokens 防止滥用
      body.max_tokens = Math.min(body.max_tokens || 300, 500);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const apiResponse = await fetch('https://www.zhongzhuan.win/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // 流式转发
      if (body.stream) {
        return new Response(apiResponse.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const data = await apiResponse.json();
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

// ============================================
// 📌 部署步骤：
//
// 1. 登录 https://dash.cloudflare.com
// 2. 左侧菜单 → Workers & Pages → 创建 Worker
// 3. 给 Worker 起个名字（如 "cat-chat-proxy"）
// 4. 把这个文件的代码粘贴进去，点 "部署"
// 5. 进入 Worker 设置 → 变量 → 添加环境变量：
//      名称: API_KEY
//      值:   sk-lxq9nCbfN0z86pjDfuG1qenNTgILwL3vANgR6iGoB7zfI0uD
//      （勾选 "加密"）
// 6. 记下你的 Worker URL，格式为：
//      https://cat-chat-proxy.你的子域名.workers.dev
// 7. 把这个 URL 填入 script.js 中的 WORKER_URL 变量
// ============================================
