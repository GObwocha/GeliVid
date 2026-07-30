import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import UploadScreen from './app/screens/UploadScreen';
import ReviewScreen from './app/screens/ReviewScreen';
import { colors } from './app/theme';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('upload');
  const [processedVideo, setProcessedVideo] = useState(null);

  const handleUploadSuccess = (videoData) => {
    setProcessedVideo(videoData);
    setCurrentScreen('review');
  };

  const handleReset = () => {
    setProcessedVideo(null);
    setCurrentScreen('upload');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {currentScreen === 'upload' ? (
        <UploadScreen onUploadSuccess={handleUploadSuccess} />
      ) : (
        <ReviewScreen videoData={processedVideo} onReset={handleReset} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
