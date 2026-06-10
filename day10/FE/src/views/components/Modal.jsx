// VIEW — modal tái dùng (đóng khi click nền / nút X / phím Esc).
import { useEffect } from 'react'

export default function Modal({ title, subtitle, onClose, children, actions }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{title}</div>
            {subtitle && <div className="muted mono" style={{ fontSize: 12 }}>{subtitle}</div>}
          </div>
          {actions}
          <button className="x" onClick={onClose} title="Đóng (Esc)">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
