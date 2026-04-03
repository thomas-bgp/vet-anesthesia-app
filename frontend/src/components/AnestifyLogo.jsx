export default function AnestifyLogo({ size = 24, color = 'white', className = '' }) {
  return (
    <svg viewBox="0 0 56 38" width={size} height={size * 38/56} className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 16 L7.5 9 L11.5 13.5 L15 9 L17 16 C18.5 13.5 21 12 24 12 L27 12 L29 15 L31.5 8 L34 17 L36 12 L38 15 C40 17.5 43 19 47 18" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 16 C3.5 20 3.5 24 5.5 27 C8 30 13.5 31 20 31 C26 31 31.5 30 36 27.5" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 19.5 C10.8 20.3 11.8 20.3 12.5 19.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M14 19 C14.8 19.8 15.8 19.8 16.5 19" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
