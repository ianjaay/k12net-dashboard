import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useEstablishment } from '../../contexts/EstablishmentContext';

export default function EstablishmentSwitcher() {
  const { currentEstablishment, userEstablishments, switchEstablishment } = useEstablishment();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!currentEstablishment || userEstablishments.length <= 1) {
    if (currentEstablishment) {
      return (
        <div className="flex items-center gap-2 px-2 py-1 rounded text-sm" style={{ color: '#575d78' }}>
          <Building2 className="w-4 h-4" style={{ color: '#5556fd' }} />
          <span className="truncate max-w-[180px]">{currentEstablishment.name}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-[#f0f0ff]"
        style={{ color: '#575d78', border: '1px solid #e6e7ef' }}
      >
        <Building2 className="w-4 h-4" style={{ color: '#5556fd' }} />
        <span className="truncate max-w-[180px]">{currentEstablishment.name}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg py-1 z-50"
          style={{ border: '1px solid #e6e7ef' }}
        >
          <div className="px-3 py-2 text-xs font-medium" style={{ color: '#8392a5' }}>
            Changer d'établissement
          </div>
          {userEstablishments.map(est => (
            <button
              key={est.id}
              onClick={async () => {
                await switchEstablishment(est.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-[#f9f9fd] transition-colors"
            >
              {est.logo ? (
                <img src={est.logo} alt="" className="w-7 h-7 rounded object-contain" />
              ) : (
                <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#f0f0ff' }}>
                  <Building2 className="w-3.5 h-3.5" style={{ color: '#5556fd' }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: '#06072d' }}>{est.name}</p>
                {est.city && <p className="text-xs truncate" style={{ color: '#8392a5' }}>{est.city}</p>}
              </div>
              {est.id === currentEstablishment.id && (
                <Check className="w-4 h-4 shrink-0" style={{ color: '#5556fd' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
