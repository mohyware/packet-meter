import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

type ButtonProps = {
  title: string;
  disabled: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
};

export const Button: React.FC<ButtonProps> = ({
  title,
  icon,
  onPress,
  disabled,
  variant = 'primary',
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[ButtonStyles[variant], disabled && ButtonStyles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      {icon && <View>{icon}</View>}
      <ThemedText
        style={ButtonStyles.primaryText}
        darkColor="#fff"
        lightColor="#fff"
      >
        {title}
      </ThemedText>
    </TouchableOpacity>
  );
};

export const ButtonStyles = StyleSheet.create({
  primary: {
    backgroundColor: '#5355C4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#5355C4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});
