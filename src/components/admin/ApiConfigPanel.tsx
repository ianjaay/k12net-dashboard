/**
 * ApiConfigPanel — Global OneRoster API configuration (shown in SuperAdmin).
 * Connects to a K12net tenant and tests the connection.
 */
import { useState, useCallback, useEffect } from 'react';
import { Plug, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { OneRosterApiConfig } from '../../types/oneRoster';
import { OneRosterService } from '../../lib/oneRosterService';
import { getApiConfig, saveApiConfig } from '../../lib/educationDB';

interface Props {
  onConfigReady?: (config: OneRosterApiConfig) => void;
}

export default function ApiConfigPanel({ onConfigReady }: Props) {
  const [baseUrl, setBaseUrl] = useState('https://azure.k12net.com/INTCore.Web');
  const [tokenUrl, setTokenUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scope, setScope] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getApiConfig().then(saved => {
      if (saved) {
        setBaseUrl(saved.baseUrl);
        setTokenUrl(saved.tokenUrl);
        setClientId(saved.clientId);
        setClientSecret(saved.clientSecret);
        setScope(saved.scope ?? '');
        setTestResult({ success: true, message: 'Configuration chargée' });
        onConfigReady?.(saved);
      }
      setLoaded(true);
    });
  }, []);

  const buildConfig = (): OneRosterApiConfig => ({
    id: 'default',
    baseUrl: baseUrl.trim(),
    tokenUrl: tokenUrl.trim(),
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    scope: scope.trim() || undefined,
    syncMode: 'full',
    autoSyncEnabled: false,
    activeOnly: true,
  });

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    const config = buildConfig();
    const svc = new OneRosterService(config);
    const result = await svc.testConnection();

    if (result.success) {
      setTestResult({
        success: true,
        message: `Connexion réussie${result.tokenExpiry ? ` — expire dans ${Math.round((result.tokenExpiry.getTime() - Date.now()) / 60000)} min` : ''}`,
      });
    } else {
      setTestResult({ success: false, message: result.error ?? 'Échec de connexion' });
    }
    setTesting(false);
  }, [baseUrl, tokenUrl, clientId, clientSecret, scope]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const config = buildConfig();
    await saveApiConfig(config);
    onConfigReady?.(config);
    setSaving(false);
  }, [baseUrl, tokenUrl, clientId, clientSecret, scope, onConfigReady]);

  const isComplete = baseUrl && tokenUrl && clientId && clientSecret;

  if (!loaded) return null;

  return (
    <div className="card-cassie p-5">
      <div className="flex items-center gap-2 mb-4">
        <Plug className="w-4 h-4" style={{ color: '#5556fd' }} />
        <h3 className="font-medium text-sm" style={{ color: '#06072d' }}>
          Configuration API OneRoster (K12net)
        </h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>URL du service *</label>
          <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border" style={{ borderColor: '#e6e7ef' }}
            placeholder="https://azure.k12net.com/INTCore.Web" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>URL du token (OAuth2) *</label>
          <input type="url" value={tokenUrl} onChange={e => setTokenUrl(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border" style={{ borderColor: '#e6e7ef' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>Client ID *</label>
          <input type="text" value={clientId} onChange={e => setClientId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border" style={{ borderColor: '#e6e7ef' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>Client Secret *</label>
          <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border" style={{ borderColor: '#e6e7ef' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>Scope (optionnel)</label>
          <input type="text" value={scope} onChange={e => setScope(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border" style={{ borderColor: '#e6e7ef' }}
            placeholder="api1" />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={handleTest} disabled={!isComplete || testing}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#5556fd' }}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
          Tester
        </button>
        <button onClick={handleSave} disabled={!testResult?.success || saving}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium border disabled:opacity-50"
          style={{ borderColor: '#e6e7ef', color: '#5556fd' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        {testResult && (
          <div className="flex items-center gap-2 text-xs">
            {testResult.success ? (
              <CheckCircle className="w-4 h-4" style={{ color: '#22d273' }} />
            ) : (
              <AlertCircle className="w-4 h-4" style={{ color: '#ff4d4f' }} />
            )}
            <span style={{ color: testResult.success ? '#22d273' : '#ff4d4f' }}>
              {testResult.message}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
