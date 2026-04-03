import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X, UserPlus, Trash2, ChevronDown } from 'lucide-react';
import { shareSession, getSessionMembers, removeSharing, updateRole, getAllUsers } from '../../lib/firestore';
import { useAuth } from '../../contexts/AuthContext';
import type { SessionRole, UserProfile } from '../../types';

interface Props {
  sessionId: string;
  onClose: () => void;
}

interface Member {
  uid: string;
  email: string;
  displayName: string;
  role: SessionRole;
}

export default function ShareSessionModal({ sessionId, onClose }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SessionRole>('reader');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const loadMembers = async () => {
    const m = await getSessionMembers(sessionId);
    setMembers(m);
  };

  useEffect(() => { loadMembers(); }, [sessionId]);
  useEffect(() => {
    getAllUsers().then(list => setAllUsers(list.filter(u => u.status !== 'suspended')));
  }, []);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredUsers = allUsers.filter(u => {
    const q = pickerQuery.toLowerCase();
    return (u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      !members.some(m => m.email === u.email);
  });

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      await shareSession(sessionId, email.trim(), role);
      setEmail('');
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (u: UserProfile) => {
    setEmail(u.email);
    setShowPicker(false);
    setPickerQuery('');
  };

  const handleRemove = async (m: Member) => {
    await removeSharing(sessionId, m.uid, m.email);
    await loadMembers();
  };

  const handleRoleChange = async (m: Member, newRole: SessionRole) => {
    await updateRole(sessionId, m.uid, newRole);
    await loadMembers();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="card-cassie w-full max-w-lg p-6 mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold" style={{ color: '#06072d' }}>Partager la session</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#f9f9fd]" style={{ color: '#8392a5' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add member form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-5">
          <div className="flex-1 relative" ref={pickerRef}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setPickerQuery(e.target.value); setShowPicker(true); }}
              onFocus={() => setShowPicker(true)}
              placeholder="Email de l'utilisateur"
              className="w-full px-3 py-2 pr-8 rounded border text-sm outline-none"
              style={{ borderColor: '#e6e7ef', color: '#06072d' }}
            />
            <button
              type="button"
              onClick={() => setShowPicker(p => !p)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[#f0f0ff]"
              style={{ color: '#8392a5' }}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showPicker && filteredUsers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 border rounded shadow-lg z-10 max-h-48 overflow-y-auto" style={{ background: 'white', borderColor: '#e6e7ef' }}>
                {filteredUsers.filter(u => {
                  const q = (pickerQuery || '').toLowerCase();
                  return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                }).map(u => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-[#f0f0ff] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ background: '#5556fd' }}>
                      {u.photoURL
                        ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                        : (u.displayName || u.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#06072d' }}>{u.displayName || '—'}</p>
                      <p className="text-xs truncate" style={{ color: '#8392a5' }}>{u.email}</p>
                    </div>
                    {u.role === 'admin' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: '#f0f0ff', color: '#5556fd' }}>Admin</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={role}
            onChange={e => setRole(e.target.value as SessionRole)}
            className="px-3 py-2 rounded border text-sm outline-none cassie-select"
            style={{ borderColor: '#e6e7ef', color: '#575d78' }}
          >
            <option value="reader">Lecteur</option>
            <option value="editor">Éditeur</option>
          </select>
          <button type="submit" disabled={loading || !email.trim()}
            className="px-3 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#5556fd' }}>
            <UserPlus className="w-4 h-4" />
          </button>
        </form>

        {error && (
          <div className="mb-4 p-2 rounded text-sm" style={{ background: '#fce8ea', color: '#dc3545' }}>
            {error}
          </div>
        )}

        {/* Members list */}
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.uid} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: '#f9f9fd' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: '#06072d' }}>{m.displayName || m.email}</p>
                <p className="text-xs" style={{ color: '#8392a5' }}>{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.role === 'owner' ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: '#f0f0ff', color: '#5556fd' }}>
                    Propriétaire
                  </span>
                ) : (
                  <>
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m, e.target.value as SessionRole)}
                      className="text-xs px-2 py-1 rounded border outline-none"
                      style={{ borderColor: '#e6e7ef', color: '#575d78' }}
                    >
                      <option value="reader">Lecteur</option>
                      <option value="editor">Éditeur</option>
                    </select>
                    {m.uid !== user?.uid && (
                      <button onClick={() => handleRemove(m)} className="p-1 rounded hover:bg-white" style={{ color: '#dc3545' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
