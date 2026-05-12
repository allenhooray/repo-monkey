/**
 * 格式化日期字符串为本地日期
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}
