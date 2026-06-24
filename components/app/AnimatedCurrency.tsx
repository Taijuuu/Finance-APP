'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

/**
 * Animated count-up for a currency amount. Eases from the previous value to the
 * new one whenever `value` changes. Respects prefers-reduced-motion.
 */
export function AnimatedCurrency({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (reduce) { setDisplay(value); prev.current = value; return }
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setDisplay(v),
    })
    prev.current = value
    return () => controls.stop()
  }, [value, reduce])

  return <span className={className}>{formatCurrency(display)}</span>
}
