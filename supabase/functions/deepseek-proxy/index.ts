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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '未授权' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { messages, personInfo, isSelf } = await req.json()
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')

    let systemPrompt: string

    if (isSelf) {
      systemPrompt = `你是 Growth Log 的 AI 助手，在和用户进行持续对话，帮助Ta认识自己。
用户的性格标签：${personInfo.dmName}（${personInfo.dmTagline}），核心特质：${personInfo.dmCore}。
给出温暖、有洞察力的回应，100-150字，像懂人的朋友在说话，直接说结论，不要提"八字"或"命理"。
记住对话的上下文，前后保持连贯。`
    } else {
      systemPrompt = `你是 Growth Log 的 AI 助手，在和用户持续对话，帮助Ta理解身边的人。
关于这个人：${personInfo.name}（${personInfo.relation}），性别：${personInfo.gender||'未知'}，性格：${personInfo.dmName}（${personInfo.dmTagline}），特质：${personInfo.dmCore}。
给出温暖、准确、有洞察力的回应，100-150字，像懂人的朋友在说话，直接说结论，不要提"八字"或"命理"。
记住对话的上下文，前后保持连贯。`
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 400,
        temperature: 0.85,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'DeepSeek API error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
