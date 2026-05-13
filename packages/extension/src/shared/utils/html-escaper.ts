/**
 * 转义 HTML 特殊字符，防止 XSS
 */
export function escapeHtml(text: string | null | undefined): string {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
