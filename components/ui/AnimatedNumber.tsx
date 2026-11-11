'use client';
import { useEffect, useRef } from 'react';
import { animate, useInView, useMotionValue, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({ value, suffix = '', duration = 0.9, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce || !inView) {
      node.textContent = `${reduce ? value : 0}${suffix}`;
      return;
    }
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => { node.textContent = `${Math.round(v)}${suffix}`; },
    });
    return () => controls.stop();
  }, [value, suffix, duration, inView, reduce, motionValue]);

  return <span ref={ref} className={className}>{`0${suffix}`}</span>;
}
