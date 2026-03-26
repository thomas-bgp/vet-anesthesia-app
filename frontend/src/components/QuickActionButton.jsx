export default function QuickActionButton({ icon: Icon, label, color = 'teal', onClick }) {
  const colorMap = {
    teal: 'bg-teal-600 hover:bg-teal-700 focus-visible:ring-teal-400',
    blue: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-400',
    green: 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-400',
    purple: 'bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-400',
    amber: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-400',
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-2
        w-full h-28 sm:h-32 rounded-xl text-white font-medium
        shadow-sm hover:shadow-md
        transform hover:scale-[1.03] active:scale-[0.98]
        transition-all duration-150 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        cursor-pointer
        ${colorMap[color] || colorMap.teal}
      `}
    >
      {Icon && <Icon size={28} strokeWidth={1.8} />}
      <span className="text-sm leading-tight text-center px-2">{label}</span>
    </button>
  )
}
