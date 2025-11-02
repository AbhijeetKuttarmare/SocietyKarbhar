import { useEffect, useState } from 'react';
import { Dimensions, PixelRatio } from 'react-native';

// Utility: percentage of screen width
export function wp(percent: number) {
  const { width } = Dimensions.get('window');
  return Math.round((width * percent) / 100);
}

// Utility: percentage of screen height
export function hp(percent: number) {
  const { height } = Dimensions.get('window');
  return Math.round((height * percent) / 100);
}

// Scale font based on device width (base width 375)
export function scaleFont(size: number) {
  const { width } = Dimensions.get('window');
  const scale = width / 375;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export function isTablet() {
  const { width, height } = Dimensions.get('window');
  const smallest = Math.min(width, height);
  return smallest >= 600;
}

// Hook to subscribe to window size changes
export function useWindowSize() {
  const [size, setSize] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    function onChange({ window }: { window: { width: number; height: number } }) {
      setSize({ width: window.width, height: window.height });
    }
    const sub = Dimensions.addEventListener ? Dimensions.addEventListener('change', onChange) : (Dimensions as any).addEventListener('change', onChange);
    return () => {
      try {
        if (sub && sub.remove) sub.remove();
        else if (Dimensions && (Dimensions as any).removeEventListener)
          (Dimensions as any).removeEventListener('change', onChange);
      } catch (e) {}
    };
  }, []);

  return size;
}
