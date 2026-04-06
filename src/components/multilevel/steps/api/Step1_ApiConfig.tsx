/**
 * Step1_ApiConfig — Configure OneRoster API connection + test.
 */
import { useState, useCallback } from 'react';
import { Plug, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { OneRosterApiConfig } from '../../../../types/oneRoster';
import { OneRosterService } from '../../../../lib/oneRosterService';
import { getApiConfig, saveApiConfig } from '../../../../lib/educationDB';
import { useEffect } from 'react';

interface Props {
  onNext: (config: OneRosterApiConfig) => void;
}

export default function Step1_ApiConfig({ onNext }: Props) {
  const [baseUrl, setBaseUrl] = useState('https://azure.k12net.com/INTCore.Web');
  const [tokenUrl, setTokenUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scope, setScope] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load saved config on mount
  useEffect(() => {
    getApiConfig().then(saved => {
      if (saved) {
        setBaseUrl(saved.baseUrl);
        setTokenUrl(saved.tokenUrl);
        setClientId(saved.clientId);
        setClientSecret(saved.clientSecret);
        setScope(saved.scope ?? '');
      }
    });
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);

    const config: OneRosterApiConfig = {
      id: 'default',
      baseUrl: baseUrl.trim(),
      tokenUrl: tokenUrl.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      scope: scope.trim() || undefined,
      syncMode: 'full',
      autoSyncEnabled: false,
      activeOnly: true,
    };

    const svc = new OneRosterService(config);
    const result = await svc.testConnection();

    if (result.success) {
      setTestResult({
        success: true,
        message: `Connexion réussie — Token obtenu${result.tokenExpiry ? ` (expire dans ${Math.round((result.tokenExpiry.getTime() - Date.now()) / 60000)} min)` : ''}`,
      });
      // Save configuration
      await saveApiConfig(config);
    } else {
      setTestResult({
        success: false,
        message: result.error ?? 'Échec de connexion',
      });
    }

    setTesting(false);
  }, [baseUrl, tokenUrl, clientId, clientSecret, scope]);

  const handleNext = useCallback(() => {
    const config: OneRosterApiConfig = {
      id: 'default',
      baseUrl: baseUrl.trim(),
      tokenUrl: tokenUrl.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      scope: scope.trim() || undefined,
      syncMode: 'full',
      autoSyncEnabled: false,
      activeOnly: true,
    };
    onNext(config);
  }, [baseUrl, tokenUrl, clientId, clientSecret, scope, onNext]);

  const isComplete = baseUrl && tokenUrl && clientId && clientSecret;

  return (
    <div className="card-cassie p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Plug className="w-5 h-5" style={{ color: '#5556fd' }} />
        <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
          Configuration de la connexion API
        </h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
            URL du service *
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: '#e2e8f0' }}
            placeholder="https://azure.k12net.com/INTCore.Web"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
            URL du token (OAuth2) *
          </label>
          <input
            type="url"
            value={tokenUrl}
            onChange={e => setTokenUrl(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: '#e2e8f0' }}
            placeholder="https://azure.k12net.com/...token"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
            Client ID *
          </label>
          <input
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: '#e2e8f0' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
            Client Secret *
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: '#e2e8f0' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
            Scope (optionnel)
          </label>
          <input
            type="text"
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: '#e2e8f0' }}
            placeholder="api1"
          />
        </div>
      </div>

      {/* Test connection */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={!isComplete || testing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#5556fd' }}
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
          Tester la connexion
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

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleNext}
          disabled={!testResult?.success}
          className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#5556fd' }}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
