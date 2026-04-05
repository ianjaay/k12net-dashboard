/**
 * Breadcrumb — Shows the current navigation path in the hierarchy.
 *
 * Ministère > DRENA Abidjan 1 > Lycée Sainte Marie > 6ème_2
 */
import { ChevronRight, MapPin } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';

export default function Breadcrumb() {
  const { breadcrumbs, goToLevel, anneeScolaire, setAnneeScolaire } = useNavigation();

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-2 rounded-lg" style={{ background: '#f9f9fd', border: '1px solid #e6e7ef' }}>
      <div className="flex items-center gap-1 flex-wrap">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#8392a5' }} />
        {breadcrumbs.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="w-3 h-3" style={{ color: '#c0ccda' }} />}
            {idx < breadcrumbs.length - 1 ? (
              <button
                onClick={() => goToLevel(item.level)}
                className="text-[11px] font-medium transition-colors hover:underline"
                style={{ color: '#5556fd' }}
                title={item.label}
              >
                {item.label.length > 30 ? `${item.label.slice(0, 28)}…` : item.label}
              </button>
            ) : (
              <span
                className="text-[11px] font-bold"
                style={{ color: '#06072d' }}
                title={item.label}
              >
                {item.label.length > 30 ? `${item.label.slice(0, 28)}…` : item.label}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium" style={{ color: '#8392a5' }}>Année :</span>
        <select
          value={anneeScolaire}
          onChange={e => setAnneeScolaire(e.target.value)}
          className="text-[11px] font-bold border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
          style={{ borderColor: '#e6e7ef', color: '#06072d', background: 'white' }}
        >
          <option value="2025">2025–2026</option>
          <option value="2024">2024–2025</option>
          <option value="2023">2023–2024</option>
          <option value="2022">2022–2023</option>
        </select>
      </div>
    </div>
  );
}
