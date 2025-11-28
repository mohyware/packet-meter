import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';

type ButtonProps = {
    title: string;
    disabled: boolean;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
};

export const Button: React.FC<ButtonProps> = ({ title, onPress, disabled, variant = 'primary' }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.9}
            style={[ButtonStyles.primaryButton, disabled && ButtonStyles.buttonDisabled]}
            disabled={disabled}
            onPress={onPress}
        >
            <ThemedText style={ButtonStyles.primaryButtonText} darkColor="#fff" lightColor="#fff">
                {title}
            </ThemedText>
        </TouchableOpacity>
    );
};

export const ButtonStyles = StyleSheet.create({

    primaryButton: {
        backgroundColor: '#5355C4',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});
