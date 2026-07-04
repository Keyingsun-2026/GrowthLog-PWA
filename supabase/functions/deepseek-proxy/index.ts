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
      systemPrompt = `你是 Growth Log 的 AI 助手，在和用户进行持续对话，帮助Ta更了解自己。

你已经掌握了用户的日主性格档案，信息如下：
日主：${personInfo.dmName}（${personInfo.dmTagline}）
核心特质：${personInfo.dmCore}
行为风格：${personInfo.dmVibes}
相处提示：${personInfo.dmTips}

重要规则：
- 用户问"你知道我的日主吗"或类似问题时，直接确认你知道，并简要说出日主名称和核心特质，不要否认或要求用户再提供信息
- 不要主动说"八字"或"命理"这两个词，但可以正常说"日主"
- 回应100-150字，像真正懂Ta的朋友在说话，结合日主特质分析，自然真实，不要生搬硬套标签
- 记住对话上下文，前后保持连贯`
    } else {
      const myPart = personInfo.myDmName
        ? `\n用户自己的日主：${personInfo.myDmName}（${personInfo.myDmTagline}）`
        : ''
      systemPrompt = `你是 Growth Log 的 AI 助手，在和用户持续对话，帮助Ta理解身边的人。

你已经掌握了这个人的日主性格档案：
姓名/关系：${personInfo.name}（${personInfo.relation}），性别：${personInfo.gender||'未知'}
日主：${personInfo.dmName}（${personInfo.dmTagline}）
核心特质：${personInfo.dmCore}
行为风格：${personInfo.dmVibes}
相处建议：${personInfo.dmTips}${myPart}

重要规则：
- 用户问"你知道TA的日主吗"或类似问题时，直接确认你知道，并说出日主名称和核心特质，不要否认或要求提供更多信息
- 不要主动说"八字"或"命理"这两个词，但可以正常说"日主"
- 回应100-150字，像真正懂人的朋友在说话，结合这个人的日主特质分析，自然真实
- 记住对话上下文，前后保持连贯`
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
