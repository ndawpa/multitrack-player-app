import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface WatermarkProps {
  text?: string;
  opacity?: number;
  fontSize?: number;
  rotation?: number;
}

const Watermark: React.FC<WatermarkProps> = ({ 
  text = '© Ministério de Louvor',
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
              opacity: opacity * 0.5,
              fontSize: fontSize * 0.5,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      {/* Top middle watermark */}
      <View style={styles.topMiddle}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.6,
              fontSize: fontSize * 0.55,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      {/* Bottom middle watermark */}
      <View style={styles.bottomMiddle}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.6,
              fontSize: fontSize * 0.55,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      {/* Additional diagonal watermarks */}
      <View style={styles.topCenterLeft}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.4,
              fontSize: fontSize * 0.45,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.topCenterRight}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.4,
              fontSize: fontSize * 0.45,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.bottomCenterLeft}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.4,
              fontSize: fontSize * 0.45,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.bottomCenterRight}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.4,
              fontSize: fontSize * 0.45,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      {/* Additional edge watermarks */}
      <View style={styles.leftTop}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.35,
              fontSize: fontSize * 0.4,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.rightTop}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.35,
              fontSize: fontSize * 0.4,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.leftBottom}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.35,
              fontSize: fontSize * 0.4,
              transform: [{ rotate: `${rotation}deg` }]
            }
          ]}
        >
          {watermarkText}
        </Text>
      </View>
      
      <View style={styles.rightBottom}>
        <Text 
          style={[
            styles.watermarkText,
            {
              opacity: opacity * 0.35,
              fontSize: fontSize * 0.4,
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
  topMiddle: {
    position: 'absolute',
    top: '5%',
    left: '50%',
    marginLeft: -120,
    width: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomMiddle: {
    position: 'absolute',
    bottom: '5%',
    left: '50%',
    marginLeft: -120,
    width: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCenterLeft: {
    position: 'absolute',
    top: '25%',
    left: '25%',
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCenterRight: {
    position: 'absolute',
    top: '25%',
    right: '25%',
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCenterLeft: {
    position: 'absolute',
    bottom: '25%',
    left: '25%',
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCenterRight: {
    position: 'absolute',
    bottom: '25%',
    right: '25%',
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftTop: {
    position: 'absolute',
    top: '20%',
    left: '2%',
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightTop: {
    position: 'absolute',
    top: '20%',
    right: '2%',
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftBottom: {
    position: 'absolute',
    bottom: '20%',
    left: '2%',
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightBottom: {
    position: 'absolute',
    bottom: '20%',
    right: '2%',
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Watermark;

