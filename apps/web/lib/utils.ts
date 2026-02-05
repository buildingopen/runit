export function getProjectEmoji(name: string): string {
  const emojis = ['🌤️', '✍️', '🔗', '🎨', '🚀', '📊', '🤖', '🔧', '📦', '⚡', '🎯', '🌍'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return emojis[Math.abs(hash) % emojis.length];
}
