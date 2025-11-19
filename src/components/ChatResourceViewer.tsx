import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface ChatResourceViewerProps {
  url: string;
  name: string;
  type: 'youtube' | 'audio' | 'download' | 'link' | 'pdf';
  description?: string;
}

const ChatResourceViewer: React.FC<ChatResourceViewerProps> = ({ url, name, type, description }) => {
  // Helper function to convert YouTube URL to embed format
  const getYouTubeEmbedUrl = (url: string): string => {
    if (!url) return '';
    
    // If already an embed URL, return as is
    if (url.includes('/embed/')) return url;
    
    // Extract video ID from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    
    // If no pattern matches, return original URL
    return url;
  };

  const handleOpenLink = () => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  const getIcon = () => {
    switch (type) {
      case 'youtube':
        return 'logo-youtube';
      case 'audio':
        return 'musical-notes';
      case 'pdf':
        return 'document';
      case 'download':
        return 'download';
      default:
        return 'link';
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'youtube':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'pdf':
        return 'PDF';
      case 'download':
        return 'Download';
      default:
        return 'Link';
    }
  };

  if (type === 'youtube') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="logo-youtube" size={20} color="#FF0000" />
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
        <View style={styles.videoContainer}>
          {Platform.OS === 'web' ? (
            <View style={styles.videoWrapper}>
              {React.createElement('iframe', {
                src: getYouTubeEmbedUrl(url),
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                },
                allowFullScreen: true,
                allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
              })}
            </View>
          ) : (
            <WebView
              source={{ uri: getYouTubeEmbedUrl(url) }}
              style={styles.videoWrapper}
              allowsFullscreenVideo={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          )}
        </View>
      </View>
    );
  }

  if (type === 'audio') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="musical-notes" size={20} color="#BB86FC" />
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
        <View style={styles.audioContainer}>
          {Platform.OS === 'web' ? (
            <View style={styles.audioWrapper}>
              {React.createElement('audio', {
                src: url,
                controls: true,
                style: {
                  width: '100%',
                },
              })}
            </View>
          ) : (
            <WebView
              source={{ uri: url }}
              style={styles.audioWrapper}
              javaScriptEnabled={true}
            />
          )}
        </View>
      </View>
    );
  }

  if (type === 'pdf') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="document" size={20} color="#BB86FC" />
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
        <View style={styles.pdfContainer}>
          {Platform.OS === 'web' ? (
            <View style={styles.pdfWrapper}>
              {React.createElement('iframe', {
                src: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`,
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                },
              })}
            </View>
          ) : (
            <WebView
              source={{
                uri: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`
              }}
              style={styles.pdfWrapper}
            />
          )}
        </View>
      </View>
    );
  }

  // For 'download' and 'link' types, show a clickable link
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name={getIcon()} size={20} color="#BB86FC" />
        <View style={styles.linkContent}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          {description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.linkButton}
        onPress={handleOpenLink}
      >
        <Text style={styles.linkButtonText}>
          {type === 'download' ? 'Download' : 'Open Link'}
        </Text>
        <Ionicons name="open-outline" size={16} color="#BB86FC" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  description: {
    fontSize: 12,
    color: '#BBBBBB',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  videoContainer: {
    height: 250,
    width: '100%',
    backgroundColor: '#000000',
  },
  videoWrapper: {
    height: 250,
    width: '100%',
  },
  audioContainer: {
    height: 80,
    width: '100%',
    backgroundColor: '#1E1E1E',
    padding: 12,
  },
  audioWrapper: {
    height: 80,
    width: '100%',
  },
  pdfContainer: {
    height: 400,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  pdfWrapper: {
    height: 400,
    width: '100%',
  },
  linkContent: {
    flex: 1,
    marginLeft: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#2C2C2C',
    margin: 12,
    borderRadius: 6,
  },
  linkButtonText: {
    fontSize: 14,
    color: '#BB86FC',
    fontWeight: '600',
    marginRight: 4,
  },
});

export default ChatResourceViewer;

