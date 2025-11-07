import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface WatermarkProps {
  text?: string;
  opacity?: number;
  fontSize?: number;
  rotation?: number;
}

const Watermark: React.FC<WatermarkProps> = ({ 
  text = '© Kit de Voz',
  opacity = 0.15,
  fontSize = 24,
  rotation = -45
}) => {
  // Create a repeating pattern of watermarks
  const watermarkText = text;
  
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Center watermark - most visible but not too intrusive */}
      <View style={styles.centerWatermark}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity,
              fontSize,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      {/* Corner watermarks - harder to crop out */}
      <View style={styles.topLeft}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.7,
              fontSize: fontSize * 0.6,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.topRight}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.7,
              fontSize: fontSize * 0.6,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.bottomLeft}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.7,
              fontSize: fontSize * 0.6,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.bottomRight}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.7,
              fontSize: fontSize * 0.6,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      {/* Additional subtle watermarks in middle edges */}
      <View style={styles.middleLeft}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.5,
              fontSize: fontSize * 0.5,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.middleRight}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.1,
              fontSize: fontSize * 0.5,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  watermarkText: {
    color: '#000000',
    fontWeight: '300',
    textAlign: 'center',
  },
  centerWatermark: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    marginLeft: -150,
    marginTop: -20,
    width: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLeft: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRight: {
    position: 'absolute',
    top: '10%',
    right: '10%',
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomLeft: {
    position: 'absolute',
    bottom: '10%',
    left: '10%',
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRight: {
    position: 'absolute',
    bottom: '10%',
    right: '10%',
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleLeft: {
    position: 'absolute',
    top: '45%',
    left: '5%',
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRight: {
    position: 'absolute',
    top: '45%',
    right: '5%',
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Watermark;

