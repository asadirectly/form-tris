// 83450 -> "1:23.45"
export function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = String(totalSec % 60).padStart(2, '0');
  const hundredths = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');
  return `${min}:${sec}.${hundredths}`;
}

// personal best saved by the game, null if there isn't one yet
export function getBest(mode) {
  try {
    const value = Number(localStorage.getItem(`formtris-best-${mode}`)) || 0;
    if (!value) return null;
    return mode === 'sprint' ? formatTime(value) : value.toLocaleString();
  } catch {
    return null;
  }
}

// 3725000 -> "1h 2m", 250000 -> "4m 10s"
export function formatPlaytime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${min}m`;
  return `${min}m ${totalSec % 60}s`;
}
