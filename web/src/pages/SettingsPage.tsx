import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDevices } from '../hooks/useDevices';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, features } = useAuth();
  const { devices } = useDevices();
  const [earlyAccessEmail, setEarlyAccessEmail] = useState('');

  const profile = user?.user;
  const planLabel =
    features.planName.charAt(0).toUpperCase() + features.planName.slice(1);
  const deviceLimitText =
    features.maxDevices < 0
      ? 'Unlimited devices'
      : `${features.maxDevices} devices`;

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
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <p className="text-xs uppercase text-gray-500">Name</p>
              <p className="font-medium">
                {profile?.username ?? 'Unknown user'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Email</p>
              <p className="font-medium">{profile?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Timezone</p>
              <p className="font-medium">{profile?.timezone ?? 'UTC'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Plan</h2>
          <p className="text-2xl font-bold text-indigo-900">{planLabel}</p>
          <p className="text-sm text-gray-600 mb-4">{deviceLimitText}</p>
          <div className="space-y-3 text-sm text-gray-700">
            <FeatureRow label="Devices connected" value={`${devices.length}`} />
            <FeatureRow
              label="Email reports"
              value={features.emailReportsEnabled ? 'Enabled' : 'Disabled'}
            />
            <FeatureRow
              label="Report detail"
              value={
                features.reportType === 'per_process'
                  ? 'Per process'
                  : 'Total only'
              }
            />
            <FeatureRow
              label="Clear interval"
              value={
                features.clearReportsInterval <= 0
                  ? 'Never automatically cleared'
                  : `Every ${features.clearReportsInterval} day${features.clearReportsInterval === 1 ? '' : 's'}`
              }
            />
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-indigo-900 mb-2">
            Want deeper insights?
          </h2>
          <p className="text-sm text-indigo-800">
            You can enjoy all these features on the cloud once our subscription
            tier launches:
          </p>
        </div>
        <ul className="text-sm text-indigo-900 list-disc list-inside space-y-1">
          <li>Detailed per-process usage reports, not just total usage</li>
          <li>Support for adding more devices</li>
          <li>Extended Clear intervals for more historical insights</li>
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
  );
}

function FeatureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
