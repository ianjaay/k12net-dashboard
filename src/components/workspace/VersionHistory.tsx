import { useState, useEffect } from 'react';
import { History, RotateCcw, Clock } from 'lucide-react';
import { useSession } from '../../contexts/SessionContext';
import { listSnapshots, restoreSnapshot } from '../../lib/firestore';
import type { SnapshotDoc } from '../../types';

export default function VersionHistory() {
  const { sessionId, userRole, refreshData } = useSession();
  const [snapshots, setSnapshots] = useState<Array<{ id: string } & SnapshotDoc>>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const data = await listSnapshots(sessionId);
      setSnapshots(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSnapshots(); }, [sessionId]);

  const handleRestore = async (snapshotId: string) => {
    if (!confirm('Restaurer cette version ? Un snapshot de sauvegarde sera créé avant la restauration.')) return;
    setRestoring(snapshotId);
    try {
      await restoreSnapshot(sessionId, snapshotId);
      await refreshData();
      await loadSnapshots();
    } finally {
      setRestoring(null);
    }
  };

  const canRestore = userRole === 'owner' || userRole === 'editor';

  return (
    <div className="space-y-5">
      <div className="card-cassie p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded" style={{ background: '#f0f0ff' }}>
            <History className="w-5 h-5" style={{ color: '#5556fd' }} />
          </div>
          <div>
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Historique des versions</h6>
            <p className="text-xs" style={{ color: '#8392a5' }}>Chaque upload crée automatiquement un snapshot</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
              style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#8392a5' }}>Chargement...</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-10">
            <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: '#c0ccda' }} />
            <p className="text-sm" style={{ color: '#8392a5' }}>Aucun historique disponible</p>
            <p className="text-xs mt-1" style={{ color: '#c0ccda' }}>Les snapshots seront créés lors des prochains uploads</p>
          </div>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snap, idx) => {
              const createdAt = snap.createdAt as { seconds?: number } | null;
              const dateStr = createdAt?.seconds
                ? new Date(createdAt.seconds * 1000).toLocaleString('fr-FR', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : '—';
              const classCount = snap.data?.classes?.length ?? 0;
              const studentCount = snap.data?.classes?.reduce((sum, c) => sum + (c.students?.length ?? 0), 0) ?? 0;

              return (
                <div key={snap.id} className="flex items-center justify-between px-4 py-3 rounded border" style={{ borderColor: '#e6e7ef' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: idx === 0 ? '#f0f0ff' : '#f9f9fd', color: idx === 0 ? '#5556fd' : '#8392a5' }}>
                      {snapshots.length - idx}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#06072d' }}>{snap.label}</p>
                      <p className="text-xs" style={{ color: '#8392a5' }}>
                        {dateStr} — {classCount} classe{classCount !== 1 ? 's' : ''}, {studentCount} étudiant{studentCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {canRestore && idx > 0 && (
                    <button
                      onClick={() => handleRestore(snap.id)}
                      disabled={restoring === snap.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-50"
                      style={{ borderColor: '#e6e7ef', color: '#5556fd' }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {restoring === snap.id ? 'Restauration...' : 'Restaurer'}
                    </button>
                  )}
                  {idx === 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: '#e6f9ef', color: '#22d273' }}>
                      Actuel
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
