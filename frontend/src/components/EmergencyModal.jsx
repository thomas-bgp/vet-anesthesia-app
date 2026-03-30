import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

// ─── Emergency drugs data ────────────────────────────────────────────────────
const EMERGENCY_DRUGS = [
  {
    name: 'Atropina',
    doseMin: 0.022, doseMax: 0.044, doseDefault: 0.044,
    concentrations: [0.5, 0.25], defaultConcentration: 0.5,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Adrenalina',
    doseMin: 0.01, doseMax: 0.01, doseDefault: 0.01,
    concentrations: [1], defaultConcentration: 1,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Efedrina',
    doseMin: 0.1, doseMax: 0.1, doseDefault: 0.1,
    concentrations: [5], defaultConcentration: 5,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Lidocaína',
    doseMin: 2, doseMax: 2, doseDefault: 2,
    concentrations: [20], defaultConcentration: 20,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Amiodarona',
    doseMin: 5, doseMax: 5, doseDefault: 5,
    concentrations: [50], defaultConcentration: 50,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Naloxona',
    doseMin: 0.04, doseMax: 0.04, doseDefault: 0.04,
    concentrations: [0.4], defaultConcentration: 0.4,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Flumazenil',
    doseMin: 0.01, doseMax: 0.1, doseDefault: 0.1,
    concentrations: [0.1], defaultConcentration: 0.1,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Doxapram',
    doseMin: 1, doseMax: 1, doseDefault: 1,
    concentrations: [20], defaultConcentration: 20,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Furosemida',
    doseMin: 2, doseMax: 4, doseDefault: 4,
    concentrations: [50], defaultConcentration: 50,
    route: 'IV', note: null, speciesFilter: null,
  },
  {
    name: 'Diazepam',
    doseMin: 0.5, doseMax: 1, doseDefault: 1,
    concentrations: [5], defaultConcentration: 5,
    route: 'IV', note: null, speciesFilter: null,
  },
]

function fmtDose(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return Number(n.toFixed(decimals)).toString()
}

function fmtDoseRange(drug) {
  if (drug.doseMin === drug.doseMax) return `${drug.doseMin} mg/kg`
  return `${drug.doseMin}–${drug.doseMax} mg/kg`
}

export default function EmergencyModal({ surgery, onClose }) {
  const weight = parseFloat(surgery.patient_weight)
  const hasWeight = !isNaN(weight) && weight > 0
  const species = (surgery.patient_species || '').toLowerCase()
  const isCanine = species.includes('cão') || species.includes('cao') ||
                   species.includes('canino') || species.includes('dog')

  const drugs = EMERGENCY_DRUGS.filter(d => !d.speciesFilter || isCanine)

  // Per-drug selected dose and concentration
  const [selectedDoses, setSelectedDoses] = useState(() => {
    const init = {}
    EMERGENCY_DRUGS.forEach(d => { init[d.name] = d.doseDefault })
    return init
  })
  const [selectedConc, setSelectedConc] = useState(() => {
    const init = {}
    EMERGENCY_DRUGS.forEach(d => { init[d.name] = d.defaultConcentration })
    return init
  })

  const cycleDose = (drug) => {
    if (drug.doseMin === drug.doseMax) return
    setSelectedDoses(prev => {
      const current = prev[drug.name]
      // Cycle: max -> min -> max
      const next = current === drug.doseMax ? drug.doseMin : drug.doseMax
      return { ...prev, [drug.name]: next }
    })
  }

  const cycleConcentration = (drug) => {
    if (drug.concentrations.length <= 1) return
    setSelectedConc(prev => {
      const current = prev[drug.name]
      const idx = drug.concentrations.indexOf(current)
      const next = drug.concentrations[(idx + 1) % drug.concentrations.length]
      return { ...prev, [drug.name]: next }
    })
  }

  return (
    <div
      className="emergency-modal-overlay fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md m-4 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Red header */}
        <div className="bg-red-600 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} className="text-white" />
            <span className="text-white text-xl font-black tracking-widest uppercase">Emergência</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-red-700 active:bg-red-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Patient info */}
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <p className="font-bold text-slate-800 text-base">{surgery.patient_name}</p>
          <p className="text-sm text-slate-600">
            {surgery.patient_species && <span>{surgery.patient_species} · </span>}
            {hasWeight
              ? <span className="font-semibold text-red-700">{weight} kg</span>
              : <span className="text-red-600 font-semibold">Peso não informado</span>
            }
          </p>
        </div>

        {/* Drug list */}
        <div className="bg-white divide-y divide-slate-100">
          {!hasWeight && (
            <div className="px-4 py-4 text-sm text-red-600 font-medium text-center">
              Cadastre o peso do paciente para calcular as doses.
            </div>
          )}
          {drugs.map((drug) => {
            const currentDose = selectedDoses[drug.name] || drug.doseDefault
            const currentConc = selectedConc[drug.name] || drug.defaultConcentration
            const doseMg   = hasWeight ? weight * currentDose : null
            const volumeMl = hasWeight ? doseMg / currentConc : null
            const hasDoseRange = drug.doseMin !== drug.doseMax
            const hasMultiConc = drug.concentrations.length > 1

            return (
              <div key={drug.name} className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-base">{drug.name}</span>
                    {drug.note && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        {drug.note}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {fmtDoseRange(drug)} · {drug.route} · {currentConc} mg/mL
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {hasDoseRange && (
                      <button
                        type="button"
                        onClick={() => cycleDose(drug)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold active:bg-blue-100 border border-blue-200"
                      >
                        {currentDose} mg/kg
                      </button>
                    )}
                    {hasMultiConc && (
                      <button
                        type="button"
                        onClick={() => cycleConcentration(drug)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold active:bg-purple-100 border border-purple-200"
                      >
                        {currentConc} mg/mL
                      </button>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {hasWeight ? (
                    <>
                      <p className="text-lg font-black text-red-700 leading-tight">{fmtDose(volumeMl)} mL</p>
                      <p className="text-xs font-medium text-slate-500">{fmtDose(doseMg)} mg</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
          <p className="text-[10px] text-slate-400 text-center leading-snug">
            Doses de referência. Confirme com o protocolo institucional.
          </p>
          <button
            onClick={onClose}
            className="mt-2 w-full py-3 bg-slate-200 text-slate-700 font-semibold rounded-xl active:bg-slate-300 text-sm min-h-[44px]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
