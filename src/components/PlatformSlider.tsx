import React, { useEffect, useRef } from 'react';
import { Platform, View, ViewStyle } from 'react-native';
import Slider from '@react-native-community/slider';

interface PlatformSliderProps {
  style?: ViewStyle;
  minimumValue: number;
  maximumValue: number;
  value: number;
  onValueChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  disabled?: boolean;
}

const PlatformSlider: React.FC<PlatformSliderProps> = ({
  style,
  minimumValue,
  maximumValue,
  value,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
  minimumTrackTintColor = '#BB86FC',
  maximumTrackTintColor = '#2C2C2C',
  disabled,
}) => {
  const sliderIdRef = useRef(`slider-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Inject CSS for web slider styling
      const styleId = 'platform-slider-styles';
      if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
          input[type="range"].platform-slider {
            width: 100%;
            height: 40px;
            -webkit-appearance: none;
            appearance: none;
            background: transparent;
            cursor: pointer;
          }
          input[type="range"].platform-slider:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }
          input[type="range"].platform-slider::-webkit-slider-track {
            background: ${maximumTrackTintColor};
            height: 4px;
            border-radius: 2px;
          }
          input[type="range"].platform-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            background: ${minimumTrackTintColor};
            height: 20px;
            width: 20px;
            border-radius: 50%;
            cursor: pointer;
            margin-top: -8px;
          }
          input[type="range"].platform-slider:disabled::-webkit-slider-thumb {
            cursor: not-allowed;
          }
          input[type="range"].platform-slider::-moz-range-track {
            background: ${maximumTrackTintColor};
            height: 4px;
            border-radius: 2px;
          }
          input[type="range"].platform-slider::-moz-range-thumb {
            background: ${minimumTrackTintColor};
            height: 20px;
            width: 20px;
            border-radius: 50%;
            cursor: pointer;
            border: none;
          }
          input[type="range"].platform-slider:disabled::-moz-range-thumb {
            cursor: not-allowed;
          }
          input[type="range"].platform-slider::-moz-range-progress {
            background: ${minimumTrackTintColor};
            height: 4px;
            border-radius: 2px;
          }
        `;
        document.head.appendChild(styleElement);
      }
    }
  }, [minimumTrackTintColor, maximumTrackTintColor]);

  if (Platform.OS === 'web') {
    // Use native HTML range input for web (React 19 compatible)
    return (
      <View style={style}>
        {React.createElement('input', {
          type: 'range',
          min: minimumValue,
          max: maximumValue,
          step: '0.01',
          value: value,
          onMouseDown: onSlidingStart,
          onTouchStart: onSlidingStart,
          onChange: (e: any) => {
            const newValue = parseFloat(e.target.value);
            onValueChange(newValue);
          },
          onMouseUp: onSlidingComplete ? (e: any) => onSlidingComplete(parseFloat(e.target.value)) : undefined,
          onTouchEnd: onSlidingComplete ? (e: any) => {
            const target = e.target as HTMLInputElement;
            onSlidingComplete(parseFloat(target.value));
          } : undefined,
          disabled: disabled,
          className: 'platform-slider',
          id: sliderIdRef.current,
        })}
      </View>
    );
  }

  // Use React Native slider for native platforms
  return (
    <Slider
      style={style}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      value={value}
      onValueChange={onValueChange}
      onSlidingStart={onSlidingStart}
      onSlidingComplete={onSlidingComplete}
      minimumTrackTintColor={minimumTrackTintColor}
      maximumTrackTintColor={maximumTrackTintColor}
      disabled={disabled}
    />
  );
};

export default PlatformSlider;

