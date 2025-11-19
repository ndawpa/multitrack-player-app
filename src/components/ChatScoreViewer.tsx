import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface ChatScoreViewerProps {
  url: string;
  name: string;
  pages?: string[];
}

const ChatScoreViewer: React.FC<ChatScoreViewerProps> = ({ url, name, pages }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const allPages = pages && pages.length > 0 ? pages : [url];
  const hasMultiplePages = allPages.length > 1;
  const currentPageUrl = allPages[currentPageIndex];

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
      setIsLoading(true);
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < allPages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      setIsLoading(true);
    }
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    Alert.alert(
      'PDF Viewing Error',
      'Unable to load PDF. You can try opening it in your browser.',
      [
        {
          text: 'Open in Browser',
          onPress: () => {
            Linking.openURL(currentPageUrl);
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        {hasMultiplePages && (
          <Text style={styles.pageInfo}>
            Page {currentPageIndex + 1} of {allPages.length}
          </Text>
        )}
      </View>

      {hasError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="document-outline" size={48} color="#666" />
          <Text style={styles.errorText}>Unable to load PDF</Text>
          <TouchableOpacity
            style={styles.openButton}
            onPress={() => Linking.openURL(currentPageUrl)}
          >
            <Text style={styles.openButtonText}>Open in Browser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.webViewContainer}>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#BB86FC" />
              <Text style={styles.loadingText}>Loading PDF...</Text>
            </View>
          )}
          {Platform.OS === 'web' ? (
            <View style={styles.webView}>
              {React.createElement('iframe', {
                src: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(currentPageUrl)}`,
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                },
                onError: handleError,
              })}
            </View>
          ) : (
            <WebView
              source={{
                uri: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(currentPageUrl)}`
              }}
              style={styles.webView}
              onError={handleError}
              onLoadEnd={handleLoadEnd}
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#BB86FC" />
                  <Text style={styles.loadingText}>Loading PDF...</Text>
                </View>
              )}
            />
          )}
        </View>
      )}

      {hasMultiplePages && !hasError && (
        <View style={styles.pageControls}>
          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPageIndex === 0 && styles.pageButtonDisabled
            ]}
            onPress={handlePrevPage}
            disabled={currentPageIndex === 0}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={currentPageIndex === 0 ? "#666" : "#BB86FC"}
            />
            <Text
              style={[
                styles.pageButtonText,
                currentPageIndex === 0 && styles.pageButtonTextDisabled
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPageIndex === allPages.length - 1 && styles.pageButtonDisabled
            ]}
            onPress={handleNextPage}
            disabled={currentPageIndex === allPages.length - 1}
          >
            <Text
              style={[
                styles.pageButtonText,
                currentPageIndex === allPages.length - 1 && styles.pageButtonTextDisabled
              ]}
            >
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={currentPageIndex === allPages.length - 1 ? "#666" : "#BB86FC"}
            />
          </TouchableOpacity>
        </View>
      )}
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
    justifyContent: 'space-between',
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
    marginRight: 8,
  },
  pageInfo: {
    fontSize: 12,
    color: '#BBBBBB',
  },
  webViewContainer: {
    position: 'relative',
    height: 400,
    width: '100%',
  },
  webView: {
    height: 400,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#BBBBBB',
  },
  errorContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#BBBBBB',
    textAlign: 'center',
  },
  openButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#BB86FC',
    borderRadius: 6,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pageControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2C',
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2C2C2C',
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageButtonText: {
    fontSize: 14,
    color: '#BB86FC',
    fontWeight: '600',
    marginHorizontal: 4,
  },
  pageButtonTextDisabled: {
    color: '#666',
  },
});

export default ChatScoreViewer;

