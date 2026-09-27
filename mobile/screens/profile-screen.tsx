import { useCallback, useState } from 'react';

import {

  ActivityIndicator,

  Alert,

  Image,

  Pressable,

  ScrollView,

  StyleSheet,

  Text,

  View,

} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';

import * as SecureStore from 'expo-secure-store';

import { useFocusEffect } from '@react-navigation/native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';



import type { RootStackParamList } from '../navigation/app-navigator';

import {

  createUploadUrl,

  deleteAccount,

  getBusinessAccess,

  getProfileImage,

  uploadImageToS3,

  type ImageContentType,

} from '../services/api-client';



type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;



const TOKEN_KEYS = [

  'fareshare.accessToken',

  'fareshare.idToken',

  'fareshare.refreshToken',

  'fareshare.expiresAt',

] as const;



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

  const [isLoadingImage, setIsLoadingImage] = useState(true);

  const [isLoadingBusinessAccess, setIsLoadingBusinessAccess] = useState(true);

  const [hasBusinessAccess, setHasBusinessAccess] = useState(false);

  const [isBusinessOwner, setIsBusinessOwner] = useState(false);

  const [deleteBusinessToo, setDeleteBusinessToo] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);



  const isBusy =

    isLoadingImage ||

    isLoadingBusinessAccess ||

    isUploading ||

    isLoggingOut ||

    isDeletingAccount;



  useFocusEffect(

    useCallback(() => {

      let isActive = true;



      async function loadProfileImage() {

        setIsLoadingImage(true);



        try {

          const profileImage = await getProfileImage();



          if (isActive) {

            setProfileImageUri(profileImage.imageUrl);

            setUploadedObjectKey(profileImage.objectKey);

          }

        } catch (error) {

          if (isActive) {

            const message =

              error instanceof Error

                ? error.message

                : 'FareShare could not load your profile image.';



            Alert.alert('Unable to load profile image', message);

          }

        } finally {

          if (isActive) {

            setIsLoadingImage(false);

          }

        }

      }



      async function loadBusinessAccess() {

        setIsLoadingBusinessAccess(true);



        try {

          const businessAccess = await getBusinessAccess();



          if (isActive) {

            setHasBusinessAccess(businessAccess.hasBusinessAccess);

            const ownsBusiness = businessAccess.memberships.some(
              (membership) => membership.role.toUpperCase() === 'OWNER'
            );

            setIsBusinessOwner(ownsBusiness);

            if (!ownsBusiness) {
              setDeleteBusinessToo(false);
            }

          }

        } catch (error) {

          if (isActive) {

            const message =

              error instanceof Error

                ? error.message

                : 'FareShare could not load your business access.';



            Alert.alert('Unable to load business access', message);

          }

        } finally {

          if (isActive) {

            setIsLoadingBusinessAccess(false);

          }

        }

      }



      void loadProfileImage();

      void loadBusinessAccess();



      return () => {

        isActive = false;

      };

    }, [])

  );



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



  async function logOut() {

    setIsLoggingOut(true);



    try {

      await Promise.all(

        TOKEN_KEYS.map((key) => SecureStore.deleteItemAsync(key))

      );



      navigation.reset({

        index: 0,

        routes: [{ name: 'SignIn' }],

      });

    } catch {

      Alert.alert(

        'Unable to log out',

        'FareShare could not clear your session. Please try again.'

      );

      setIsLoggingOut(false);

    }

  }



  function confirmLogout() {

    Alert.alert(

      'Log out of FareShare?',

      'You will need to sign in again to access your account.',

      [

        { text: 'Cancel', style: 'cancel' },

        {

          text: 'Log Out',

          style: 'destructive',

          onPress: () => void logOut(),

        },

      ]

    );

  }



  async function performAccountDeletion() {
    setIsDeletingAccount(true);

    try {
      await deleteAccount(deleteBusinessToo);

      await Promise.all(
        TOKEN_KEYS.map((key) => SecureStore.deleteItemAsync(key))
      );

      navigation.reset({
        index: 0,
        routes: [{ name: 'SignIn' }],
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'FareShare could not delete your account. Please try again.';

      Alert.alert('Unable to delete account', message);
      setIsDeletingAccount(false);
    }
  }

  function confirmAccountDeletion() {
    const businessWarning =
      isBusinessOwner && deleteBusinessToo
        ? ' Your business will also be deleted and its services will be disabled.'
        : '';

    Alert.alert(
      'Delete your FareShare account?',
      `This permanently deletes your sign-in account and removes your personal information from FareShare.${businessWarning} This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => void performAccountDeletion(),
        },
      ]
    );
  }



  return (

    <View style={styles.container}>

      <View style={styles.purpleGlow} />



      <ScrollView

        contentContainerStyle={styles.content}

        showsVerticalScrollIndicator={false}

      >

        <View style={styles.headingContainer}>

          <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>

          <Text style={styles.title}>Profile</Text>

          <Text style={styles.subtitle}>

            Manage your FareShare profile and account.

          </Text>

        </View>



        <View style={styles.card}>

          <View style={styles.imageContainer}>

            {isLoadingImage ? (

              <ActivityIndicator color="#C66BFF" />

            ) : profileImageUri ? (

              <Image

                source={{ uri: profileImageUri }}

                style={styles.profileImage}

              />

            ) : (

              <Ionicons name="person" size={68} color="#8C8C96" />

            )}

          </View>



          <Text style={styles.cardTitle}>Profile photo</Text>

          <Text style={styles.cardDescription}>

            Choose a clear photo so people can recognize you.

          </Text>



          <Pressable

            disabled={isBusy}

            style={({ pressed }) => [

              styles.primaryButton,

              (pressed || isBusy) && styles.buttonDisabled,

            ]}

            onPress={selectAndUploadProfileImage}

          >

            {isUploading ? (

              <ActivityIndicator color="#FFFFFF" />

            ) : (

              <View style={styles.buttonContent}>

                <Ionicons name="camera-outline" size={20} color="#FFFFFF" />

                <Text style={styles.primaryButtonText}>

                  {profileImageUri

                    ? 'Replace Profile Image'

                    : 'Choose Profile Image'}

                </Text>

              </View>

            )}

          </Pressable>



          {uploadedObjectKey ? (

            <View style={styles.uploadedRow}>

              <Ionicons

                name="checkmark-circle"

                size={18}

                color="#C66BFF"

              />

              <Text style={styles.uploadedText}>Uploaded securely</Text>

            </View>

          ) : null}

        </View>



        <View style={styles.businessCard}>

          <View style={styles.businessHeading}>

            <View style={styles.businessIcon}>

              <Ionicons name="briefcase-outline" size={24} color="#C66BFF" />

            </View>



            <View style={styles.businessCopy}>

              <Text style={styles.accountTitle}>Business access</Text>

              <Text style={styles.accountDescription}>

                {hasBusinessAccess

                  ? 'Open your business dashboard and manage your services.'

                  : 'Create a business profile and choose the services you provide.'}

              </Text>

            </View>

          </View>



          <Pressable

            disabled={isBusy}

            onPress={() => {

              if (hasBusinessAccess) {

                navigation.navigate('ProviderHome');

              } else {

                navigation.navigate('BusinessOnboarding');

              }

            }}

            style={({ pressed }) => [

              styles.businessButton,

              (pressed || isBusy) && styles.buttonDisabled,

            ]}

          >

            {isLoadingBusinessAccess ? (

              <ActivityIndicator color="#FFFFFF" />

            ) : (

              <View style={styles.buttonContent}>

                <Ionicons

                  name={hasBusinessAccess ? 'briefcase' : 'log-in-outline'}

                  size={20}

                  color="#FFFFFF"

                />

                <Text style={styles.primaryButtonText}>

                  {hasBusinessAccess

                    ? 'Open Business Dashboard'

                    : 'Log in as a Business'}

                </Text>

              </View>

            )}

          </Pressable>

        </View>



        <View style={styles.accountCard}>

          <View style={styles.accountCopy}>

            <Text style={styles.accountTitle}>Account access</Text>

            <Text style={styles.accountDescription}>

              Sign out securely on this device.

            </Text>

          </View>



          <Pressable

            disabled={isBusy}

            style={({ pressed }) => [

              styles.logoutButton,

              (pressed || isBusy) && styles.buttonDisabled,

            ]}

            onPress={confirmLogout}

          >

            {isLoggingOut ? (

              <ActivityIndicator color="#FF9D9D" />

            ) : (

              <View style={styles.buttonContent}>

                <Ionicons name="log-out-outline" size={20} color="#FF9D9D" />

                <Text style={styles.logoutButtonText}>Log Out</Text>

              </View>

            )}

          </Pressable>

        </View>



        <View style={styles.dangerCard}>
          <View style={styles.accountCopy}>
            <Text style={styles.dangerTitle}>Delete account</Text>
            <Text style={styles.accountDescription}>
              Permanently delete your FareShare account and remove your personal information.
            </Text>
          </View>

          {isBusinessOwner ? (
            <Pressable
              disabled={isBusy}
              onPress={() => setDeleteBusinessToo((current) => !current)}
              style={({ pressed }) => [
                styles.deleteBusinessOption,
                pressed && styles.deleteBusinessOptionPressed,
                isBusy && styles.buttonDisabled,
              ]}
            >
              <Ionicons
                name={deleteBusinessToo ? 'checkbox' : 'square-outline'}
                size={24}
                color={deleteBusinessToo ? '#FF6B6B' : '#A5A5AE'}
              />

              <View style={styles.deleteBusinessCopy}>
                <Text style={styles.deleteBusinessTitle}>
                  Also delete my business
                </Text>
                <Text style={styles.deleteBusinessDescription}>
                  Only business owners can choose this. The business will be
                  marked deleted and its services will be disabled.
                </Text>
              </View>
            </Pressable>
          ) : null}

          <Pressable
            disabled={isBusy}
            style={({ pressed }) => [
              styles.deleteButton,
              (pressed || isBusy) && styles.buttonDisabled,
            ]}
            onPress={confirmAccountDeletion}
          >
            {isDeletingAccount ? (
              <ActivityIndicator color="#FF6B6B" />
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                <Text style={styles.deleteButtonText}>Delete Account</Text>
              </View>
            )}
          </Pressable>
        </View>



        <Pressable

          disabled={isBusy}

          style={({ pressed }) => [

            styles.backButton,

            pressed && styles.backButtonPressed,

          ]}

          onPress={() => navigation.navigate('Home')}

        >

          <Ionicons name="arrow-back" size={18} color="#C66BFF" />

          <Text style={styles.backButtonText}>Back to Home</Text>

        </Pressable>

      </ScrollView>

    </View>

  );

}



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: '#000000',

    overflow: 'hidden',

  },

  purpleGlow: {

    position: 'absolute',

    top: -130,

    right: -110,

    width: 280,

    height: 280,

    borderRadius: 140,

    backgroundColor: 'rgba(167, 47, 255, 0.17)',

  },

  content: {

    flexGrow: 1,

    paddingHorizontal: 22,

    paddingTop: 36,

    paddingBottom: 36,

  },

  headingContainer: {

    marginBottom: 24,

  },

  eyebrow: {

    color: '#C66BFF',

    fontSize: 12,

    fontWeight: '800',

    letterSpacing: 1.8,

    marginBottom: 8,

  },

  title: {

    color: '#FFFFFF',

    fontSize: 34,

    fontWeight: '800',

    letterSpacing: -0.7,

  },

  subtitle: {

    color: '#A5A5AE',

    fontSize: 16,

    lineHeight: 23,

    marginTop: 7,

  },

  card: {

    alignItems: 'center',

    backgroundColor: 'rgba(17, 17, 20, 0.94)',

    borderColor: '#2A2A31',

    borderRadius: 24,

    borderWidth: 1,

    paddingHorizontal: 22,

    paddingVertical: 28,

  },

  imageContainer: {

    width: 136,

    height: 136,

    borderRadius: 68,

    borderWidth: 3,

    borderColor: '#A72FFF',

    backgroundColor: '#202025',

    alignItems: 'center',

    justifyContent: 'center',

    overflow: 'hidden',

    marginBottom: 22,

  },

  profileImage: {

    width: '100%',

    height: '100%',

  },

  cardTitle: {

    color: '#FFFFFF',

    fontSize: 21,

    fontWeight: '800',

  },

  cardDescription: {

    color: '#9C9CA5',

    fontSize: 15,

    lineHeight: 21,

    marginBottom: 22,

    marginTop: 7,

    maxWidth: 285,

    textAlign: 'center',

  },

  primaryButton: {

    alignItems: 'center',

    alignSelf: 'stretch',

    backgroundColor: '#A72FFF',

    borderRadius: 14,

    justifyContent: 'center',

    minHeight: 54,

    paddingHorizontal: 20,

  },

  buttonContent: {

    alignItems: 'center',

    flexDirection: 'row',

    gap: 9,

    justifyContent: 'center',

  },

  buttonDisabled: {

    opacity: 0.58,

  },

  primaryButtonText: {

    color: '#FFFFFF',

    fontSize: 16,

    fontWeight: '800',

  },

  uploadedRow: {

    alignItems: 'center',

    flexDirection: 'row',

    gap: 7,

    marginTop: 12,

  },

  uploadedText: {

    color: '#C66BFF',

    fontSize: 14,

    fontWeight: '700',

  },

  accountCard: {

    backgroundColor: 'rgba(17, 17, 20, 0.94)',

    borderColor: '#2A2A31',

    borderRadius: 20,

    borderWidth: 1,

    marginTop: 16,

    padding: 20,

  },

  businessCard: {

    backgroundColor: 'rgba(17, 17, 20, 0.94)',

    borderColor: '#3D2B49',

    borderRadius: 20,

    borderWidth: 1,

    marginTop: 16,

    padding: 20,

  },

  businessHeading: {

    alignItems: 'center',

    flexDirection: 'row',

    marginBottom: 17,

  },

  businessIcon: {

    width: 48,

    height: 48,

    alignItems: 'center',

    backgroundColor: '#17111C',

    borderColor: '#3D2B49',

    borderRadius: 14,

    borderWidth: 1,

    justifyContent: 'center',

  },

  businessCopy: { flex: 1, marginLeft: 13 },

  businessButton: {

    minHeight: 52,

    alignItems: 'center',

    backgroundColor: '#A72FFF',

    borderRadius: 14,

    justifyContent: 'center',

  },

  accountCopy: {

    marginBottom: 16,

  },

  accountTitle: {

    color: '#FFFFFF',

    fontSize: 18,

    fontWeight: '800',

  },

  accountDescription: {

    color: '#9C9CA5',

    fontSize: 14,

    marginTop: 5,

  },

  logoutButton: {

    alignItems: 'center',

    borderColor: '#6B303B',

    borderRadius: 14,

    borderWidth: 1,

    justifyContent: 'center',

    minHeight: 52,

  },

  logoutButtonText: {

    color: '#FF9D9D',

    fontSize: 16,

    fontWeight: '800',

  },

  dangerCard: {
    backgroundColor: 'rgba(30, 12, 15, 0.94)',
    borderColor: '#6B303B',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
  },

  dangerTitle: {
    color: '#FF9D9D',
    fontSize: 18,
    fontWeight: '800',
  },

  deleteBusinessOption: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderColor: '#4A232B',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    padding: 14,
  },

  deleteBusinessOptionPressed: {
    opacity: 0.72,
  },

  deleteBusinessCopy: {
    flex: 1,
  },

  deleteBusinessTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  deleteBusinessDescription: {
    color: '#9C9CA5',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },

  deleteButton: {
    alignItems: 'center',
    borderColor: '#8A2F3E',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },

  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '800',
  },

  backButton: {

    alignItems: 'center',

    alignSelf: 'center',

    flexDirection: 'row',

    gap: 8,

    marginTop: 24,

    paddingHorizontal: 16,

    paddingVertical: 12,

  },

  backButtonPressed: {

    opacity: 0.65,

  },

  backButtonText: {

    color: '#C66BFF',

    fontSize: 15,

    fontWeight: '700',

  },

});
