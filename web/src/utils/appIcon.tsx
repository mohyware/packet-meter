import { useMemo } from 'react';

/**
 * Generates a consistent color from a string hash
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  const saturation = 60 + (hash % 20); // 60-80% saturation
  const lightness = 45 + (hash % 15); // 45-60% lightness for good contrast

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Extracts initials from an app identifier or display name
 */
function getInitials(identifier: string, displayName?: string | null): string {
  const name = displayName ?? identifier;

  // Try to extract meaningful initials
  // If it's a package/bundle identifier (e.g., com.example.app)
  if (name.includes('.')) {
    const parts = name.split('.').filter((p) => p.length > 0);
    // Take last meaningful part
    const lastPart = parts[parts.length - 1];
    if (lastPart.length >= 2) {
      return lastPart.substring(0, 2).toUpperCase();
    }
    // Fallback: take first letter of each part
    return parts
      .slice(-2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  }

  // For regular names, take first two characters
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
}

interface AppIconProps {
  identifier: string;
  displayName?: string | null;
  iconHash?: string | null;
  size?: number;
  className?: string;
}

/**
 * Component that renders an app icon based on a hashed identifier
 */
export function AppIcon({
  identifier,
  displayName,
  iconHash,
  size = 30,
  className = '',
}: AppIconProps) {
  const { color, initials, iconDataUri } = useMemo(() => {
    const bgColor = stringToColor(identifier);
    const text = getInitials(identifier, displayName);
    let dataUri: string | null = null;

    if (iconHash && iconHash.trim() !== '') {
      // Check if it's already a data URI
      if (iconHash.startsWith('data:')) {
        dataUri = iconHash;
      } else {
        try {
          dataUri = `data:image/png;base64,${iconHash}`;
        } catch {
          dataUri = null;
        }
      }
    }

    return { color: bgColor, initials: text, iconDataUri: dataUri };
  }, [identifier, displayName, iconHash]);

  // If we have icon data, try to render it
  if (iconDataUri) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg flex-shrink-0 overflow-hidden ${className}`}
        style={{
          width: size,
          height: size,
        }}
        title={displayName ?? identifier}
      >
        <img
          src={iconDataUri}
          alt={displayName ?? identifier}
          className="w-full h-full object-contain"
          onError={(e) => {
            // If image fails to load, hide it and show fallback
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.style.backgroundColor = color;
              parent.style.fontSize = `${size * 0.4}px`;
              parent.style.color = 'white';
              parent.style.fontWeight = '600';
              parent.textContent = initials;
            }
          }}
        />
      </div>
    );
  }

  // Fallback to colored initials
  return (
    <div
      className={`flex items-center justify-center rounded-lg font-semibold text-white flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
      }}
      title={displayName ?? identifier}
    >
      {initials}
    </div>
  );
}

/**
 * Hook to get app icon data without rendering
 */
export function useAppIcon(identifier: string, displayName?: string | null) {
  return useMemo(() => {
    const color = stringToColor(identifier);
    const initials = getInitials(identifier, displayName);
    return { color, initials };
  }, [identifier, displayName]);
}
