import { ReactNode, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDevices } from '../hooks/useDevices';
import { sendTestEmail } from '../api/email';
import { useSettings } from '../hooks/useSettings';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, features } = useAuth();
  const { devices } = useDevices();
  const {
    settings,
    isLoading: isSettingsLoading,
    isUpdating: isSavingSettings,
    updateSettingsAsync,
  } = useSettings();
  const [earlyAccessEmail, setEarlyAccessEmail] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [clearIntervalDays, setClearIntervalDays] = useState(1);
  const [emailIntervalDays, setEmailIntervalDays] = useState(1);
  const [emailReportsEnabled, setEmailReportsEnabled] = useState(false);

  useEffect(() => {
    if (settings) {
      setClearIntervalDays(settings.clearReportsInterval);
      setEmailIntervalDays(settings.emailInterval);
      setEmailReportsEnabled(settings.emailReportsEnabled);
    }
  }, [settings]);

  const profile = user?.user;
  const planLabel =
    features.planName.charAt(0).toUpperCase() + features.planName.slice(1);
  const deviceLimitText =
    features.maxDevices < 0
      ? 'Unlimited devices'
      : `${features.maxDevices} devices`;

  const planAllowsEmailReports = useMemo(
    () => features.emailReportsEnabled,
    [features.emailReportsEnabled]
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const planClearLimit =
    typeof features.maxClearReportsInterval === 'number'
      ? features.maxClearReportsInterval
      : features.clearReportsInterval;
  const isFreePlan = features.planName === 'free';

  async function handleSettingsSubmit() {
    if (!settings) return;

    try {
      await updateSettingsAsync({
        clearReportsInterval: clearIntervalDays,
        emailReportsEnabled: planAllowsEmailReports
          ? emailReportsEnabled
          : false,
        emailInterval: emailIntervalDays,
      });
    } catch (error: unknown) {
      console.error(error);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Account & Plan</h1>
        <p className="text-gray-600 mt-2">
          Review your PacketPilot account details and included features.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Account</h2>
          <div className="space-y-1 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex-shrink-0 min-w-[100px]">
                <span className="text-sm font-medium text-gray-700">Name</span>
              </div>
              <div className="flex-1 flex items-center justify-end">
                <span className="font-medium text-gray-900">
                  {profile?.username ?? 'Unknown user'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex-shrink-0 min-w-[100px]">
                <span className="text-sm font-medium text-gray-700">Email</span>
              </div>
              <div className="flex-1 flex items-center justify-end">
                <span className="font-medium text-gray-900">
                  {profile?.email ?? '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex-shrink-0 min-w-[100px]">
                <span className="text-sm font-medium text-gray-700">
                  Timezone
                </span>
              </div>
              <div className="flex-1 flex items-center justify-end">
                <span className="font-medium text-gray-900">
                  {profile?.timezone ?? 'UTC'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Plan</h2>
            <p className="text-2xl font-bold text-indigo-900">{planLabel}</p>
            <p className="text-sm text-gray-600 mb-4">{deviceLimitText}</p>
            <div className="space-y-0 text-sm text-gray-700">
              <SettingRow label="Devices connected">
                <span className="font-medium text-gray-900">
                  {devices.length}
                </span>
              </SettingRow>

              <SettingRow label="Report detail">
                <span className="font-medium text-gray-900">
                  {features.reportType === 'per_process'
                    ? 'Per process'
                    : 'Total only'}
                </span>
              </SettingRow>

              <SettingRow
                label="Clear interval (days)"
                helper={
                  <span className="text-xs text-gray-500">
                    Plan limit:{' '}
                    {planClearLimit <= 0
                      ? 'Never automatically cleared'
                      : `Up to ${planClearLimit} day${planClearLimit === 1 ? '' : 's'}`}
                  </span>
                }
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={-1}
                    max={365}
                    value={clearIntervalDays}
                    onChange={(event) =>
                      setClearIntervalDays(Number(event.target.value) || 0)
                    }
                    disabled={
                      isSettingsLoading || isSavingSettings || isFreePlan
                    }
                    className="w-12 rounded-md border border-gray-300 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 text-right"
                  />
                </div>
              </SettingRow>

              <SettingRow
                label="Email reports"
                helper={
                  !planAllowsEmailReports || isFreePlan ? (
                    <span className="text-xs text-amber-600">
                      Not available on your plan
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">
                      Plan:{' '}
                      {features.emailReportsEnabled
                        ? 'Included'
                        : 'Not included'}
                    </span>
                  )
                }
              >
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    checked={emailReportsEnabled && planAllowsEmailReports}
                    disabled={
                      !planAllowsEmailReports ||
                      isSettingsLoading ||
                      isSavingSettings ||
                      isFreePlan
                    }
                    onChange={(event) =>
                      setEmailReportsEnabled(event.target.checked)
                    }
                  />
                </label>
              </SettingRow>

              {/* TODO: Add email interval setting */}
              {/* <SettingRow label="Email interval">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={emailIntervalDays}
                    onChange={(event) =>
                      setEmailIntervalDays(
                        Math.max(1, Number(event.target.value) || 1)
                      )
                    }
                    disabled={
                      isSettingsLoading ||
                      isSavingSettings ||
                      !planAllowsEmailReports ||
                      !emailReportsEnabled ||
                      isFreePlan
                    }
                    className="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 text-right"
                  />
                </div>
              </SettingRow> */}
            </div>
          </div>

          <button
            onClick={handleSettingsSubmit}
            disabled={isSettingsLoading || isSavingSettings || isFreePlan}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {isSavingSettings ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 mb-8">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-indigo-900 mb-2">
              Want deeper insights?
            </h2>
            <p className="text-sm text-indigo-800">
              You can enjoy all these features on the cloud once our
              subscription tier launches:
            </p>
          </div>
          <ul className="text-sm text-indigo-900 list-disc list-inside space-y-1">
            <li>Detailed per-process usage reports, not just total usage</li>
            <li>Support for adding more devices</li>
            <li>Extended clear intervals for more historical insights</li>
            <li>Email reports with traffic usage summary</li>
          </ul>
          <p className="text-sm text-indigo-800">
            Enter your email below and we’ll notify you as soon as subscriptions
            are live.
          </p>
          <form
            className="flex flex-col sm:flex-row gap-3"
            onSubmit={(event) => {
              // TODO: create endpoint to add user to early access list
              event.preventDefault();
              const email = earlyAccessEmail.trim();
              if (!email) {
                toast.error('Please enter an email address.');
                return;
              }
              const mailto = new URL(`mailto:hello@packetpilot.app`);
              mailto.searchParams.set('subject', 'PacketPilot Early Access');
              mailto.searchParams.set(
                'body',
                `Hi PacketPilot team,%0D%0A%0D%0AI'd like early access.%0D%0AEmail: ${encodeURIComponent(email)}`
              );
              window.open(mailto.toString(), '_blank');
              toast.success('Thanks! We’ll be in touch soon.');
              setEarlyAccessEmail('');
            }}
          >
            <input
              type="email"
              value={earlyAccessEmail}
              onChange={(e) => setEarlyAccessEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 px-4 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              required
            />
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Join early access
            </button>
          </form>
        </div>
      </div>

      {/* TODO: remove this */}
      <div>
        <button
          onClick={async () => {
            setIsSendingTestEmail(true);
            try {
              await sendTestEmail();
              toast.success('Test email queued successfully.');
            } catch (error: unknown) {
              console.error(error);
              toast.error('Failed to send test email.');
            } finally {
              setIsSendingTestEmail(false);
            }
          }}
          disabled={isSendingTestEmail}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSendingTestEmail ? 'Sending...' : 'Send Test Email'}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Sends a sample device stats email to your account address.
        </p>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  children,
  helper,
}: {
  label: string;
  children: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-shrink-0 min-w-[140px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-gray-700 leading-6">
              {label}
            </span>
            {helper && <div className="mt-0 text-xs">{helper}</div>}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-end min-h-[24px]">
          {children}
        </div>
      </div>
    </div>
  );
}
