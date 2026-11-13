'use client';
import { ReactNode, useEffect, useRef } from 'react';
import { StepFrame } from './StepFrame';
import { Choice } from './Choice';
import type { Option } from './options';
import type { StickerName } from '../../lib/stickers';

interface Copy {
  kicker: string;
  title: ReactNode;
  subtitle?: string;
  sticker?: StickerName;
}

const GRID: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2' };
const ADVANCE_DELAY_MS = 260;

interface SingleStepProps<T> extends Copy {
  options: Option<T>[];
  value: T | null;
  onPick: (v: T) => void;
  onNext: () => void;
  columns?: 1 | 2;
}

/** Une seule réponse : on avance tout seul après le tap pour que ça aille vite. */
export function SingleStep<T extends string | number>({ options, value, onPick, onNext, columns = 1, ...copy }: SingleStepProps<T>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pick = (v: T) => {
    onPick(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onNext, ADVANCE_DELAY_MS);
  };

  return (
    <StepFrame {...copy} cta='Continuer' onCta={onNext} ctaDisabled={value === null}>
      <div className={`grid ${GRID[columns]} gap-3 pt-2 pb-1`}>
        {options.map((o, i) => (
          <Choice key={String(o.value)} label={o.label} sub={o.sub} sticker={o.sticker} index={i}
            selected={value === o.value} onClick={() => pick(o.value)} />
        ))}
      </div>
    </StepFrame>
  );
}

interface MultiStepProps<T> extends Copy {
  options: Option<T>[];
  values: T[];
  onChange: (v: T[]) => void;
  onNext: () => void;
  columns?: 1 | 2;
  /** Libellé du bouton quand rien n'est choisi */
  emptyCta: string;
  /** Si défini, ajoute une puce « aucun » qui vide la sélection */
  noneLabel?: string;
}

/** Plusieurs réponses possibles, toutes facultatives. */
export function MultiStep<T extends string>({
  options, values, onChange, onNext, columns = 2, emptyCta, noneLabel, ...copy
}: MultiStepProps<T>) {
  const toggle = (v: T) => onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);

  return (
    <StepFrame {...copy} cta={values.length === 0 ? emptyCta : 'Continuer'} onCta={onNext}>
      <div className={`grid ${GRID[columns]} gap-3 pt-2 pb-1`}>
        {noneLabel && <Choice label={noneLabel} selected={values.length === 0} index={0} onClick={() => onChange([])} />}
        {options.map((o, i) => (
          <Choice key={o.value} label={o.label} sub={o.sub} sticker={o.sticker} index={i + 1}
            selected={values.includes(o.value)} onClick={() => toggle(o.value)} />
        ))}
      </div>
    </StepFrame>
  );
}
