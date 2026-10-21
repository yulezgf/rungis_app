'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// Principe d'interface « walk your core flow » (voir CLAUDE.md) : après chaque action,
// une bannière dit CE QUI VIENT DE SE PASSER et propose de REVENIR EN ARRIÈRE.
// Remplace les alert() : même les erreurs s'affichent ici, en rouge.

type FlashMessage = {
  id: number
  text: string
  tone: 'ok' | 'error'
  undoLabel?: string // « Annuler », « Relâcher »…
  onUndo?: () => void
}

type ShowOptions = { tone?: 'ok' | 'error'; undoLabel?: string; onUndo?: () => void }

export function useFlash() {
  const [flash, setFlash] = useState<FlashMessage | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setFlash(null)
  }, [])

  // Affiche un message ; il disparaît tout seul (un peu plus tard pour une erreur)
  const show = useCallback((text: string, options: ShowOptions = {}) => {
    if (timer.current) clearTimeout(timer.current)
    const tone = options.tone ?? 'ok'
    setFlash({ id: Date.now(), text, tone, undoLabel: options.undoLabel, onUndo: options.onUndo })
    timer.current = setTimeout(() => setFlash(null), tone === 'error' ? 8000 : 6000)
  }, [])

  // Pas de minuterie qui traîne quand on quitte la page
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return { flash, show, hide }
}

export function FlashBar({ flash, onClose }: { flash: FlashMessage | null; onClose: () => void }) {
  if (!flash) return null
  const isError = flash.tone === 'error'
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      role="status"
      aria-live="polite"
    >
      <div
        key={flash.id}
        className={`pointer-events-auto max-w-3xl mx-auto rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 ${
          isError ? 'bg-red-700 text-white' : 'bg-stone-900 text-white'
        }`}
      >
        <p className="flex-1 text-sm">{flash.text}</p>
        {flash.onUndo && (
          <button
            onClick={() => {
              flash.onUndo?.()
              onClose()
            }}
            className="shrink-0 font-semibold text-amber-300 underline"
          >
            {flash.undoLabel ?? 'Annuler'}
          </button>
        )}
        <button onClick={onClose} aria-label="Fermer" className="shrink-0 text-white/60 text-lg leading-none">
          ×
        </button>
      </div>
    </div>
  )
}
