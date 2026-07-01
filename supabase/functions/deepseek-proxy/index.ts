import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 验证登录状态
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '未授权' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { impression, personInfo } = await req.json()

    const systemPrompt = `你是 Growth Log 的 AI 助手，帮助用户理解身边的人。
用户会分享对某人的直觉感受或观察，你需要结合这个人的性格特质，给出温暖、准确、有洞察力的解读。
回复要简洁（100-150字），语气自然亲切，像一个很懂人的朋友在说话，直接说结论，不要提"八字"或"命理"等术语。`

    const userPrompt = `关于这个人：
- 姓名：${personInfo.name}
- 和我的关系：${personInfo.relation}
- 性格标签：${personInfo.dmName}，${personInfo.dmTagline}
- 性别：${personInfo.gender || '未知'}
- 核心特质：${personInfo.dmCore}

我的感受：${impression}`

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.85,
      }),
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '暂时无法生成解读，请稍后重试。'

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
