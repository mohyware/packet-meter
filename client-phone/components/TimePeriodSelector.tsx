import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

interface TimePeriodSelectorProps {
    selectedPeriod: string;
    selectedCount: number;
    onPeriodChange: (period: string) => void;
    onCountChange: (count: number) => void;
}

export function TimePeriodSelector({
    selectedPeriod,
    selectedCount,
    onPeriodChange,
    onCountChange
}: TimePeriodSelectorProps) {
    const periods = ['day', 'week', 'month'];
    const maxCounts = {
        day: 7,
        week: 4,
        month: 12
    } as const;

    const chipBg = useThemeColor({ light: '#f0f0f0', dark: '#2a2d2e' }, 'icon');
    const selectedBg = '#5355C4';

    return (
        <ThemedView style={styles.container}>
            <ThemedText style={styles.title}>Time Period</ThemedText>

            {/* Period Selection */}
            <View style={styles.periodContainer}>
                {periods.map((period) => (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        key={period}
                        style={[
                            styles.periodButton,
                            { backgroundColor: selectedPeriod === period ? selectedBg : chipBg }
                        ]}
                        onPress={() => onPeriodChange(period)}
                    >
                        <ThemedText style={[
                            styles.periodText,
                            selectedPeriod === period && styles.selectedText
                        ]}>
                            {period.charAt(0).toUpperCase() + period.slice(1)}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Count Selection */}
            {selectedPeriod !== 'month' && (
                <View style={styles.countContainer}>
                    <ThemedText style={styles.countTitle}>Last {selectedPeriod === 'day' ? 'days' : 'weeks'}:</ThemedText>
                    <View style={styles.countButtons}>
                        {Array.from({ length: maxCounts[selectedPeriod as keyof typeof maxCounts] }, (_, i) => i + 1).map((count) => (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                key={count}
                                style={[
                                    styles.countButton,
                                    { backgroundColor: selectedCount === count ? selectedBg : chipBg }
                                ]}
                                onPress={() => onCountChange(count)}
                            >
                                <ThemedText style={selectedCount === count ? styles.selectedCountText : undefined}>
                                    {count}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 10,
        padding: 15,
        marginHorizontal: 10,
        marginVertical: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
        elevation: 3,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    periodContainer: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    periodButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginHorizontal: 2,
        borderRadius: 6,
        alignItems: 'center',
    },
    periodText: {
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.9,
    },
    selectedText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    countContainer: {
        marginTop: 10,
    },
    countTitle: {
        fontSize: 14,
        marginBottom: 8,
        opacity: 0.9,
    },
    countButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    countButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginRight: 8,
        marginBottom: 8,
        borderRadius: 6,
        minWidth: 40,
        alignItems: 'center',
    },
    selectedCountText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
