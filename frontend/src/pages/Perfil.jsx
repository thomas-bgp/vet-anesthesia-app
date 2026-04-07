import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogOut, User, Save, Trash2, Check, Upload, Palette, Plus, Copy, Link2, ChevronUp, ChevronDown, Eye, EyeOff, FileText, X } from 'lucide-react'
import api from '../api/axios'
import InstallButton from '../components/InstallButton'

const DEFAULT_FICHA_SECTIONS = [
  { key: 'paciente', label: 'Dados do Paciente', visible: true },
  { key: 'anamnese', label: 'Anamnese', visible: true },
  { key: 'exame_pre', label: 'Exame Pré-Anestésico', visible: true },
  { key: 'exames_comp', label: 'Exames Complementares', visible: true },
  { key: 'farmacos', label: 'Fármacos Utilizados', visible: true },
  { key: 'vias_aereas', label: 'Vias Aéreas', visible: true },
  { key: 'bloqueios', label: 'Bloqueios', visible: true },
  { key: 'tempos', label: 'Tempos Cirúrgicos', visible: true },
  { key: 'monitorizacao', label: 'Monitoração', visible: true },
  { key: 'intercorrencias', label: 'Intercorrências', visible: true },
  { key: 'pos_operatorio', label: 'Pós-operatório', visible: true },
  { key: 'observacoes', label: 'Observações', visible: true },
]

// Fields configurable within each section
const SECTION_FIELDS = {
  paciente: [
    { key: 'patient_species', label: 'Espécie / Raça' },
    { key: 'patient_weight', label: 'Peso' },
    { key: 'patient_age', label: 'Idade' },
    { key: 'patient_sex', label: 'Sexo' },
    { key: 'owner_name', label: 'Tutor' },
    { key: 'owner_phone', label: 'Telefone tutor' },
    { key: 'clinic_name', label: 'Clínica' },
    { key: 'surgeon_name', label: 'Cirurgião' },
    { key: 'pathology', label: 'Patologia' },
    { key: 'asa_classification', label: 'ASA' },
    { key: 'revenue', label: 'Valor cobrado (R$)' },
  ],
  anamnese: [
    { key: 'fasting', label: 'Jejum (sólido/hídrico)' },
    { key: 'pre_existing_diseases', label: 'Doenças pré-existentes' },
    { key: 'temperament', label: 'Temperamento' },
    { key: 'prior_medications', label: 'Medicações prévias' },
    { key: 'anamnesis_notes', label: 'Observações anamnese' },
  ],
  exame_pre: [
    { key: 'pre_acp', label: 'ACP' },
    { key: 'pre_fc', label: 'FC' },
    { key: 'pre_fr', label: 'FR' },
    { key: 'pre_mucosas', label: 'Mucosas' },
    { key: 'pre_tpc', label: 'TPC' },
    { key: 'pre_temperature', label: 'Temperatura' },
    { key: 'pre_hydration', label: 'Hidratação' },
    { key: 'pre_pas', label: 'PAS' },
    { key: 'pre_pulse', label: 'Pulso' },
    { key: 'general_state', label: 'Estado geral' },
    { key: 'nutritional_state', label: 'Estado nutricional' },
    { key: 'pre_other_alterations', label: 'Outras alterações' },
  ],
  exames_comp: [
    { key: 'hemograma', label: 'Hemograma (Ht, Hb, Eritr, PPT, Plaq, Leuc)' },
    { key: 'hemograma_diff', label: 'Diferencial (N.Segm, N.Bast, Linfócitos)' },
    { key: 'bioquimica', label: 'Bioquímica (Creat, ALT, FA, Ureia, Alb, Glic)' },
    { key: 'imagem', label: 'Imagem (Raio-X, Ultrassom, Eco/ECG)' },
    { key: 'exam_outros', label: 'Outros exames' },
  ],
  vias_aereas: [
    { key: 'airway_type', label: 'Tipo via aérea' },
    { key: 'tube_number', label: 'Tubo nº/tipo' },
    { key: 'breathing_mode', label: 'Modo de respiração' },
    { key: 'ventilation_type', label: 'Tipo de ventilação' },
    { key: 'breathing_system', label: 'Sistema respiratório' },
    { key: 'peep', label: 'PEEP' },
  ],
  tempos: [
    { key: 'anesthesia_start', label: 'Início anestesia' },
    { key: 'procedure_start', label: 'Início procedimento' },
    { key: 'procedure_end', label: 'Final procedimento' },
    { key: 'anesthesia_end', label: 'Final anestesia' },
    { key: 'extubation_time', label: 'Extubação' },
  ],
  pos_operatorio: [
    { key: 'post_operative', label: 'Texto pós-operatório' },
    { key: 'recovery_quality', label: 'Qualidade da recuperação' },
  ],
}

function mergeFichaLayout(saved) {
  if (!saved || !Array.isArray(saved)) return DEFAULT_FICHA_SECTIONS.map(s => ({ ...s }))
  const result = saved.map(s => ({ ...s }))
  for (const def of DEFAULT_FICHA_SECTIONS) {
    if (!result.find(s => s.key === def.key)) result.push({ ...def })
  }
  return result
}

// Get field visibility from layout (missing = visible by default)
function getFieldVis(layout, sectionKey, fieldKey) {
  const sec = layout.find(s => s.key === sectionKey)
  if (!sec || !sec.fields) return true
  return sec.fields[fieldKey] !== false
}

const THEME_COLORS = [
  { name: 'Teal', value: '#19B5A0' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Roxo', value: '#7c3aed' },
  { name: 'Rosa', value: '#e11d48' },
  { name: 'Cinza', value: '#475569' },
]

export default function Perfil() {
  const { user, logout, updateUser } = useAuth()

  const [fullName, setFullName] = useState('')
  const [professionalTitle, setProfessionalTitle] = useState('Médica Veterinária')
  const [crmvNumber, setCrmvNumber] = useState('')
  const [signatureImage, setSignatureImage] = useState(null)
  const [themeColor, setThemeColor] = useState('#19B5A0')
  const [logoImage, setLogoImage] = useState(null)
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Referral codes state (only for max_legacy users)
  const [referrals, setReferrals] = useState([])
  const [loadingReferrals, setLoadingReferrals] = useState(false)
  const [creatingCode, setCreatingCode] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)

  // Ficha layout state
  const [fichaLayout, setFichaLayout] = useState(() => DEFAULT_FICHA_SECTIONS.map(s => ({ ...s })))
  const [showPreview, setShowPreview] = useState(false)
  const [expandedSection, setExpandedSection] = useState(null)

  // Signature pad state
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || user.name || '')
      setProfessionalTitle(user.professional_title || 'Médica Veterinária')
      setCrmvNumber(user.crmv_number || '')
      setSignatureImage(user.signature_image || null)
      setThemeColor(user.theme_color || '#19B5A0')
      setLogoImage(user.logo_image || null)
      setBusinessAddress(user.business_address || '')
      setBusinessPhone(user.business_phone || '')
      setBusinessEmail(user.business_email || '')
      setFichaLayout(mergeFichaLayout(user.ficha_layout))
    }
  }, [user])

  // Fetch referral codes for max_legacy users
  useEffect(() => {
    if (user?.email === 'camilacadibe@gmail.com') {
      setLoadingReferrals(true)
      api.get('/referrals')
        .then(res => setReferrals(res.data.referrals || []))
        .catch(() => {})
        .finally(() => setLoadingReferrals(false))
    }
  }, [user?.plan])

  const createReferralCode = async () => {
    setCreatingCode(true)
    try {
      const res = await api.post('/referrals', {
        grant_plan: 'max_legacy',
        expires_in_days: 365,
        max_uses: 1,
      })
      if (res.data.referral) {
        setReferrals(prev => [res.data.referral, ...prev])
      }
    } catch (err) {
      console.error('Create referral error:', err)
    } finally {
      setCreatingCode(false)
    }
  }

  const copyReferralLink = (code) => {
    navigator.clipboard.writeText(`https://anestify.com.br/register?ref=${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // Initialize canvas
  const canvasInited = useRef(false)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()

    // Only set dimensions once (resetting clears the canvas)
    if (!canvasInited.current) {
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      ctx.scale(2, 2)
      canvasInited.current = true
    }

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1e293b'

    // Draw existing signature if any
    if (signatureImage && !hasDrawn) {
      ctx.clearRect(0, 0, rect.width, rect.height)
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
      }
      img.src = signatureImage
    }
  }, [signatureImage, hasDrawn])

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    }
  }, [])

  const startDraw = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
    setHasDrawn(true)
  }, [getPos])

  const draw = useCallback((e) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }, [isDrawing, getPos])

  const stopDraw = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setHasDrawn(false)
    setSignatureImage(null)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setSignatureImage(dataUrl)
      // Draw on canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        const rect = canvas.getBoundingClientRect()
        ctx.clearRect(0, 0, rect.width, rect.height)
        const img = new Image()
        img.onload = () => {
          const scale = Math.min(rect.width / img.width, rect.height / img.height)
          const w = img.width * scale
          const h = img.height * scale
          const x = (rect.width - w) / 2
          const y = (rect.height - h) / 2
          ctx.drawImage(img, x, y, w, h)
          setHasDrawn(true)
        }
        img.src = dataUrl
      }
    }
    reader.readAsDataURL(file)
  }

  // Logo crop state
  const [rawLogo, setRawLogo] = useState(null) // original image before crop
  const cropCanvasRef = useRef(null)
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, w: 200, h: 70 })
  const [cropImgSize, setCropImgSize] = useState({ w: 0, h: 0, natW: 0, natH: 0 })
  const [dragging, setDragging] = useState(null) // null | 'move' | 'resize'
  const dragStart = useRef({ mx: 0, my: 0, bx: 0, by: 0, bw: 0, bh: 0 })

  const onCropPointerDown = (e, mode) => {
    e.preventDefault()
    setDragging(mode)
    const rect = e.currentTarget.closest('.crop-area').getBoundingClientRect()
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: cropBox.x, by: cropBox.y, bw: cropBox.w, bh: cropBox.h, rx: rect.left, ry: rect.top }
  }

  const CROP_RATIO = 2 // width / height = 2:1

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      if (dragging === 'move') {
        setCropBox(b => ({
          ...b,
          x: Math.max(0, Math.min(cropImgSize.w - b.w, dragStart.current.bx + dx)),
          y: Math.max(0, Math.min(cropImgSize.h - b.h, dragStart.current.by + dy)),
        }))
      } else {
        // Locked 2:1 ratio — width drives height
        const newW = Math.max(80, Math.min(cropImgSize.w - dragStart.current.bx, dragStart.current.bw + dx))
        const newH = newW / CROP_RATIO
        if (dragStart.current.by + newH <= cropImgSize.h) {
          setCropBox(b => ({ ...b, w: newW, h: newH }))
        }
      }
    }
    const onUp = () => setDragging(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [dragging, cropImgSize])

  const confirmCrop = () => {
    if (!rawLogo) return
    const img = new Image()
    img.onload = () => {
      const scaleX = img.naturalWidth / cropImgSize.w
      const scaleY = img.naturalHeight / cropImgSize.h
      const sx = cropBox.x * scaleX, sy = cropBox.y * scaleY
      const sw = cropBox.w * scaleX, sh = cropBox.h * scaleY
      // Output: fixed 240x120 (2:1), crisp for print at 60pt x 30pt
      const outW = 240, outH = 120
      const canvas = document.createElement('canvas')
      canvas.width = outW; canvas.height = outH
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
      setLogoImage(canvas.toDataURL('image/png', 0.9))
      setRawLogo(null)
    }
    img.src = rawLogo
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      // Get signature from canvas if drawn
      let sig = signatureImage
      if (hasDrawn && canvasRef.current) {
        sig = canvasRef.current.toDataURL('image/png')
      }

      const res = await api.put('/auth/profile', {
        full_name: fullName,
        professional_title: professionalTitle,
        crmv_number: crmvNumber,
        signature_image: sig,
        theme_color: themeColor,
        logo_image: logoImage,
        business_address: businessAddress,
        business_phone: businessPhone,
        business_email: businessEmail,
        ficha_layout: fichaLayout,
      })
      if (res.data?.user) {
        updateUser(res.data.user)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <InstallButton />
      {/* User info header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center">
            <User size={28} className="text-teal-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">{user?.name}</p>
            <p className="text-slate-500 text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Professional profile fields */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Dados Profissionais (Carimbo)</h2>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo (para carimbo)</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Dra. Maria da Silva"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Titulo profissional</label>
          <input
            type="text"
            value={professionalTitle}
            onChange={e => setProfessionalTitle(e.target.value)}
            placeholder="Médica Veterinária"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">CRMV</label>
          <input
            type="text"
            value={crmvNumber}
            onChange={e => setCrmvNumber(e.target.value)}
            placeholder="CRMV-RS 12345"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]"
          />
        </div>

        {/* Signature pad */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Assinatura digital</label>
          <p className="text-xs text-slate-400 mb-2">Desenhe com o dedo/mouse ou envie uma imagem</p>
          <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none"
              style={{ height: '150px', display: 'block' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={clearCanvas}
              className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg active:bg-slate-200 min-h-[40px]"
            >
              <Trash2 size={14} />
              Limpar
            </button>
            <label className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg active:bg-slate-200 min-h-[40px] cursor-pointer">
              Enviar imagem
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center justify-center gap-2 w-full py-3 font-medium rounded-xl text-sm min-h-[48px] transition ${
            saved
              ? 'bg-green-100 text-green-700'
              : 'bg-teal-600 text-white active:bg-teal-700'
          }`}
          style={!saved ? { backgroundColor: themeColor } : {}}
        >
          {saved ? (
            <>
              <Check size={18} />
              Salvo!
            </>
          ) : (
            <>
              <Save size={18} />
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </>
          )}
        </button>
      </div>

      {/* Branding / Personalização */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <Palette size={14} />
          Personalização da Ficha
        </h2>

        {/* Theme color */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Cor tema</label>
          <div className="flex gap-3 flex-wrap">
            {THEME_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setThemeColor(c.value)}
                className="w-10 h-10 rounded-full border-2 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{
                  backgroundColor: c.value,
                  borderColor: themeColor === c.value ? '#1e293b' : 'transparent',
                  transform: themeColor === c.value ? 'scale(1.15)' : 'scale(1)',
                }}
                title={c.name}
              >
                {themeColor === c.value && <Check size={18} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* Logo upload + crop */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
          <p className="text-xs text-slate-400 mb-2">Aparece no cabeçalho da ficha impressa</p>

          {rawLogo ? (
            /* ── Crop editor ── */
            <div className="space-y-3">
              <p className="text-xs text-teal-700 font-medium">Arraste para posicionar. Canto = tamanho (proporção 2:1 fixa)</p>
              <div className="crop-area relative overflow-hidden rounded-lg border border-slate-300 bg-slate-900 select-none touch-none"
                style={{ maxHeight: '250px' }}>
                <img src={rawLogo} alt="Crop" className="w-full block" draggable={false}
                  onLoad={e => {
                    const r = e.target.getBoundingClientRect()
                    setCropImgSize({ w: r.width, h: r.height, natW: e.target.naturalWidth, natH: e.target.naturalHeight })
                    // Init crop box centered, 50% width, locked 2:1 ratio
                    const bw = r.width * 0.5, bh = bw / CROP_RATIO
                    setCropBox({ x: (r.width - bw) / 2, y: (r.height - bh) / 2, w: bw, h: bh })
                  }} />
                {/* Dimmed overlay */}
                <div className="absolute inset-0 bg-black/50 pointer-events-none" style={{
                  clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${cropBox.y}px, ${cropBox.x}px ${cropBox.y}px, ${cropBox.x}px ${cropBox.y + cropBox.h}px, ${cropBox.x + cropBox.w}px ${cropBox.y + cropBox.h}px, ${cropBox.x + cropBox.w}px ${cropBox.y}px, 0% ${cropBox.y}px)`
                }} />
                {/* Crop box */}
                <div className="absolute border-2 border-white rounded cursor-move"
                  style={{ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h }}
                  onPointerDown={e => onCropPointerDown(e, 'move')}>
                  {/* Resize handle */}
                  <div className="absolute -bottom-2 -right-2 w-5 h-5 bg-white rounded-full border-2 border-teal-600 cursor-se-resize"
                    onPointerDown={e => { e.stopPropagation(); onCropPointerDown(e, 'resize') }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRawLogo(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg min-h-[44px]">Cancelar</button>
                <button type="button" onClick={confirmCrop}
                  className="flex-1 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg min-h-[44px] active:bg-teal-700">Recortar e usar</button>
              </div>
            </div>
          ) : logoImage ? (
            /* ── Preview ── */
            <div className="flex items-center gap-3">
              <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center" style={{ minWidth: '120px', height: '50px' }}>
                <img src={logoImage} alt="Logo" className="max-h-full max-w-[180px] object-contain" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg active:bg-slate-200 min-h-[36px] cursor-pointer">
                  Trocar
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setRawLogo(ev.target.result); r.readAsDataURL(f) }} className="hidden" />
                </label>
                <button type="button" onClick={() => setLogoImage(null)}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg active:bg-slate-200 min-h-[36px]">
                  <Trash2 size={12} /> Remover
                </button>
              </div>
            </div>
          ) : (
            /* ── Empty state ── */
            <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 text-sm cursor-pointer active:bg-slate-100 min-h-[44px]">
              <Upload size={16} />
              Enviar logo
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setRawLogo(ev.target.result); r.readAsDataURL(f) }} className="hidden" />
            </label>
          )}
        </div>

        {/* Business address */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Endereco</label>
          <input
            type="text"
            value={businessAddress}
            onChange={e => setBusinessAddress(e.target.value)}
            placeholder="Rua Exemplo, 123 - Cidade/UF"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]"
          />
        </div>

        {/* Business phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
          <input
            type="text"
            value={businessPhone}
            onChange={e => setBusinessPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]"
          />
        </div>

        {/* Business email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">E-mail profissional</label>
          <input
            type="email"
            value={businessEmail}
            onChange={e => setBusinessEmail(e.target.value)}
            placeholder="contato@veterinaria.com"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm min-h-[44px]"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center justify-center gap-2 w-full py-3 font-medium rounded-xl text-sm min-h-[48px] transition ${
            saved
              ? 'bg-green-100 text-green-700'
              : 'text-white active:opacity-90'
          }`}
          style={!saved ? { backgroundColor: themeColor } : {}}
        >
          {saved ? (
            <>
              <Check size={18} />
              Salvo!
            </>
          ) : (
            <>
              <Save size={18} />
              {saving ? 'Salvando...' : 'Salvar personalização'}
            </>
          )}
        </button>
      </div>

      {/* Configurar Layout da Ficha */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <FileText size={14} />
            Layout do Documento
          </h2>
          <p className="text-xs text-slate-400 mt-1">Escolha quais seções aparecem e a ordem no documento impresso</p>
        </div>

        <div className="space-y-1">
          {fichaLayout.map((section, i) => {
            const fields = SECTION_FIELDS[section.key]
            const isExpanded = expandedSection === section.key
            return (
              <div key={section.key} className={`rounded-lg border transition ${section.visible ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                <div className="flex items-center gap-2 p-2.5">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button type="button" disabled={i === 0} onClick={() => setFichaLayout(l => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })}
                      className="p-0.5 text-slate-400 disabled:opacity-20 active:text-slate-700"><ChevronUp size={14} /></button>
                    <button type="button" disabled={i === fichaLayout.length - 1} onClick={() => setFichaLayout(l => { const n = [...l]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n })}
                      className="p-0.5 text-slate-400 disabled:opacity-20 active:text-slate-700"><ChevronDown size={14} /></button>
                  </div>
                  <button type="button" onClick={() => fields && section.visible && setExpandedSection(isExpanded ? null : section.key)}
                    className="flex-1 text-left">
                    <span className="text-sm text-slate-700 font-medium">{section.label}</span>
                    {fields && section.visible && <span className="text-[10px] text-slate-400 ml-1">{isExpanded ? '▲' : '▼'}</span>}
                  </button>
                  <button type="button" onClick={() => setFichaLayout(l => l.map((s, idx) => idx === i ? { ...s, visible: !s.visible } : s))}
                    className={`p-2 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center transition ${section.visible ? 'text-teal-600 bg-teal-50' : 'text-slate-400 bg-slate-100'}`}>
                    {section.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                {/* Expandable field toggles */}
                {isExpanded && fields && section.visible && (
                  <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                    <div className="grid grid-cols-1 gap-0.5 mt-2">
                      {fields.map(f => {
                        const vis = getFieldVis(fichaLayout, section.key, f.key)
                        return (
                          <button key={f.key} type="button" onClick={() => {
                            setFichaLayout(l => l.map(s => s.key === section.key ? {
                              ...s, fields: { ...(s.fields || {}), [f.key]: !vis }
                            } : s))
                          }}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition min-h-[40px] ${vis ? 'bg-white' : 'bg-slate-50 opacity-50'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${vis ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                              {vis && <Check size={10} className="text-white" />}
                            </div>
                            <span className="text-xs text-slate-600">{f.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => setFichaLayout(DEFAULT_FICHA_SECTIONS.map(s => ({ ...s })))}
            className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg min-h-[44px] active:bg-slate-200">
            Restaurar padrão
          </button>
          <button type="button" onClick={() => setShowPreview(true)}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg min-h-[44px] active:opacity-90 text-white"
            style={{ backgroundColor: themeColor }}>
            <Eye size={16} className="inline mr-1" />
            Pré-visualizar
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center justify-center gap-2 w-full py-3 font-medium rounded-xl text-sm min-h-[48px] transition ${
            saved ? 'bg-green-100 text-green-700' : 'text-white active:opacity-90'
          }`}
          style={!saved ? { backgroundColor: themeColor } : {}}
        >
          {saved ? <><Check size={18} /> Salvo!</> : <><Save size={18} /> {saving ? 'Salvando...' : 'Salvar layout'}</>}
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setShowPreview(false) }}>
          <div className="bg-white w-full max-w-lg m-4 rounded-2xl overflow-hidden shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Pré-visualização do Documento</h3>
              <button onClick={() => setShowPreview(false)} className="p-2 rounded-lg active:bg-slate-100 min-h-[36px] min-w-[36px] flex items-center justify-center"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              {/* Mock header */}
              <div className="text-center border-b border-slate-200 pb-3" style={{ position: 'relative' }}>
                {logoImage && <img src={logoImage} alt="Logo" style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '30px', objectFit: 'contain' }} />}
                <p className="text-sm font-bold" style={{ color: themeColor }}>{fullName || 'Dr(a). Nome'}</p>
                <p className="text-[10px] text-slate-500">{professionalTitle || 'Médica Veterinária'}{crmvNumber ? ` — ${crmvNumber}` : ''}</p>
                <h2 className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: themeColor }}>Ficha de Registro Anestésico</h2>
              </div>
              {/* Sections in configured order */}
              {fichaLayout.filter(s => s.visible).map(section => (
                <div key={section.key} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{section.label}</p>
                  <div className="space-y-0.5">
                    {section.key === 'paciente' && <>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Paciente:</span> Rex</p>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Espécie:</span> Canino · Labrador</p>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Peso:</span> 32 kg</p>
                    </>}
                    {section.key === 'anamnese' && <>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Jejum sólido:</span> Sim (12h)</p>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Temperamento:</span> Dócil</p>
                    </>}
                    {section.key === 'exame_pre' && <>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">FC:</span> 120 bpm &nbsp;<span className="text-slate-400">FR:</span> 24 mpm</p>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">ASA:</span> II</p>
                    </>}
                    {section.key === 'exames_comp' && <p className="text-xs text-slate-600"><span className="text-slate-400">Ht%:</span> 45 &nbsp;<span className="text-slate-400">Creat:</span> 1.2</p>}
                    {section.key === 'farmacos' && <>
                      <p className="text-xs text-slate-600">MPA: Acepromazina 0.05 mg/kg IV</p>
                      <p className="text-xs text-slate-600">Indução: Propofol 4 mg/kg IV</p>
                    </>}
                    {section.key === 'vias_aereas' && <p className="text-xs text-slate-600"><span className="text-slate-400">IOT:</span> Tubo 7.5 · Espontânea</p>}
                    {section.key === 'bloqueios' && <p className="text-xs text-slate-600">Epidural — Lidocaína 2%</p>}
                    {section.key === 'tempos' && <>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Início anestesia:</span> 14:00</p>
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Final:</span> 15:30</p>
                    </>}
                    {section.key === 'monitorizacao' && <>
                      <div className="overflow-x-auto">
                        <table className="text-[10px] w-full"><thead><tr className="border-b border-slate-200">
                          <th className="text-left py-1 text-slate-400">Hora</th><th className="text-center py-1 text-slate-400">FC</th><th className="text-center py-1 text-slate-400">SpO2</th><th className="text-center py-1 text-slate-400">T°C</th>
                        </tr></thead><tbody>
                          <tr><td className="py-1">14:10</td><td className="text-center">110</td><td className="text-center">98</td><td className="text-center">38.2</td></tr>
                          <tr><td className="py-1">14:20</td><td className="text-center">105</td><td className="text-center">97</td><td className="text-center">37.8</td></tr>
                        </tbody></table>
                      </div>
                    </>}
                    {section.key === 'intercorrencias' && <p className="text-xs text-slate-600"><span className="text-red-500 font-mono">14:15</span> Bradicardia leve, administrado atropina</p>}
                    {section.key === 'pos_operatorio' && <p className="text-xs text-slate-600">Recuperação suave, sem excitação</p>}
                    {section.key === 'observacoes' && <p className="text-xs text-slate-600">Paciente estável durante todo procedimento</p>}
                  </div>
                </div>
              ))}
              {/* Signature block */}
              <div className="border border-teal-300 rounded-lg p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: themeColor }}>Assinatura Eletrônica</p>
                <p className="text-[9px] text-slate-400 mt-0.5">QR Code + Hash SHA256</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Referral codes - only for max_legacy users */}
      {user?.email === 'camilacadibe@gmail.com' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <Link2 size={14} />
              Códigos de Indicação
            </h2>
            <p className="text-xs text-slate-400 mt-1">Gere códigos para dar acesso vitalício ao Anestify</p>
          </div>

          <button
            onClick={createReferralCode}
            disabled={creatingCode}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-50 text-teal-700 font-medium rounded-lg text-sm active:bg-teal-100 transition min-h-[44px] border border-teal-200"
          >
            {creatingCode ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            ) : (
              <>
                <Plus size={16} />
                Novo código
              </>
            )}
          </button>

          {loadingReferrals ? (
            <div className="text-center text-sm text-slate-400 py-4">Carregando...</div>
          ) : referrals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">Nenhum código criado ainda.</p>
          ) : (
            <div className="space-y-2">
              {referrals.map(ref => {
                const status = ref.current_status || (
                  !ref.is_active ? 'inactive' :
                  new Date(ref.expires_at) <= new Date() ? 'expired' :
                  ref.uses >= ref.max_uses ? 'exhausted' : 'active'
                )
                const statusLabel = status === 'active' ? 'Ativo' : status === 'expired' ? 'Expirado' : status === 'exhausted' ? 'Esgotado' : 'Inativo'
                const statusColor = status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                const planLabel = ref.grant_plan === 'max_legacy' ? 'Max vitalício' : 'Free'

                return (
                  <div key={ref.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-mono font-bold text-slate-700">{ref.code}</code>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span>{ref.uses}/{ref.max_uses} usos</span>
                        <span>{planLabel}</span>
                        <span>{new Date(ref.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyReferralLink(ref.code)}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 active:bg-slate-100 min-h-[36px]"
                      title="Copiar link"
                    >
                      {copiedCode === ref.code ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Logout */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl text-sm active:bg-red-100 transition min-h-[48px]"
        >
          <LogOut size={18} />
          Sair da conta
        </button>
      </div>
    </div>
  )
}
