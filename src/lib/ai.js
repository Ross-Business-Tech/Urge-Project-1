import { sectionSpecs } from './memoSections.js'

// Calls the here.now proxy route, which adds the secret key on the server.
// The key is never in this code. Works only on the team's dev/public sites.
const MODEL = 'anthropic/claude-sonnet-4.5'

const SYSTEM = `You are an underwriting assistant at EBIARA, an impact-investment fund that lends to early-stage real estate firms in Detroit. You draft investment memos for the investment committee.
Rules:
- Use ONLY facts and numbers found in the deal form or uploaded documents. Never invent or round a dollar amount, date, percentage, name or term. If something is missing, write "[not provided]" and list it as a gap.
- Write plain, professional prose. Be concise.
- Challenge the borrower's assumptions the way a COO would: can we get our money back? can the portfolio scale? Point out risks and things the borrower did not mention.
- Rate sections green, yellow or red. Yellow or red items need mitigants.`

export class AiUnavailable extends Error {}

async function callAi(messages) {
  let res
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2 }),
    })
  } catch {
    throw new AiUnavailable('Could not reach the AI service.')
  }
  if (!res.ok) throw new AiUnavailable(`The AI service is not available yet (error ${res.status}).`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new AiUnavailable('The AI returned an empty answer.')
  return text
}

function parseJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('The AI answer was not in the expected format.')
  return JSON.parse(text.slice(start, end + 1))
}

const dealText = (deal) =>
  Object.entries(deal).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')

const filesText = (docs) =>
  docs.filter((d) => d.text).map((d) => `--- FILE: ${d.name} ---\n${d.text}`).join('\n\n').slice(0, 60000)

export async function draftMemo(deal, docs, research = '') {
  const specs = sectionSpecs.map((s) => `- ${s.id}: ${s.title}. ${s.guidance}`).join('\n')
  const text = await callAi([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `DEAL FORM\n${dealText(deal)}\n\nUPLOADED DOCUMENTS\n${filesText(docs) || '(none)'}\n\nOUTSIDE RESEARCH PASTED BY UNDERWRITER\n${research || '(none)'}\n\nWrite the memo with these sections:\n${specs}\n\nIn "repayment", list each repayment source from the documents with a dollar amount ONLY if the amount is stated; otherwise omit it.\nReturn ONLY JSON: {"sections":[{"id":"...","rating":"green|yellow|red|none","body":"..."}],"repayment":[{"label":"short source name","amount":123}],"gaps":["missing information..."],"challenges":["questions to challenge the borrower's assumptions..."]}`,
    },
  ])
  return parseJson(text)
}

export async function regenerateSection(deal, docs, spec, currentBody, instruction) {
  const text = await callAi([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `DEAL FORM\n${dealText(deal)}\n\nUPLOADED DOCUMENTS\n${filesText(docs) || '(none)'}\n\nRewrite only this section: ${spec.title}. ${spec.guidance}\nCurrent text:\n${currentBody}\nUnderwriter instruction: ${instruction || 'Improve it using the data provided.'}\nReturn ONLY JSON: {"rating":"green|yellow|red|none","body":"..."}`,
    },
  ])
  return parseJson(text)
}

export async function extractFields(emptyDeal, docs) {
  const keys = Object.keys(emptyDeal).join(', ')
  const text = await callAi([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `From these documents, fill in the deal form. Fields: ${keys}. loanAmount is digits only. Leave a field as "" if the documents do not say. Copy values exactly; never guess.\n\n${filesText(docs)}\n\nReturn ONLY a JSON object with those keys.`,
    },
  ])
  return parseJson(text)
}
