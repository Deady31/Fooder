'use client';
import { useEffect, useState } from 'react';
import { Consent, getConsent, setConsent } from '../../lib/analytics';

export function ConsentSettings() {
  const [value, setValue] = useState<Consent | null>(null);

  useEffect(() => setValue(getConsent()), []);

  const choose = (next: Consent) => {
    setConsent(next);
    setValue(next);
  };

  return (
    <div className='bg-white panel rounded-3xl p-4 not-prose'>
      <p className='text-sm font-bold text-plum'>
        Mesure d&apos;audience : {value === 'granted' ? 'acceptée' : value === 'denied' ? 'refusée' : 'pas encore choisie'}
      </p>
      <div className='flex gap-2 mt-3'>
        <button onClick={() => choose('denied')} aria-pressed={value === 'denied'} className={`duo-button flex-1 text-sm text-plum ${value === 'denied' ? 'bg-lemon' : 'bg-white'}`}>
          Refuser
        </button>
        <button onClick={() => choose('granted')} aria-pressed={value === 'granted'} className={`duo-button flex-1 text-sm text-plum ${value === 'granted' ? 'bg-lemon' : 'bg-bubblegum'}`}>
          Accepter
        </button>
      </div>
    </div>
  );
}
