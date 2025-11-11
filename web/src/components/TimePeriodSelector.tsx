export type TimePeriod = 'hours' | 'days' | 'months';

interface TimePeriodSelectorProps {
    selectedPeriod: TimePeriod | null;
    selectedCount: number;
    onPeriodChange: (period: TimePeriod | null) => void;
    onCountChange: (count: number) => void;
}

const MAX_COUNTS = {
    hours: 24,
    days: 30,
    months: 12,
} as const;

export function TimePeriodSelector({
    selectedPeriod,
    selectedCount,
    onPeriodChange,
    onCountChange,
}: TimePeriodSelectorProps) {
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

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">
                Time Period
            </h3>

            {/* Period Selection */}
            <div className="flex flex-wrap gap-2 mb-4">
                {periods.map((period) => (
                    <button
                        key={period.value ?? 'all'}
                        onClick={() => {
                            onPeriodChange(period.value);
                            if (period.value) {
                                // Reset count to 1 when changing period
                                onCountChange(1);
                            }
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedPeriod === period.value
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
                    <label className="text-sm text-gray-600 mb-2 block">
                        Last {selectedPeriod === 'hours' ? 'hours' : selectedPeriod === 'days' ? 'days' : 'months'}:
                    </label>
                    <div className={`flex flex-wrap gap-2 ${maxCount > 12 ? 'max-h-48 overflow-y-auto' : ''}`}>
                        {Array.from({ length: maxCount }, (_, i) => i + 1).map((count) => (
                            <button
                                key={count}
                                onClick={() => onCountChange(count)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedCount === count
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {count}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

