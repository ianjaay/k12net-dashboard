import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export default function CreateSessionModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate(name.trim(), description.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="card-cassie w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold" style={{ color: '#06072d' }}>Nouvelle session</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#f9f9fd]" style={{ color: '#8392a5' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#575d78' }}>Nom de la session *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded border text-sm outline-none"
              style={{ borderColor: '#e6e7ef', color: '#06072d' }}
              placeholder="Ex: Conseil de classe L1 EMSP 2025-2026"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#575d78' }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded border text-sm outline-none resize-none"
              style={{ borderColor: '#e6e7ef', color: '#06072d' }}
              placeholder="Description optionnelle..."
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded text-sm font-medium border"
              style={{ borderColor: '#e6e7ef', color: '#575d78' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading || !name.trim()}
              className="px-4 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#5556fd' }}>
              {loading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
