import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import type { RootStackParamList } from '../navigation/app-navigator';
import { getCurrentFareShareLocation } from '../services/location-service';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceLocation'>;

const CHECKER_TILES = Array.from({ length: 160 });

const LOCATION_KEYS = {
  latitude: 'fareshare.location.latitude',
  longitude: 'fareshare.location.longitude',
  city: 'fareshare.location.city',
  stateRegion: 'fareshare.location.stateRegion',
  postalCode: 'fareshare.location.postalCode',
} as const;

export default function ServiceLocationScreen({ navigation }: Props) {
  const [zipCode, setZipCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedArea, setDetectedArea] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  async function useCurrentLocation() {
    setIsLocating(true);
    setErrorMessage(null);

    try {
      const location = await getCurrentFareShareLocation();

      if (!location.postalCode || !/^\d{5}$/.test(location.postalCode)) {
        throw new Error(
          'FareShare found your location, but could not determine a 5-digit ZIP code.'
        );
      }

      setZipCode(location.postalCode);

      const areaParts = [
        location.city,
        location.stateRegion,
        location.postalCode,
      ].filter(Boolean);

      setDetectedArea(areaParts.join(', '));

      await Promise.all([
        SecureStore.setItemAsync(
          LOCATION_KEYS.latitude,
          String(location.latitude)
        ),
        SecureStore.setItemAsync(
          LOCATION_KEYS.longitude,
          String(location.longitude)
        ),
        SecureStore.setItemAsync(
          LOCATION_KEYS.city,
          location.city ?? ''
        ),
        SecureStore.setItemAsync(
          LOCATION_KEYS.stateRegion,
          location.stateRegion ?? ''
        ),
        SecureStore.setItemAsync(
          LOCATION_KEYS.postalCode,
          location.postalCode
        ),
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'FareShare could not determine your current location.';

      setDetectedArea(null);
      setErrorMessage(message);
    } finally {
      setIsLocating(false);
    }
  }

  function continueToServices() {
    if (!/^\d{5}$/.test(zipCode)) {
      setErrorMessage('Enter a valid 5-digit ZIP code.');
      return;
    }

    navigation.navigate('ServiceCategory', { zipCode });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <CheckerBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
          </Pressable>

          <View style={styles.iconContainer}>
            <Ionicons name="location-outline" size={40} color="#A72FFF" />
          </View>

          <Text style={styles.title}>What’s your ZIP code?</Text>
          <Text style={styles.subtitle}>
            We’ll use it to find service providers within 25 miles of you.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>ZIP code</Text>
            <TextInput
              accessibilityLabel="ZIP code"
              autoFocus
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={(value) => {
                setZipCode(value.replace(/\D/g, '').slice(0, 5));
                setDetectedArea(null);

                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              onSubmitEditing={continueToServices}
              placeholder="Enter ZIP code"
              placeholderTextColor="#74747E"
              returnKeyType="next"
              style={styles.input}
              value={zipCode}
            />

            <Pressable
              accessibilityRole="button"
              disabled={isLocating}
              onPress={() => void useCurrentLocation()}
              style={({ pressed }) => [
                styles.locationButton,
                (pressed || isLocating) && styles.pressedButton,
              ]}
            >
              {isLocating ? (
                <ActivityIndicator color="#C66BFF" />
              ) : (
                <>
                  <Ionicons name="navigate-outline" size={20} color="#C66BFF" />
                  <Text style={styles.locationButtonText}>
                    Use current location
                  </Text>
                </>
              )}
            </Pressable>

            {detectedArea ? (
              <View style={styles.detectedArea}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#C66BFF"
                />
                <Text style={styles.detectedAreaText}>{detectedArea}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={continueToServices}
              style={({ pressed }) => [
                styles.continueButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.continueButtonText}>View services</Text>
              <Ionicons name="arrow-forward" size={21} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CheckerBackground() {
  return (
    <View pointerEvents="none" style={styles.checkerboard}>
      {CHECKER_TILES.map((_, index) => {
        const row = Math.floor(index / 8);
        const column = index % 8;
        const isLight = (row + column) % 2 === 0;

        return (
          <View
            key={index}
            style={[
              styles.checkerTile,
              isLight ? styles.checkerTileLight : styles.checkerTileDark,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  keyboardView: { flex: 1 },
  checkerboard: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    opacity: 0.3,
  },
  checkerTile: { width: '12.5%', aspectRatio: 1 },
  checkerTileLight: { backgroundColor: '#141414' },
  checkerTileDark: { backgroundColor: '#080808' },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#34343A',
    backgroundColor: '#151518',
  },
  iconContainer: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#4A245E',
    backgroundColor: 'rgba(167, 47, 255, 0.12)',
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#A7A7B0',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 350,
    marginBottom: 30,
  },
  formCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#303038',
    backgroundColor: 'rgba(15, 15, 18, 0.95)',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    minHeight: 60,
    color: '#FFFFFF',
    fontSize: 19,
    letterSpacing: 3,
    borderWidth: 1,
    borderColor: '#45454E',
    borderRadius: 14,
    backgroundColor: '#121215',
    paddingHorizontal: 16,
  },
  locationButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#4A245E',
    borderRadius: 14,
    backgroundColor: 'rgba(167, 47, 255, 0.08)',
    marginTop: 14,
    paddingHorizontal: 16,
  },
  locationButtonText: {
    color: '#C66BFF',
    fontSize: 15,
    fontWeight: '800',
  },
  detectedArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  detectedAreaText: {
    color: '#D7B4F5',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  errorText: {
    color: '#FF9D9D',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  continueButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#A72FFF',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  pressedButton: { opacity: 0.82 },
});
