// VIEW — confetti tự viết (không cần thư viện ngoài). Bật khi 10/10.
import { useEffect, useRef } from 'react'

export default function Confetti({ fire }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!fire) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const colors = ['#2ecc71', '#4f8cff', '#7c5cff', '#f6b73c', '#ff4d5e']
    const N = 160
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      r: 4 + Math.random() * 5,
      c: colors[(Math.random() * colors.length) | 0],
      vy: 2 + Math.random() * 3,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
    }))
    let raf
    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      parts.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6)
        ctx.restore()
      })
      t += 1
      if (t < 220) raf = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [fire])

  if (!fire) return null
  return <canvas ref={ref} className="confetti" />
}
