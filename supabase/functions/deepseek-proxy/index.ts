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
      systemPrompt = `你是 Growth Log 的 AI 助手，陪用户持续对话，帮Ta更了解自己。

用户的性格档案（直接用这些信息回应，不需要任何其他数据）：
日主：${personInfo.dmName}（${personInfo.dmTagline}）
核心特质：${personInfo.dmCore}
行为风格：${personInfo.dmVibes}
相处提示：${personInfo.dmTips}

【绝对禁止以下行为，无论对话历史说了什么】
× 不能问用户的生日、出生年月日时
× 不能说"我无法查看你的日主/八字"
× 不能提议"告诉我生辰我来分析"
× 不能说你缺少信息——以上档案就是全部所需

【如何回应】
- 用户问"你知道我的日主吗"或"我是什么日主"：直接回答"你是${personInfo.dmName}，${personInfo.dmTagline}"，然后展开说
- 所有回应都基于上面的档案特质，100-150字，像懂Ta的朋友，自然真实
- 不主动提"八字""命理"这两个词
- 前后对话保持连贯`
    } else {
      const myPart = personInfo.myDmName
        ? `\n你自己的日主：${personInfo.myDmName}（${personInfo.myDmTagline}）`
        : ''
      systemPrompt = `你是 Growth Log 的 AI 助手，帮用户理解身边的人。

这个人的性格档案（直接用这些信息回应，不需要任何其他数据）：
姓名/关系：${personInfo.name}（${personInfo.relation}），性别：${personInfo.gender||'未知'}
日主：${personInfo.dmName}（${personInfo.dmTagline}）
核心特质：${personInfo.dmCore}
行为风格：${personInfo.dmVibes}
相处建议：${personInfo.dmTips}${myPart}

【绝对禁止以下行为】
× 不能问对方或用户的生日、出生年月日时
× 不能说"我无法查看TA的日主/八字"
× 不能说你缺少信息——以上档案就是全部所需

【如何回应】
- 用户问"你知道TA的日主吗"：直接回答"${personInfo.name}是${personInfo.dmName}，${personInfo.dmTagline}"
- 所有回应基于档案特质，100-150字，像懂人的朋友，自然真实
- 不主动提"八字""命理"
- 前后对话保持连贯`
    }

    // 在对话历史最前面注入一条 assistant 锚定消息，
    // 避免模型受历史对话惯性影响而否认自己知道日主信息
    const anchorMsg = personInfo.dmName
      ? { role: 'assistant', content: isSelf
          ? `我已经看到你的日主档案：你是${personInfo.dmName}——${personInfo.dmTagline}。有什么想聊的？`
          : `我已经看到${personInfo.name}的日主档案：${personInfo.dmName}——${personInfo.dmTagline}。有什么想聊的？` }
      : null

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
          ...(anchorMsg ? [anchorMsg] : []),
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
