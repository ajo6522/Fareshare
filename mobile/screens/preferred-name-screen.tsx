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

import type { RootStackParamList } from '../navigation/app-navigator';
import { updateCognitoPreferredName } from '../services/cognito-profile';

type Props = NativeStackScreenProps<RootStackParamList, 'PreferredName'>;

const CHECKER_TILES = Array.from({ length: 160 });

export default function PreferredNameScreen({ navigation }: Props) {
  const [preferredName, setPreferredName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function continueToHome() {
    if (isSaving) {
      return;
    }

    const normalizedName = preferredName.trim().replace(/\s+/g, ' ');

    if (!normalizedName) {
      setErrorMessage('Enter the name you want FareShare to display.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await updateCognitoPreferredName(normalizedName);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'FareShare could not save your preferred name.'
      );
    } finally {
      setIsSaving(false);
    }
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
          <View style={styles.iconContainer}>
            <Ionicons name="person-outline" size={38} color="#A72FFF" />
          </View>

          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.subtitle}>
            This is the name FareShare will show on your home screen.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>Preferred name</Text>
            <TextInput
              accessibilityLabel="Preferred name"
              autoCapitalize="words"
              autoCorrect={false}
              editable={!isSaving}
              maxLength={50}
              onChangeText={(value) => {
                setPreferredName(value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              onSubmitEditing={continueToHome}
              placeholder="Enter your preferred name"
              placeholderTextColor="#74747E"
              returnKeyType="done"
              style={styles.input}
              value={preferredName}
            />

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={continueToHome}
              style={({ pressed }) => [
                styles.continueButton,
                isSaving && styles.disabledButton,
                pressed && !isSaving && styles.pressedButton,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.continueButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={21} color="#FFFFFF" />
                </>
              )}
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
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
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
  checkerTile: {
    width: '12.5%',
    aspectRatio: 1,
  },
  checkerTileLight: {
    backgroundColor: '#141414',
  },
  checkerTileDark: {
    backgroundColor: '#080808',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  iconContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#4A245E',
    backgroundColor: 'rgba(167, 47, 255, 0.12)',
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 37,
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
    minHeight: 58,
    color: '#FFFFFF',
    fontSize: 17,
    borderWidth: 1,
    borderColor: '#45454E',
    borderRadius: 14,
    backgroundColor: '#121215',
    paddingHorizontal: 16,
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
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.82,
  },
});
