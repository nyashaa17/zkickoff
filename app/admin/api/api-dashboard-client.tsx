'use client';

import React, { useState, useTransition } from 'react';
import { 
  Activity, 
  Key, 
  Settings, 
  Plus, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw,
  Info,
  Server
} from 'lucide-react';
import { 
  SafeApiKey, 
  ApiSettingsRecord 
} from '@/lib/api/types';
import { 
  AnalyticsSummary, 
  updateApiSettingsAction, 
  createApiKeyAction, 
  revokeApiKeyAction, 
  getApiAnalyticsAction, 
  previewRetentionCleanupAction, 
  executeRetentionCleanupAction 
} from '@/app/actions/api-management';

interface Props {
  initialSettings: ApiSettingsRecord | null;
  initialKeys: SafeApiKey[];
  initialAnalytics: AnalyticsSummary | null;
}

export default function ApiDashboardClient({
  initialSettings,
  initialKeys,
  initialAnalytics,
}: Props) {
  const [activeTab, setActiveTab] = useState<'analytics' | 'settings_keys'>('analytics');
  const [settings, setSettings] = useState<ApiSettingsRecord | null>(initialSettings);
  const [keys, setKeys] = useState<SafeApiKey[]>(initialKeys);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(initialAnalytics);
  const [timeRange, setTimeRange] = useState<'24h' | '7d'>('24h');

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Settings form state
  const [isApiEnabled, setIsApiEnabled] = useState(initialSettings?.is_api_enabled ?? false);
  const [defaultMinuteLimit, setDefaultMinuteLimit] = useState(initialSettings?.default_rate_limit_minute ?? 60);
  const [defaultDayLimit, setDefaultDayLimit] = useState(initialSettings?.default_rate_limit_day ?? 10000);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    initialSettings?.maintenance_message ?? 'Developer API is currently disabled for maintenance.'
  );

  // Key creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newDevName, setNewDevName] = useState('');
  const [newDevEmail, setNewDevEmail] = useState('');
  const [newMinuteLimit, setNewMinuteLimit] = useState(60);
  const [newDayLimit, setNewDayLimit] = useState(10000);

  // One-time secret display modal state
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Key revocation modal state
  const [keyToRevoke, setKeyToRevoke] = useState<SafeApiKey | null>(null);
  const [revokeReason, setRevokeReason] = useState('Administrative revocation');

  // Retention cleanup state
  const [retentionDays, setRetentionDays] = useState(90);
  const [allowShortRetention, setAllowShortRetention] = useState(false);
  const [retentionPreview, setRetentionPreview] = useState<any | null>(null);

  const handleRefreshAnalytics = (range: '24h' | '7d') => {
    setTimeRange(range);
    startTransition(async () => {
      const res = await getApiAnalyticsAction(range);
      if (res.success && res.data) {
        setAnalytics(res.data);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to refresh analytics' });
      }
    });
  };

  const handleSaveSettings = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateApiSettingsAction({
        is_api_enabled: isApiEnabled,
        default_rate_limit_minute: defaultMinuteLimit,
        default_rate_limit_day: defaultDayLimit,
        maintenance_message: maintenanceMessage,
      });

      if (res.success && res.data) {
        setSettings(res.data);
        setFeedback({ type: 'success', message: 'Master API settings successfully updated.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update settings.' });
      }
    });
  };

  const handleCreateKey = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await createApiKeyAction({
        name: newKeyName,
        developer_name: newDevName,
        developer_email: newDevEmail,
        rate_limit_minute: newMinuteLimit,
        rate_limit_day: newDayLimit,
      });

      if (res.success && res.data) {
        setKeys([res.data.keyRecord, ...keys]);
        setOneTimeSecret(res.data.plaintextKey);
        setShowCreateModal(false);
        setNewKeyName('');
        setNewDevName('');
        setNewDevEmail('');
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create API key.' });
      }
    });
  };

  const handleRevokeKey = () => {
    if (!keyToRevoke) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await revokeApiKeyAction(keyToRevoke.id, revokeReason);
      if (res.success && res.data) {
        setKeys(keys.map((k) => (k.id === keyToRevoke.id ? res.data! : k)));
        setFeedback({ type: 'success', message: `API Key '${keyToRevoke.name}' successfully revoked.` });
        setKeyToRevoke(null);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to revoke API key.' });
      }
    });
  };

  const handleCopySecret = () => {
    if (!oneTimeSecret) return;
    navigator.clipboard.writeText(oneTimeSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handlePreviewRetention = () => {
    startTransition(async () => {
      const res = await previewRetentionCleanupAction(retentionDays);
      if (res.success) {
        setRetentionPreview(res.data);
        setFeedback({ type: 'success', message: 'Retention preview generated.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Retention preview failed.' });
      }
    });
  };

  const handleExecuteRetention = () => {
    if (!confirm(`Are you sure you want to permanently delete analytics older than ${retentionDays} days?`)) return;
    startTransition(async () => {
      const res = await executeRetentionCleanupAction(retentionDays, allowShortRetention);
      if (res.success) {
        setFeedback({ type: 'success', message: res.data?.message || 'Retention cleanup completed.' });
        setRetentionPreview(null);
        handleRefreshAnalytics(timeRange);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Retention cleanup failed.' });
      }
    });
  };

  const errorRatePercent = analytics && analytics.totalRequests > 0
    ? ((analytics.errorCount / analytics.totalRequests) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-3 border-b border-neutral-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'analytics'
              ? 'bg-zim-green text-white shadow-xs'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          API Analytics
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings_keys')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'settings_keys'
              ? 'bg-zim-green text-white shadow-xs'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <Key className="w-4 h-4" />
          API Settings & Keys
        </button>
      </div>

      {/* Global Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-neutral-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: API ANALYTICS */}
      {/* =================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Controls bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 font-medium">Time Range:</span>
              <button
                type="button"
                onClick={() => handleRefreshAnalytics('24h')}
                disabled={isPending}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  timeRange === '24h'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                24 Hours
              </button>
              <button
                type="button"
                onClick={() => handleRefreshAnalytics('7d')}
                disabled={isPending}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  timeRange === '7d'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                7 Days
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleRefreshAnalytics(timeRange)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Total Requests</div>
              <div className="text-2xl font-extrabold text-neutral-900 mt-1">
                {(analytics?.totalRequests || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">{timeRange} activity</div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Error Rate</div>
              <div className="text-2xl font-extrabold text-neutral-900 mt-1">
                {errorRatePercent}%
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">{analytics?.errorCount || 0} failed calls</div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Rate Limit 429</div>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">
                {(analytics?.rateLimitEvents || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">Throttled requests</div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">P50 Latency</div>
              <div className="text-2xl font-extrabold text-neutral-900 mt-1">
                {analytics?.p50LatencyMs || 0} <span className="text-xs font-normal text-neutral-500">ms</span>
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">Bounded approximation</div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">P95 Latency</div>
              <div className="text-2xl font-extrabold text-neutral-900 mt-1">
                {analytics?.p95LatencyMs || 0} <span className="text-xs font-normal text-neutral-500">ms</span>
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">Bounded approximation</div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Successful (2xx)</div>
              <div className="text-2xl font-extrabold text-green-600 mt-1">
                {(analytics?.status2xx || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">Healthy responses</div>
            </div>
          </div>

          {/* Endpoint Usage Breakdown */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">Endpoint Usage Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="font-mono text-neutral-800">GET /api/v1/matches/live</span>
                  <span className="text-neutral-900 font-extrabold">
                    {analytics?.endpointBreakdown['/api/v1/matches/live'] || 0} calls
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">Real-time scores & live matches</div>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="font-mono text-neutral-800">GET /api/v1/matches/fixtures</span>
                  <span className="text-neutral-900 font-extrabold">
                    {analytics?.endpointBreakdown['/api/v1/matches/fixtures'] || 0} calls
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">Upcoming schedules & completed match history</div>
              </div>
            </div>
          </div>

          {/* Per-Key Activity Table */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">API Key Usage ({timeRange})</h3>
            {(!analytics?.keyUsageBreakdown || analytics.keyUsageBreakdown.length === 0) ? (
              <div className="text-xs text-neutral-500 py-6 text-center">
                No request activity recorded for this time range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-400 uppercase font-bold text-[10px]">
                      <th className="py-2">Key Name</th>
                      <th className="py-2">Developer</th>
                      <th className="py-2 text-right">Requests</th>
                      <th className="py-2 text-right">Errors</th>
                      <th className="py-2 text-right">Rate Limits (429)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {analytics.keyUsageBreakdown.map((item) => (
                      <tr key={item.keyId} className="hover:bg-neutral-50">
                        <td className="py-2.5 font-bold text-neutral-900">{item.keyName}</td>
                        <td className="py-2.5 text-neutral-600">{item.developerName}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-neutral-900">{item.requests}</td>
                        <td className="py-2.5 text-right font-mono text-red-600">{item.errors}</td>
                        <td className="py-2.5 text-right font-mono text-amber-600">{item.rateLimits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Retention Maintenance Controls */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-500" />
              <h3 className="text-sm font-bold text-neutral-900">Analytics Retention Policy</h3>
            </div>
            <p className="text-xs text-neutral-500">
              Approved standard retention is 90 days. A dry-run preview must be executed before data deletion. Hard floor enforces minimum 30 days.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-600 font-medium">Retention Days:</label>
                <input
                  type="number"
                  min="30"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-mono"
                />
              </div>

              {retentionDays < 90 && (
                <label className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                  <input
                    type="checkbox"
                    checked={allowShortRetention}
                    onChange={(e) => setAllowShortRetention(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  Acknowledge short retention (&lt; 90 days)
                </label>
              )}

              <button
                type="button"
                onClick={handlePreviewRetention}
                disabled={isPending}
                className="px-4 py-2 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl transition-colors"
              >
                Preview Deletion (Dry-Run)
              </button>

              <button
                type="button"
                onClick={handleExecuteRetention}
                disabled={isPending}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
              >
                Execute Cleanup
              </button>
            </div>

            {retentionPreview && (
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono space-y-1">
                <div className="font-bold text-neutral-900">Dry-Run Preview Result:</div>
                <div>{JSON.stringify(retentionPreview, null, 2)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: API SETTINGS & KEYS */}
      {/* =================================================================== */}
      {activeTab === 'settings_keys' && (
        <div className="space-y-8">
          {/* Section A: API Master Switch & Global Settings */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-zim-green" />
                  <h3 className="text-sm font-bold text-neutral-900">Developer API Master Configuration</h3>
                </div>
                <p className="text-xs text-neutral-500">
                  Controls global access to all `/api/v1/*` public endpoints. Disabling immediately halts API serving without altering website football features.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isApiEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isApiEnabled ? 'API Enabled' : 'API Disabled'}
                </span>

                <button
                  type="button"
                  onClick={() => setIsApiEnabled(!isApiEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isApiEnabled ? 'bg-zim-green' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      isApiEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700">Default Minute Rate Limit</label>
                <input
                  type="number"
                  min="1"
                  value={defaultMinuteLimit}
                  onChange={(e) => setDefaultMinuteLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs font-mono"
                />
                <p className="text-[11px] text-neutral-400">Default limit applied to new keys (requests / minute).</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700">Default Daily Rate Limit</label>
                <input
                  type="number"
                  min="1"
                  value={defaultDayLimit}
                  onChange={(e) => setDefaultDayLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs font-mono"
                />
                <p className="text-[11px] text-neutral-400">Default daily quota ceiling (requests / 24h window).</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-neutral-700">Maintenance Message</label>
                <input
                  type="text"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs"
                />
                <p className="text-[11px] text-neutral-400">Returned in HTTP 503 response envelope when API is disabled.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isPending}
                className="px-5 py-2.5 bg-zim-green hover:bg-opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                Save Settings
              </button>
            </div>
          </div>

          {/* Section B: API Keys Management Table */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-zim-green" />
                  <h3 className="text-sm font-bold text-neutral-900">Developer API Keys</h3>
                </div>
                <p className="text-xs text-neutral-500">
                  Issue, configure, and revoke developer API keys. Keys authenticate exclusively to the Developer API.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zim-green hover:bg-opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                Create API Key
              </button>
            </div>

            {keys.length === 0 ? (
              <div className="text-xs text-neutral-500 py-10 text-center">
                No developer API keys issued yet. Click &quot;Create API Key&quot; to issue the first key.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-400 uppercase font-bold text-[10px]">
                      <th className="py-2.5">Key Name</th>
                      <th className="py-2.5">Developer</th>
                      <th className="py-2.5">Prefix</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Limits (Min / Day)</th>
                      <th className="py-2.5">Last Used</th>
                      <th className="py-2.5">Created</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {keys.map((k) => (
                      <tr key={k.id} className="hover:bg-neutral-50">
                        <td className="py-3 font-bold text-neutral-900">{k.name}</td>
                        <td className="py-3">
                          <div className="text-neutral-900 font-medium">{k.developer_name}</div>
                          <div className="text-[11px] text-neutral-400">{k.developer_email}</div>
                        </td>
                        <td className="py-3 font-mono text-neutral-600">{k.key_prefix}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              k.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-neutral-200 text-neutral-600'
                            }`}
                          >
                            {k.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-medium text-neutral-800">
                          {k.rate_limit_minute}/m · {k.rate_limit_day}/d
                        </td>
                        <td className="py-3 text-neutral-500 text-[11px]">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 text-neutral-500 text-[11px]">
                          {new Date(k.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          {k.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setKeyToRevoke(k);
                                setRevokeReason('Administrative revocation');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Revoke
                            </button>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">Revoked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE API KEY */}
      {/* =================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-extrabold text-neutral-900">Create Developer API Key</h3>
            <p className="text-xs text-neutral-500">
              The generated secret will be displayed once. Plaintext secrets are never stored in the database.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-700">Key Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mobile Production App"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700">Developer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700">Developer Email</label>
                <input
                  type="email"
                  placeholder="e.g. jane@example.com"
                  value={newDevEmail}
                  onChange={(e) => setNewDevEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-700">Minute Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={newMinuteLimit}
                    onChange={(e) => setNewMinuteLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-700">Daily Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={newDayLimit}
                    onChange={(e) => setNewDayLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs mt-1 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateKey}
                disabled={isPending || !newKeyName || !newDevName || !newDevEmail}
                className="px-5 py-2 bg-zim-green hover:bg-opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {isPending ? 'Generating...' : 'Generate Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ONE-TIME SECRET DISPLAY */}
      {/* =================================================================== */}
      {oneTimeSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-extrabold text-neutral-900">API Key Created — Copy Now</h3>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <strong>Crucial Security Notice:</strong> This full key will <strong>NEVER</strong> be displayed again. Store it securely in your environment variables.
            </div>

            <div className="relative">
              <textarea
                readOnly
                value={oneTimeSecret}
                rows={3}
                className="w-full px-3 py-2 bg-neutral-900 text-green-400 font-mono text-xs rounded-xl border border-neutral-800 select-all"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleCopySecret}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                {copiedSecret ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copiedSecret ? 'Copied to Clipboard!' : 'Copy Key'}
              </button>

              <button
                type="button"
                onClick={() => setOneTimeSecret(null)}
                className="px-5 py-2 bg-zim-green hover:bg-opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                I have saved this key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: REVOKE KEY CONFIRMATION */}
      {/* =================================================================== */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-extrabold text-red-600">Revoke API Key</h3>
            <p className="text-xs text-neutral-600">
              Are you sure you want to revoke key <strong>&quot;{keyToRevoke.name}&quot;</strong> ({keyToRevoke.key_prefix})?
              All future requests using this key will immediately return HTTP 401.
            </p>

            <div>
              <label className="text-xs font-bold text-neutral-700">Revocation Reason</label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs mt-1"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setKeyToRevoke(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeKey}
                disabled={isPending}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                {isPending ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
