export default function AnestifyLogo({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stylized A */}
      <path d="M50 12 L24 88" stroke={color} strokeWidth="8" strokeLinecap="round"/>
      <path d="M50 12 L76 88" stroke={color} strokeWidth="8" strokeLinecap="round"/>
      <path d="M34 60 L66 60" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      {/* Pulse line extending from the A */}
      <path d="M66 60 L74 60 L80 42 L88 75 L94 55"
            stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
