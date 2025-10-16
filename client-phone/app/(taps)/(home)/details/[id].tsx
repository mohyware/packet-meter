import { ThemedText } from '@/components/themed-text';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet } from 'react-native';

export default function DetailsScreen() {
    const { id } = useLocalSearchParams();

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: `${id}`,
                }}
            />
            <ThemedText type="title">Details of user {id} </ThemedText>
            <ThemedText
                onPress={() => {
                    router.setParams({ id: 'Updated' });
                }}>
                Update the title
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
