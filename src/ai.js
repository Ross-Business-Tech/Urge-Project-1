// Calls the AI through the here.now proxy route declared in public/.herenow/proxy.json.
// The API key lives in here.now (variable OPENROUTER_API_KEY), never in this code.

const MODEL = 'anthropic/claude-sonnet-4.5'

const SYSTEM = `You draft investment memos for URGE Investment Group, a Detroit firm that lends to (and sometimes takes equity in) real estate companies, mainly commercial and mixed-use. The memo goes to URGE's Investment Committee after a human reviewer edits it.

Rules you must follow:
1. Use ONLY the facts provided. Never invent numbers, names, dates, comparables, news or market data.
2. Do not do math. Every figure you mention must be copied exactly as written in the facts.
3. Never reword, soften or contradict anything under "userInputVerbatim"; you may quote or summarise it faithfully.
4. If something important is missing or marked NEEDS INPUT, write [NEEDS INPUT: what is missing] instead of guessing.
5. Tone: professional, concise, defensible. Separate facts from judgement.
6. You do not decide. The recommendation is a suggestion for the reviewer, framed as such.

Reply with JSON only, no prose around it, in this shape:
{"executiveSummary": "3-5 sentences",
 "marketContext": "1 short paragraph based only on the provided market research; [NEEDS INPUT] if none",
 "strengths": ["..."],
 "risks": [{"risk": "...", "mitigant": "... or [Reviewer to add mitigant]"}],
 "followUpQuestions": ["questions the team should ask the borrower"],
 "recommendation": "suggested stance for the reviewer, with conditions"}`

export async function draftWithAI(facts) {
  const res = await fetch('/api/memo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Facts for this deal:\n${JSON.stringify(facts, null, 2)}` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`AI service returned ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  const out = JSON.parse(json)
  const str = (v) => (typeof v === 'string' ? v : '')
  const list = (v) => (Array.isArray(v) ? v : [])
  return {
    executiveSummary: str(out.executiveSummary),
    marketContext: str(out.marketContext),
    strengths: list(out.strengths).map(str).filter(Boolean),
    risks: list(out.risks)
      .map((r) => ({ risk: str(r?.risk), mitigant: str(r?.mitigant) }))
      .filter((r) => r.risk),
    followUpQuestions: list(out.followUpQuestions).map(str).filter(Boolean),
    recommendation: str(out.recommendation),
  }
}
