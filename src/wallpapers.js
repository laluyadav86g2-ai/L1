export const WALLPAPERS = [
  { name: 'First Light', colors: ['#102c28', '#296f5c', '#b7f17b', '#e4f4c9'] },
  { name: 'Quiet Current', colors: ['#101f34', '#245c78', '#7dd9d0', '#d5fff4'] },
  { name: 'Soft Focus', colors: ['#241b35', '#684d79', '#d49bc6', '#f4d8ea'] },
  { name: 'Warmth', colors: ['#35241c', '#8a4b31', '#f3aa66', '#ffe0a3'] },
  { name: 'Higher Ground', colors: ['#202b1c', '#4b693c', '#b1cf77', '#e4efb0'] },
  { name: 'Night Bloom', colors: ['#171b38', '#464880', '#a792fa', '#dfd3ff'] },
  { name: 'Open Sky', colors: ['#102a39', '#26738a', '#79d7e2', '#d8f7f2'] },
  { name: 'Slow Morning', colors: ['#30202c', '#845067', '#e19b9d', '#ffdec7'] },
  { name: 'Still Water', colors: ['#102a36', '#286d80', '#8ad0c7', '#e0f8df'] },
  { name: 'New Leaf', colors: ['#222919', '#65713c', '#d1ce78', '#f0eab4'] },
  { name: 'Ember', colors: ['#321c20', '#8b3835', '#f17954', '#ffc384'] },
  { name: 'Solstice', colors: ['#30291a', '#776332', '#e2b858', '#fff0ad'] },
  { name: 'Deep Breath', colors: ['#102d32', '#2f746d', '#84d2aa', '#d8f4c7'] },
  { name: 'Blue Hour', colors: ['#171e39', '#3c578d', '#87b6e8', '#dbe6ff'] },
  { name: 'Wildflower', colors: ['#2a1f32', '#765070', '#dd9fc5', '#fce0d1'] },
  { name: 'Horizon', colors: ['#132a32', '#397776', '#b1d897', '#f0d38d'] },
  { name: 'Slow Burn', colors: ['#301e22', '#763b43', '#d87766', '#ffca9b'] },
  { name: 'Starlit', colors: ['#10192f', '#293c68', '#8292c8', '#deddfa'] },
  { name: 'Daybreak', colors: ['#332318', '#8a5230', '#f0a05a', '#ffe1a0'] },
  { name: 'Unbound', colors: ['#102b2b', '#28756c', '#91ddb6', '#e4f6bd'] },
];

function artShapes(index, id, accent, highlight) {
  const variant = index % 4;
  if (variant === 0) {
    return `
      <circle cx="525" cy="380" r="270" fill="${accent}" opacity=".2"/>
      <circle cx="525" cy="380" r="192" fill="none" stroke="${highlight}" stroke-opacity=".38" stroke-width="2"/>
      <circle cx="525" cy="380" r="154" fill="url(#glow-${id})" opacity=".76"/>
      <circle cx="525" cy="380" r="116" fill="none" stroke="${highlight}" stroke-opacity=".35" stroke-width="2"/>
      <path d="M0 1030c145-128 282-161 429-93s190 55 291-12v355H0z" fill="${accent}" opacity=".36"/>
      <path d="M0 1128c184-92 297-86 439-20s189 69 281 20v152H0z" fill="${highlight}" opacity=".17"/>`;
  }
  if (variant === 1) {
    return `
      <path d="M-80 390c146-161 307-201 483-120s256 73 397-43v307c-132 97-250 129-400 56S135 504-80 678z" fill="${accent}" opacity=".24"/>
      <path d="M-80 575c170-144 329-150 496-51s247 106 384 19v315c-142 99-287 80-427 5S114 818-80 962z" fill="${highlight}" opacity=".15"/>
      <path d="M-80 840c176-103 303-82 464 3s273 100 416 17v328H-80z" fill="${accent}" opacity=".32"/>
      <circle cx="493" cy="348" r="108" fill="url(#glow-${id})" opacity=".78"/>
      <circle cx="493" cy="348" r="171" fill="none" stroke="${highlight}" stroke-opacity=".28" stroke-width="2"/>`;
  }
  if (variant === 2) {
    return `
      <circle cx="370" cy="490" r="234" fill="none" stroke="${highlight}" stroke-opacity=".3" stroke-width="2"/>
      <circle cx="370" cy="490" r="174" fill="${accent}" opacity=".18"/>
      <circle cx="370" cy="490" r="110" fill="url(#glow-${id})" opacity=".83"/>
      <path d="M370 180v620M60 490h620M151 271l438 438M589 271 151 709" stroke="${highlight}" stroke-opacity=".14" stroke-width="2"/>
      <path d="M0 980c145-62 271-73 401-13s210 80 319 32v281H0z" fill="${accent}" opacity=".31"/>
      <path d="M0 1080c170-32 273-30 413 17s209 47 307 12v171H0z" fill="${highlight}" opacity=".13"/>`;
  }
  return `
    <path d="M0 0h720v1280H0z" fill="url(#grid-${id})" opacity=".21"/>
    <path d="M-80 240 290-75h210L-80 540zM185 1350l615-620v183l-432 437z" fill="${accent}" opacity=".19"/>
    <path d="M-80 910 530 300h180L-80 1190z" fill="${highlight}" opacity=".1"/>
    <rect x="145" y="320" width="430" height="430" rx="215" fill="none" stroke="${highlight}" stroke-opacity=".33" stroke-width="2"/>
    <rect x="210" y="385" width="300" height="300" rx="150" fill="url(#glow-${id})" opacity=".77"/>
    <path d="M90 900h540M90 936h390" stroke="${highlight}" stroke-opacity=".24" stroke-width="2"/>`;
}

export function wallpaperSvg(index, width = 720, height = 1280) {
  const wallpaper = WALLPAPERS[index];
  if (!wallpaper) throw new RangeError('Unknown wallpaper.');
  const [base, middle, accent, highlight] = wallpaper.colors;
  const id = `wallpaper-${index}`;
  const stars = Array.from({ length: 22 }, (_, star) => {
    const x = (star * 173 + index * 83 + 31) % 680 + 20;
    const y = (star * 257 + index * 67 + 55) % 1110 + 40;
    const radius = star % 5 === 0 ? 3 : 1.7;
    const opacity = star % 4 === 0 ? 0.75 : 0.36;
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${highlight}" opacity="${opacity}"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 720 1280">
    <defs>
      <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${base}"/><stop offset=".52" stop-color="${middle}"/><stop offset="1" stop-color="${base}"/>
      </linearGradient>
      <radialGradient id="glow-${id}" cx="50%" cy="45%" r="60%">
        <stop offset="0" stop-color="${highlight}" stop-opacity=".86"/><stop offset=".48" stop-color="${accent}" stop-opacity=".64"/><stop offset="1" stop-color="${middle}" stop-opacity=".02"/>
      </radialGradient>
      <pattern id="grid-${id}" width="54" height="54" patternUnits="userSpaceOnUse">
        <path d="M54 0H0v54" fill="none" stroke="${highlight}" stroke-opacity=".32" stroke-width="1"/>
      </pattern>
      <filter id="blur-${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter>
    </defs>
    <rect width="720" height="1280" fill="url(#bg-${id})"/>
    <ellipse cx="360" cy="440" rx="250" ry="315" fill="${accent}" opacity=".13" filter="url(#blur-${id})"/>
    ${artShapes(index, id, accent, highlight)}
    <g>${stars}</g>
    <rect x="20" y="20" width="680" height="1240" rx="26" fill="none" stroke="${highlight}" stroke-opacity=".11" stroke-width="2"/>
  </svg>`;
}

export function wallpaperDataUrl(index, width = 720, height = 1280) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wallpaperSvg(index, width, height))}`;
}
