/**
 * 解析 URL 角色（對齊 docs/employee-todo-rebuild.md / 舊 bundle re()）
 * @returns {'hub'|'assistant'|string} assistant = 派工；ops-ende / ops-ayong / ops-*
 */
export function resolveRoleFromLocation(loc = window.location) {
  const params = new URLSearchParams(loc.search);
  let role = (params.get('role') || '').trim().toLowerCase();
  const path = (loc.pathname || '').toLowerCase();
  if (!role) {
    if (path.includes('paigong') || path.includes('dispatch')) role = 'paigong';
    else if (path.includes('/ende')) role = 'ende';
    else if (path.includes('/ayong')) role = 'ayong';
  }
  if (!role) return 'hub';
  if (role === 'paigong' || role === 'dispatch' || role === 'assistant') return 'assistant';
  if (role === 'ende') return 'ops-ende';
  if (role === 'ayong') return 'ops-ayong';
  if (role.startsWith('ops-') && role.length <= 40) return role;
  return 'hub';
}

export function roleLabel(role) {
  if (role === 'assistant') return '派工';
  if (role === 'ops-ende') return '恩德';
  if (role === 'ops-ayong') return '阿勇';
  if (role === 'hub') return '入口';
  return role;
}
