import { create } from 'zustand';

export type TimePeriod = 'hours' | 'days' | 'months';

type PresetOption = '5hours' | '24hours' | '7days' | '30days' | 'custom';

interface TimePeriodState {
    selectedPeriod: TimePeriod | null;
    selectedCount: number;
    currentPreset: PresetOption;
    showCustom: boolean;
    setPreset: (preset: PresetOption) => void;
    setPeriod: (period: TimePeriod | null) => void;
    setCount: (count: number) => void;
    getPreset: () => PresetOption;
}

const getPresetFromValues = (
    period: TimePeriod | null,
    count: number
): PresetOption => {
    if (period === 'hours' && count === 5) return '5hours';
    if (period === 'hours' && count === 24) return '24hours';
    if (period === 'days' && count === 7) return '7days';
    if (period === 'days' && count === 30) return '30days';
    return 'custom';
};

export const useTimePeriodStore = create<TimePeriodState>((set, get) => ({
    selectedPeriod: 'hours',
    selectedCount: 5,
    currentPreset: '5hours',
    showCustom: false,

    setPreset: (preset: PresetOption) => {
        switch (preset) {
            case '5hours':
                set({
                    selectedPeriod: 'hours',
                    selectedCount: 5,
                    currentPreset: '5hours',
                    showCustom: false,
                });
                break;
            case '24hours':
                set({
                    selectedPeriod: 'hours',
                    selectedCount: 24,
                    currentPreset: '24hours',
                    showCustom: false,
                });
                break;
            case '7days':
                set({
                    selectedPeriod: 'days',
                    selectedCount: 7,
                    currentPreset: '7days',
                    showCustom: false,
                });
                break;
            case '30days':
                set({
                    selectedPeriod: 'days',
                    selectedCount: 30,
                    currentPreset: '30days',
                    showCustom: false,
                });
                break;
            case 'custom':
                set({
                    currentPreset: 'custom',
                    showCustom: true,
                });
                break;
        }
    },

    setPeriod: (period: TimePeriod | null) => {
        const state = get();
        const newCount = period ? 1 : state.selectedCount;
        const newPreset = getPresetFromValues(period, newCount);

        set({
            selectedPeriod: period,
            selectedCount: newCount,
            currentPreset: newPreset,
            showCustom: newPreset === 'custom',
        });
    },

    setCount: (count: number) => {
        const state = get();
        const newPreset = getPresetFromValues(state.selectedPeriod, count);

        set({
            selectedCount: count,
            currentPreset: newPreset,
            showCustom: newPreset === 'custom',
        });
    },

    getPreset: () => {
        const state = get();
        return getPresetFromValues(state.selectedPeriod, state.selectedCount);
    },
}));

