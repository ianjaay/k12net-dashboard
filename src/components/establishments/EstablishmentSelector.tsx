import { useNavigate } from 'react-router-dom';
import { Building2, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useEstablishment } from '../../contexts/EstablishmentContext';

export default function EstablishmentSelector() {
  const { user, isGuest, logout } = useAuth();
  const { userEstablishments, switchEstablishment, loading } = useEstablishment();
  const navigate = useNavigate();

  const handleSelect = async (id: string) => {
    await switchEstablishment(id);
    navigate('/sessions');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f9fd' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#8392a5' }}>Chargement des établissements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9f9fd' }}>
      <header className="bg-white border-b" style={{ borderColor: '#e6e7ef' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: '#f0f0ff' }}>
              <Building2 className="w-5 h-5" style={{ color: '#5556fd' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#06072d' }}>K12net Dashboard</h1>
              <p className="text-xs" style={{ color: '#8392a5' }}>Sélectionnez un établissement</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: '#575d78' }}>
              {isGuest ? 'Invité' : (user?.displayName || user?.email)}
            </span>
            <button onClick={logout} className="p-2 rounded hover:bg-[#f9f9fd]" style={{ color: '#8392a5' }} title="Déconnexion">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#06072d' }}>
            Choisir un établissement
          </h2>
          <p className="text-sm" style={{ color: '#8392a5' }}>
            Vous avez accès à {userEstablishments.length} établissement{userEstablishments.length > 1 ? 's' : ''}. Sélectionnez celui dans lequel vous souhaitez travailler.
          </p>
        </div>

        {userEstablishments.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-full mb-4" style={{ background: '#f0f0ff' }}>
              <Building2 className="w-8 h-8" style={{ color: '#5556fd' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#06072d' }}>
              Aucun établissement
            </h3>
            <p className="text-sm" style={{ color: '#8392a5' }}>
              Vous n'êtes affecté à aucun établissement. Contactez un administrateur.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {userEstablishments.map(est => (
              <button
                key={est.id}
                onClick={() => handleSelect(est.id)}
                className="bg-white rounded-xl p-6 text-left transition-all hover:shadow-md hover:border-[#5556fd] group"
                style={{ border: '1px solid #e6e7ef' }}
              >
                <div className="flex items-start gap-4">
                  {est.logo ? (
                    <img src={est.logo} alt="" className="w-12 h-12 rounded-lg object-contain" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: '#f0f0ff' }}>
                      <Building2 className="w-6 h-6" style={{ color: '#5556fd' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base mb-1 group-hover:text-[#5556fd] transition-colors" style={{ color: '#06072d' }}>
                      {est.name}
                    </h3>
                    {est.code && (
                      <p className="text-xs font-mono mb-1" style={{ color: '#8392a5' }}>Code: {est.code}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#575d78' }}>
                      <span className="px-2 py-0.5 rounded-full" style={{ background: '#f0f0ff', color: '#5556fd' }}>
                        {est.type === 'college' ? 'Collège' : est.type === 'lycee' ? 'Lycée' : 'Collège-Lycée'}
                      </span>
                      {est.city && <span>{est.city}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
