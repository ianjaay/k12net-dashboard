import { MoreVertical, Trash2, Edit3, Share2, LogOut } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { SessionDoc, SessionRole } from '../../types';

interface Props {
  session: { id: string } & SessionDoc;
  userRole: SessionRole;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onShare: () => void;
  onLeave: () => void;
}

export default function SessionCard({ session, userRole, onClick, onRename, onDelete, onShare, onLeave }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(session.name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updatedAt = session.updatedAt as { seconds?: number } | null;
  const dateStr = updatedAt?.seconds
    ? new Date(updatedAt.seconds * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const handleRename = () => {
    if (nameInput.trim() && nameInput !== session.name) {
      onRename(nameInput.trim());
    }
    setRenaming(false);
  };

  return (
    <div className="card-cassie p-5 cursor-pointer hover:shadow-md transition-shadow relative group" onClick={onClick}>
      {/* Menu */}
      <div className="absolute top-3 right-3" ref={menuRef} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#8392a5' }}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-40 bg-white border rounded shadow-lg z-10" style={{ borderColor: '#e6e7ef' }}>
            {userRole === 'owner' && (
              <>
                <button onClick={() => { setRenaming(true); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#f9f9fd]"
                  style={{ color: '#575d78' }}>
                  <Edit3 className="w-3.5 h-3.5" /> Renommer
                </button>
                <button onClick={() => { onShare(); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#f9f9fd]"
                  style={{ color: '#575d78' }}>
                  <Share2 className="w-3.5 h-3.5" /> Partager
                </button>
                <button onClick={() => { onDelete(); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#f9f9fd]"
                  style={{ color: '#dc3545' }}>
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              </>
            )}
            {userRole !== 'owner' && (
              <button onClick={() => { onLeave(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#f9f9fd]"
                style={{ color: '#dc3545' }}>
                <LogOut className="w-3.5 h-3.5" /> Quitter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {renaming ? (
        <input
          type="text"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onBlur={handleRename}
          onKeyDown={e => e.key === 'Enter' && handleRename()}
          autoFocus
          onClick={e => e.stopPropagation()}
          className="text-base font-semibold w-full px-2 py-1 rounded border outline-none mb-1"
          style={{ borderColor: '#5556fd', color: '#06072d' }}
        />
      ) : (
        <h3 className="text-base font-semibold mb-1 pr-6" style={{ color: '#06072d' }}>{session.name}</h3>
      )}

      {session.description && (
        <p className="text-sm mb-3 line-clamp-2" style={{ color: '#8392a5' }}>{session.description}</p>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs" style={{ color: '#c0ccda' }}>Modifié le {dateStr}</span>
        {userRole !== 'owner' && (
          <span className="text-[10px] px-2 py-0.5 rounded font-medium"
            style={{
              background: userRole === 'editor' ? '#e8e8ff' : '#f3f6f9',
              color: userRole === 'editor' ? '#5556fd' : '#8392a5',
            }}>
            {userRole === 'editor' ? 'Éditeur' : 'Lecteur'}
          </span>
        )}
      </div>
    </div>
  );
}
