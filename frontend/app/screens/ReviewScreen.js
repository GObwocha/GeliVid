import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';
import { colors } from '../theme';

const BACKEND_URL = 'http://localhost:8081';

export default function ReviewScreen({ videoData, onReset }) {
  const [caption, setCaption] = useState('Check out this automated reel! 🚀');
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      const response = await axios.post(`${BACKEND_URL}/api/instagram/publish`, {
        videoPath: videoData.path,
        caption: caption
      });

      if (response.data) {
        Alert.alert('Success', 'Video published to Instagram!');
        onReset();
      }
    } catch (error) {
      Alert.alert('Error', `Failed to publish: ${error.response?.data?.error || error.message}`);
      setIsPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review & Publish</Text>

      <View style={styles.videoContainer}>
        <Video
          source={{ uri: videoData.url }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay
        />
      </View>

      <TextInput
        style={styles.captionInput}
        placeholder="Write an Instagram caption..."
        placeholderTextColor={colors.textSecondary}
        value={caption}
        onChangeText={setCaption}
        multiline
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.resetButton} onPress={onReset} disabled={isPublishing}>
          <Text style={styles.resetButtonText}>Start Over</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.publishButton, isPublishing && styles.publishButtonDisabled]} 
          onPress={handlePublish}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.publishButtonText}>Publish to Instagram</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 24,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 400,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  captionInput: {
    width: '100%',
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 16,
    marginRight: 8,
    borderRadius: 30,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  resetButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  publishButton: {
    flex: 2,
    paddingVertical: 16,
    marginLeft: 8,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  publishButtonDisabled: {
    opacity: 0.7,
  },
  publishButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
