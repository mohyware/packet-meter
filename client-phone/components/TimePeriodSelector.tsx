import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Time Period</Text>

            {/* Period Selection */}
            <View style={styles.periodContainer}>
                {periods.map((period) => (
                    <TouchableOpacity
                        key={period}
                        style={[
                            styles.periodButton,
                            selectedPeriod === period && styles.selectedButton
                        ]}
                        onPress={() => onPeriodChange(period)}
                    >
                        <Text style={[
                            styles.periodText,
                            selectedPeriod === period && styles.selectedText
                        ]}>
                            {period.charAt(0).toUpperCase() + period.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Count Selection */}
            {selectedPeriod !== 'month' && (
                <View style={styles.countContainer}>
                    <Text style={styles.countTitle}>Last {selectedPeriod === 'day' ? 'days' : 'weeks'}:</Text>
                    <View style={styles.countButtons}>
                        {Array.from({ length: maxCounts[selectedPeriod as keyof typeof maxCounts] }, (_, i) => i + 1).map((count) => (
                            <TouchableOpacity
                                key={count}
                                style={[
                                    styles.countButton,
                                    selectedCount === count && styles.selectedCountButton
                                ]}
                                onPress={() => onCountChange(count)}
                            >
                                <Text style={[
                                    styles.countText,
                                    selectedCount === count && styles.selectedCountText
                                ]}>
                                    {count}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
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
        color: '#333',
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
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
    },
    selectedButton: {
        backgroundColor: '#f4511e',
    },
    periodText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
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
        color: '#666',
        marginBottom: 8,
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
        backgroundColor: '#f0f0f0',
        minWidth: 40,
        alignItems: 'center',
    },
    selectedCountButton: {
        backgroundColor: '#f4511e',
    },
    countText: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    selectedCountText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
