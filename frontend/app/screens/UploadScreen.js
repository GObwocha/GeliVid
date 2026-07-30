import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { io } from 'socket.io-client';
import axios from 'axios';
import { colors } from '../theme';

const BACKEND_URL = 'http://localhost:8081';

export default function UploadScreen({ onUploadSuccess }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);
    
    newSocket.on('progress', (data) => {
      setProgress(data);
    });

    newSocket.on('completed', (data) => {
      setIsUploading(false);
      onUploadSuccess(data);
    });

    newSocket.on('error', (err) => {
      alert(`Error processing video: ${err.message}`);
      setIsUploading(false);
      setProgress(null);
    });

    return () => newSocket.close();
  }, [onUploadSuccess]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      setIsUploading(true);
      setProgress({ step: 'uploading', percent: 0 });

      const formData = new FormData();
      
      // Expo Web provides the actual HTML5 File object in 'file.file'
      if (file.file) {
        formData.append('video', file.file);
      } else {
        // Native platforms use the uri object
        formData.append('video', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'video/mp4',
        });
      }
      
      formData.append('clientId', socket?.id);

      await axios.post(`${BACKEND_URL}/api/process`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress({ step: 'uploading', percent: percentCompleted });
        }
      });

    } catch (error) {
      alert('Upload failed: ' + error.message);
      setIsUploading(false);
      setProgress(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auto-Editor Pro</Text>
      <Text style={styles.subtitle}>Transform your raw footage into an Instagram-ready reel.</Text>
      
      <View style={styles.uploadBox}>
        {isUploading ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.progressText}>
              {progress ? `${progress.step.toUpperCase()}: ${progress.percent}%` : 'Processing...'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
            <Text style={styles.uploadButtonText}>Select Video</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
  },
  uploadBox: {
    width: '100%',
    height: 250,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  uploadButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    marginTop: 16,
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  }
});
