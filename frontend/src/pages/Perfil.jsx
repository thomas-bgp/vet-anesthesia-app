import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogOut, User, Save, Trash2, Check, Upload, Palette } from 'lucide-react'
import api from '../api/axios'

const THEME_COLORS = [
  { name: 'Teal', value: '#0d9488' },
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
  const [themeColor, setThemeColor] = useState('#0d9488')
  const [logoImage, setLogoImage] = useState(null)
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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
      setThemeColor(user.theme_color || '#0d9488')
      setLogoImage(user.logo_image || null)
      setBusinessAddress(user.business_address || '')
      setBusinessPhone(user.business_phone || '')
      setBusinessEmail(user.business_email || '')
    }
  }, [user])

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
        setCropBox(b => ({
          ...b,
          w: Math.max(60, Math.min(cropImgSize.w - b.x, dragStart.current.bw + dx)),
          h: Math.max(30, Math.min(cropImgSize.h - b.y, dragStart.current.bh + dy)),
        }))
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
      // Output: max 600px wide, keep aspect ratio, PNG with transparency
      const outW = Math.min(600, sw)
      const outH = (sh / sw) * outW
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
              <p className="text-xs text-teal-700 font-medium">Arraste para posicionar, arraste o canto para redimensionar</p>
              <div className="crop-area relative overflow-hidden rounded-lg border border-slate-300 bg-slate-900 select-none touch-none"
                style={{ maxHeight: '250px' }}>
                <img src={rawLogo} alt="Crop" className="w-full block" draggable={false}
                  onLoad={e => {
                    const r = e.target.getBoundingClientRect()
                    setCropImgSize({ w: r.width, h: r.height, natW: e.target.naturalWidth, natH: e.target.naturalHeight })
                    // Init crop box centered, 60% width, 3:1 aspect
                    const bw = r.width * 0.6, bh = bw / 3
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
