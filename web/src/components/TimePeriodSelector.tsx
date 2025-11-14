import { useState, useRef, useEffect } from 'react';
import { useTimePeriodStore, TimePeriod } from '../stores/timePeriodStore';

const MAX_COUNTS = {
  hours: 24,
  days: 30,
  months: 12,
} as const;

export type { TimePeriod };

const getDisplayText = (
  preset: string,
  period: TimePeriod | null,
  count: number
): string => {
  if (preset === '5hours') return 'Last 5h';
  if (preset === '24hours') return 'Last 24h';
  if (preset === '7days') return 'Last 7d';
  if (preset === '30days') return 'Last 30d';
  if (preset === 'custom' && period && count) {
    const periodLabel =
      period === 'hours' ? 'h' : period === 'days' ? 'd' : 'mo';
    return `Last ${count}${periodLabel}`;
  }
  return 'Time Period';
};

export function TimePeriodSelector() {
  const {
    selectedPeriod,
    selectedCount,
    currentPreset,
    showCustom,
    setPreset,
    setPeriod,
    setCount,
  } = useTimePeriodStore();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const periods: { value: TimePeriod | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
    { value: 'months', label: 'Months' },
  ];

  const getMaxCount = (period: TimePeriod | null): number => {
    if (!period) return 0;
    return MAX_COUNTS[period];
  };

  const maxCount = getMaxCount(selectedPeriod);
  const displayText = getDisplayText(
    currentPreset,
    selectedPeriod,
    selectedCount
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Compact Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{displayText}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2">
          {/* Preset Options */}
          <div className="px-3 py-2 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Quick Select
            </label>
            <div className="space-y-1">
              {(
                ['5hours', '24hours', '7days', '30days', 'custom'] as const
              ).map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setPreset(preset);
                    if (preset !== 'custom') {
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    currentPreset === preset
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {preset === '5hours' && 'Last 5 hours'}
                  {preset === '24hours' && 'Last 24 hours'}
                  {preset === '7days' && 'Last 7 days'}
                  {preset === '30days' && 'Last 30 days'}
                  {preset === 'custom' && 'Custom (Beta)'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Selection */}
          {showCustom && (
            <div className="px-3 py-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                Period
              </label>
              <div className="flex flex-wrap gap-1 mb-3">
                {periods.map((period) => (
                  <button
                    key={period.value ?? 'all'}
                    onClick={() => setPeriod(period.value)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      selectedPeriod === period.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>

              {/* Count Selection */}
              {selectedPeriod && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                    Last{' '}
                    {selectedPeriod === 'hours'
                      ? 'hours'
                      : selectedPeriod === 'days'
                        ? 'days'
                        : 'months'}
                  </label>
                  <div
                    className={`flex flex-wrap gap-1 ${maxCount > 12 ? 'max-h-32 overflow-y-auto' : ''}`}
                  >
                    {Array.from({ length: maxCount }, (_, i) => i + 1).map(
                      (count) => (
                        <button
                          key={count}
                          onClick={() => {
                            setCount(count);
                            setIsOpen(false);
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            selectedCount === count
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {count}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
