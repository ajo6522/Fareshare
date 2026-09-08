import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/app-navigator';
import {
  createUploadUrl,
  uploadImageToS3,
  type ImageContentType,
} from '../services/api-client';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function isSupportedImageContentType(
  value: string | null | undefined
): value is ImageContentType {
  return (
    value === 'image/jpeg' ||
    value === 'image/png' ||
    value === 'image/webp'
  );
}

function getImageContentType(
  asset: ImagePicker.ImagePickerAsset
): ImageContentType {
  const mimeType = asset.mimeType?.toLowerCase();

  if (isSupportedImageContentType(mimeType)) {
    return mimeType;
  }

  if (mimeType) {
    throw new Error('Please select a JPEG, PNG, or WebP image.');
  }

  const uri = asset.uri.toLowerCase().split('?')[0];

  if (uri.endsWith('.png')) {
    return 'image/png';
  }

  if (uri.endsWith('.webp')) {
    return 'image/webp';
  }

  if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  throw new Error('Please select a JPEG, PNG, or WebP image.');
}

export default function ProfileScreen({ navigation }: Props) {
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);

  async function selectAndUploadProfileImage() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow FareShare to access your photos so you can choose a profile image.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    setIsUploading(true);

    try {
      const contentType = getImageContentType(asset);
      const upload = await createUploadUrl('profile', contentType);

      await uploadImageToS3(upload.uploadUrl, asset.uri, contentType);

      setProfileImageUri(asset.uri);
      setUploadedObjectKey(upload.objectKey);
      Alert.alert('Upload complete', 'Your profile image was uploaded.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'FareShare could not upload your profile image.';

      Alert.alert('Upload failed', message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.imageContainer}>
        {profileImageUri ? (
          <Image
            source={{ uri: profileImageUri }}
            style={styles.profileImage}
          />
        ) : (
          <Text style={styles.placeholderText}>No photo</Text>
        )}
      </View>

      <Text style={styles.subtitle}>
        Choose a profile image to upload securely.
      </Text>

      <Pressable
        disabled={isUploading}
        style={({ pressed }) => [
          styles.button,
          (pressed || isUploading) && styles.buttonDisabled,
        ]}
        onPress={selectAndUploadProfileImage}
      >
        {isUploading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            {profileImageUri ? 'Replace Profile Image' : 'Choose Profile Image'}
          </Text>
        )}
      </Pressable>

      {uploadedObjectKey ? (
        <Text style={styles.uploadedText}>Uploaded securely</Text>
      ) : null}

      <Pressable
        style={styles.backButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.backButtonText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B3D2E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#8A2BE2',
    marginBottom: 24,
  },
  imageContainer: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 3,
    borderColor: '#8A2BE2',
    backgroundColor: '#142E26',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 20,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  placeholderText: {
    color: '#B8C6C0',
    fontSize: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 28,
    textAlign: 'center',
  },
  button: {
    minWidth: 240,
    minHeight: 54,
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  uploadedText: {
    color: '#B7F7D1',
    fontSize: 15,
    marginTop: 12,
  },
  backButton: {
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
