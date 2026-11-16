// A rank prefix as players see it: legacy `&` colour codes turned into colours (formatting codes such
// as `&l` are dropped).
const COLORS: Record<string, string> = {
  '0': '#000000',
  '1': '#0000aa',
  '2': '#00aa00',
  '3': '#00aaaa',
  '4': '#aa0000',
  '5': '#aa00aa',
  '6': '#ffaa00',
  '7': '#aaaaaa',
  '8': '#555555',
  '9': '#5555ff',
  a: '#55ff55',
  b: '#55ffff',
  c: '#ff5555',
  d: '#ff55ff',
  e: '#ffff55',
  f: '#ffffff',
};

export default function RankPrefix({ prefix, name }: { prefix: string; name?: string }) {
  const parts: { text: string; color?: string }[] = [];
  let color: string | undefined;
  let text = '';
  for (let i = 0; i < prefix.length; i++) {
    const code = prefix[i + 1]?.toLowerCase();
    if ((prefix[i] === '&' || prefix[i] === '§') && code && /[0-9a-fk-or]/.test(code)) {
      if (text) parts.push({ text, color });
      text = '';
      color = COLORS[code] ?? (code === 'r' ? undefined : color);
      i++;
    } else {
      text += prefix[i];
    }
  }
  if (text) parts.push({ text, color });

  return (
    <span className='font-mono text-sm rounded px-1.5 py-0.5 bg-black/70 text-[#aaaaaa] whitespace-pre'>
      {parts.length === 0 && !name ? <span className='opacity-60'>(no prefix)</span> : null}
      {parts.map((part, index) => (
        <span key={index} style={{ color: part.color }}>
          {part.text}
        </span>
      ))}
      {name && <span className='text-white'>{name}</span>}
    </span>
  );
}
