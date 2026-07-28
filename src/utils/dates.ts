/**
 * Shared calendar-day key, `YYYY-MM-DD`, local time.
 *
 * Extracted from `preferencesStore`'s private `getTodayKey` so the store,
 * `Home.tsx`, and the analytics builders share one definition.
 */
export function todayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
