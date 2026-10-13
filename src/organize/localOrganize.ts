/** 本機規則整理：依行切分，標出對象／分類／緊急／期限，其餘列成要點。 */

const WORKERS = ['恩德', '阿勇'] as const
const CATEGORIES = [
  { re: /優先|急件|先做/, label: '優先' },
  { re: /限期|期限|deadline|截止/, label: '限期' },
  { re: /待處理|之後|有空|順便/, label: '待處理' },
] as const
const URGENCY = [
  { re: /很急|緊急|馬上|立刻|趕/, label: '緊急' },
  { re: /不急|慢慢|有空再/, label: '不急' },
  { re: /普通|一般/, label: '普通' },
] as const

const DATE_RE =
  /(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|\d{1,2}[\/.-]\d{1,2}|今天|明天|後天|週[一二三四五六日天]|星期[一二三四五六日天])/

function detectOne(
  text: string,
  rules: readonly { re: RegExp; label: string }[],
): string | null {
  for (const r of rules) {
    if (r.re.test(text)) return r.label
  }
  return null
}

export function localOrganize(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return ''

  const blob = lines.join('\n')
  const workers = WORKERS.filter((w) => blob.includes(w))
  const category = detectOne(blob, CATEGORIES)
  const urgency = detectOne(blob, URGENCY)
  const dateMatch = blob.match(DATE_RE)

  const metaLines: string[] = []
  if (workers.length) metaLines.push(`【對象】${workers.join('、')}`)
  if (category) metaLines.push(`【分類】${category}`)
  if (urgency) metaLines.push(`【緊急】${urgency}`)
  if (dateMatch) metaLines.push(`【期限】${dateMatch[0]}`)

  const skipRe =
    /^(恩德|阿勇|優先|待處理|限期|緊急|不急|普通|急件)[:：\s]*$/
  const bullets: string[] = []
  for (const line of lines) {
    if (skipRe.test(line)) continue
    // strip leading tags but keep the rest
    let cleaned = line
      .replace(/^(恩德|阿勇)\s*[:：]?\s*/, '')
      .replace(/^(優先|待處理|限期|緊急|不急|普通|急件)\s*[:：]?\s*/, '')
      .trim()
    if (!cleaned) continue
    if (!bullets.includes(cleaned)) bullets.push(cleaned)
  }

  if (bullets.length === 0 && metaLines.length === 0) {
    return lines.join('\n')
  }

  const parts: string[] = []
  if (metaLines.length) parts.push(metaLines.join('\n'))
  if (bullets.length) {
    parts.push('【說明】')
    parts.push(bullets.map((b) => (b.startsWith('-') || b.startsWith('・') ? b : `・${b}`)).join('\n'))
  }
  return parts.join('\n\n')
}
