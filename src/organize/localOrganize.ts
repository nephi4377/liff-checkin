/**
 * 本機規則整理：把雜亂工地派工筆記收成「短標題 + 條列」，
 * 方便直接貼進派工說明。
 */

const WORKERS = ['恩德', '阿勇'] as const

const CATEGORY_RULES = [
  { re: /優先|急件|先做|最重要/, label: '優先' },
  { re: /限期|期限|截止|deadline/i, label: '限期' },
  { re: /待處理|之後|有空|順便|不急著/, label: '待處理' },
] as const

const URGENCY_RULES = [
  { re: /很急|緊急|馬上|立刻|趕一?下|趕緊|盡快/, label: '緊急' },
  { re: /不急|慢慢來|有空再/, label: '不急' },
  { re: /普通|一般/, label: '普通' },
] as const

const DATE_RE =
  /(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|\d{1,2}月\d{1,2}日|\d{1,2}[\/.-]\d{1,2}|今天|明天|後天|大後天|這週|下周|下週|週[一二三四五六日天]|星期[一二三四五六日天])/

const TICKET_RE =
  /#\s*(\d{2,6})|(?:單號|案號|工單)[:：\s#]*(\d{2,6})|(\d{3,6})\s*號/

const LOCATION_RE =
  /(\d+\s*樓|[一二三四五六七八九十百]+樓|B\d+|地下室|屋頂|陽台|廚房|浴室|客廳|臥室|玄關|梯間|車庫|停車場|外牆|室內|現場|[東西南北]側|\d+\s*戶|\d+\s*房)/

/** 主要工序（可當標題） */
const PRIMARY_ACTIONS = [
  '補矽利康',
  '打矽利康',
  '補土',
  '補漆',
  '矽利康',
  '油漆',
  '粉刷',
  '防水',
  '清潔',
  '打掃',
  '安裝',
  '拆除',
  '更換',
  '維修',
  '檢查',
  '巡檢',
  '丈量',
  '放樣',
  '灌漿',
  '磁磚',
  '貼磚',
  '木作',
  '水電',
  '接線',
  '配線',
  '搬運',
  '清運',
  '進料',
  '送料',
  '交屋',
  '點交',
  '驗收',
] as const

/** 附帶動作（條列，不當主標題） */
const SUPPORT_ACTIONS = ['拍照', '錄影', '回報'] as const

const META_ONLY_RE =
  /^(恩德|阿勇|派工|指派|優先|待處理|限期|緊急|不急|普通|急件|工作|說明|確認)[:：\s]*$/

function detectOne(
  text: string,
  rules: readonly { re: RegExp; label: string }[],
): string | null {
  for (const r of rules) {
    if (r.re.test(text)) return r.label
  }
  return null
}

/** 切片段：換行與 ／ / 、 ， ； ； 以及「短詞空白串」 */
function tokenize(raw: string): string[] {
  const normalized = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[／╱|｜]/g, '\n')
    .replace(/[、，,;；]+/g, '\n')
    .replace(/[　\t]+/g, ' ')

  const out: string[] = []
  for (const line of normalized.split('\n')) {
    const t = line.trim()
    if (!t) continue
    // 空白分隔的短詞派工（無句號）→ 拆開
    if (!/[。！？]/.test(t) && /\s/.test(t)) {
      const parts = t.split(/\s+/).filter(Boolean)
      if (parts.length >= 2 && parts.every((p) => p.length <= 12)) {
        out.push(...parts)
        continue
      }
    }
    out.push(t)
  }
  return out
}

function extractTicket(text: string): string | null {
  const m = text.match(TICKET_RE)
  if (!m) return null
  const num = (m[1] || m[2] || m[3] || '').replace(/\D/g, '')
  return num ? `#${num}` : null
}

function extractAssigner(tokens: string[], blob: string): string | null {
  const confirm = blob.match(
    /(?:請)?([^\s，、／/#]{1,8}(?:哥|姐|經理|主任|老闆|總|工頭))(?:確認|驗收|點頭|同意)?/,
  )
  if (confirm?.[1] && !(WORKERS as readonly string[]).includes(confirm[1])) {
    return confirm[1]
  }
  for (const t of tokens) {
    const m = t.match(/^([^\s]{1,8}(?:哥|姐|經理|主任))(?:確認|驗收)?$/)
    if (m && !(WORKERS as readonly string[]).includes(m[1])) return m[1]
  }
  return null
}

function findListed(
  blob: string,
  list: readonly string[],
): string[] {
  // longer first so 補矽利康 wins over 矽利康
  const sorted = [...list].sort((a, b) => b.length - a.length)
  const found: string[] = []
  let rest = blob
  for (const a of sorted) {
    if (rest.includes(a)) {
      found.push(a)
      rest = rest.split(a).join('／')
    }
  }
  return found
}

function buildTitle(opts: {
  primary: string[]
  ticket: string | null
  location: string | null
  workers: string[]
  fallback: string
}): string {
  const main = opts.primary[0] || opts.fallback || '派工事項'
  const bits: string[] = []
  if (opts.ticket) bits.push(opts.ticket)
  bits.push(main)
  if (opts.location) bits.push(opts.location)
  let title = bits.join(' ')
  if (opts.workers.length === 1) title += ` — ${opts.workers[0]}`
  else if (opts.workers.length > 1) title += ` — ${opts.workers.join('、')}`
  return title
}

function isAbsorbedToken(
  t: string,
  ctx: {
    ticket: string | null
    workers: string[]
    primary: string[]
    support: string[]
    assigner: string | null
    location: string | null
    category: string | null
    urgency: string | null
    date: string | null
  },
): boolean {
  if (!t || META_ONLY_RE.test(t)) return true
  if (/^(優先|待處理|限期|緊急|不急|普通|急件|派工|指派)$/.test(t)) return true
  if (ctx.workers.some((w) => t === w || t === `${w}派工` || /^派工/.test(t) && t.includes(w)))
    return true
  if (t === '派工阿勇' || t === '派工恩德') return true
  if (ctx.ticket) {
    const n = ctx.ticket.replace('#', '')
    if (t === ctx.ticket || t === `${n}號` || t === `#${n}` || t === n) return true
  }
  if (ctx.primary.some((a) => t === a)) return true
  if (ctx.support.some((a) => t === a)) return true
  if (ctx.assigner && (t === ctx.assigner || t === `${ctx.assigner}確認` || t === `請${ctx.assigner}確認`))
    return true
  if (ctx.location && t === ctx.location) return true
  if (ctx.date && t === ctx.date) return true
  if (t === '確認' || t === '請確認') return true
  // 整段已被拆解吸收：字串幾乎只含已知碎片
  const stripped = t
    .replace(/恩德|阿勇|派工/g, '')
    .replace(/很急|緊急|馬上|立刻|優先|待處理|限期|不急|普通/g, '')
    .replace(/今天|明天|後天|大後天/g, '')
    .replace(/#?\d{2,6}號?/g, '')
    .replace(new RegExp(PRIMARY_ACTIONS.join('|'), 'g'), '')
    .replace(new RegExp(SUPPORT_ACTIONS.join('|'), 'g'), '')
    .replace(/請?[^\s]{1,8}(?:哥|姐|經理|主任)確認?/g, '')
    .replace(LOCATION_RE, '')
    .replace(/[\s／/:：\-—·・]/g, '')
  if (!stripped) return true
  // 剩很少虛詞
  if (stripped.length <= 2 && /記得|帶|的|了|要|請/.test(stripped)) return false
  return false
}

export function localOrganize(raw: string): string {
  const tokens = tokenize(raw)
  if (tokens.length === 0) return ''

  const blob = tokens.join(' ')
  const workers = WORKERS.filter((w) => blob.includes(w))
  const category = detectOne(blob, CATEGORY_RULES)
  const urgency = detectOne(blob, URGENCY_RULES)
  const dateMatch = blob.match(DATE_RE)
  const date = dateMatch?.[0] ?? null
  const ticket = extractTicket(blob)
  const location = blob.match(LOCATION_RE)?.[1]?.replace(/\s+/g, '') ?? null
  const assigner = extractAssigner(tokens, blob)
  const primary = findListed(blob, PRIMARY_ACTIONS)
  const support = findListed(blob, SUPPORT_ACTIONS)

  const ctx = {
    ticket,
    workers: [...workers],
    primary,
    support,
    assigner,
    location,
    category,
    urgency,
    date,
  }

  const bullets: string[] = []
  const push = (text: string) => {
    const t = text.trim()
    if (!t) return
    if (bullets.includes(t)) return
    bullets.push(t)
  }

  if (ticket) push(`單號 ${ticket}`)
  if (location) push(`地點：${location}`)
  for (const a of primary) push(a)
  for (const a of support) {
    push(a === '拍照' || a === '錄影' ? `${a}存證` : a)
  }
  if (assigner) push(`請${assigner}確認`)

  // 其餘有意義的短語（材料、注意事項等）
  for (const rawTok of tokens) {
    let t = rawTok.trim()
    t = t
      .replace(/^(恩德|阿勇)\s*(派工)?[:：\s]*/g, '')
      .replace(/^(派工|指派)[:：\s]*/g, '')
      .trim()
    if (isAbsorbedToken(t, ctx)) continue

    // 去掉句內已標示的 meta，留下剩餘說明
    let rest = t
    for (const w of workers) rest = rest.split(w).join(' ')
    if (ticket) {
      const n = ticket.replace('#', '')
      rest = rest.replace(new RegExp(`#?\\s*${n}\\s*號?`, 'g'), ' ')
    }
    for (const a of [...primary, ...support]) rest = rest.split(a).join(' ')
    if (assigner) rest = rest.replace(new RegExp(`請?${assigner}確認?`, 'g'), ' ')
    if (location) rest = rest.split(location).join(' ')
    rest = rest
      .replace(/很急|緊急|馬上|立刻|趕緊|盡快|優先|待處理|限期|不急|普通|急件/g, ' ')
      .replace(/今天|明天|後天|大後天/g, ' ')
      .replace(/派工|指派/g, ' ')
      .replace(/[\s／/:：]+/g, ' ')
      .trim()

    if (!rest || rest.length < 2) continue
    if (isAbsorbedToken(rest, ctx)) continue
    push(rest)
  }

  const fallback =
    bullets.find((b) => !b.startsWith('單號') && !b.startsWith('地點') && !b.startsWith('請')) ||
    '派工事項'

  const title = buildTitle({
    primary,
    ticket,
    location,
    workers: [...workers],
    fallback,
  })

  const lines: string[] = [title, '']
  if (workers.length) lines.push(`・對象：${workers.join('、')}`)
  if (category) lines.push(`・分類：${category}`)
  if (urgency) lines.push(`・緊急：${urgency}`)
  if (date) lines.push(`・期限：${date}`)
  for (const b of bullets) {
    lines.push(b.startsWith('・') ? b : `・${b}`)
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
