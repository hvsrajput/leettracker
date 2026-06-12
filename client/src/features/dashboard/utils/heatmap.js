export const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

export const DIFFICULTY_COLOR = {
  Easy: { text: 'text-sky-400', bar: 'bg-sky-400', dot: 'bg-sky-400' },
  Medium: { text: 'text-amber-400', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  Hard: { text: 'text-rose-400', bar: 'bg-rose-400', dot: 'bg-rose-400' },
};

export const hasVisibleHeatmapActivity = (data, year) => {
  const entries = Object.entries(data || {}).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return false;
  }

  const currentYear = new Date().getFullYear();
  if (year !== currentYear) {
    return entries.some(([date]) => date.startsWith(`${year}-`));
  }

  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 364);

  return entries.some(([date]) => {
    const dateObj = new Date(`${date}T00:00:00`);
    return dateObj >= startDate && dateObj <= endDate;
  });
};

export const getBestHeatmapYear = (data) => {
  const currentYear = new Date().getFullYear();
  if (hasVisibleHeatmapActivity(data, currentYear)) {
    return currentYear;
  }

  const years = Object.entries(data || {})
    .filter(([, count]) => count > 0)
    .map(([date]) => Number(date.slice(0, 4)))
    .filter(Number.isFinite);

  return years.length > 0 ? Math.max(...years) : currentYear;
};

export const getLeetCodeUrl = (problem) => {
  if (problem.url) {
    return problem.url;
  }

  const searchTerm = problem.leetcode_number || problem.title || '';
  return `https://leetcode.com/problemset/all/?search=${encodeURIComponent(searchTerm)}`;
};

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
};

export const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  const d = Math.floor(diff / day);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

// Current consecutive-day streak + total active days from the heatmap.
export const computeStreak = (heatmapData) => {
  const days = new Set(
    Object.entries(heatmapData || {})
      .filter(([, count]) => count > 0)
      .map(([date]) => date)
  );
  if (days.size === 0) return { current: 0, activeDays: 0 };

  const key = (d) => d.toISOString().slice(0, 10);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow the streak to count even if today has no solve yet.
  if (!days.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let current = 0;
  while (days.has(key(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, activeDays: days.size };
};
