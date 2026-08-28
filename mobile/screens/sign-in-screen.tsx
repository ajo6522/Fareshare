import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';

import type { RootStackParamList } from '../navigation/app-navigator';
import {
  cognitoAuthDiscovery,
  cognitoConfig,
  cognitoSignUpDiscovery,
} from '../config/cognito';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;
type AuthMode = 'signIn' | 'signUp';

const redirectUri = AuthSession.makeRedirectUri({
  native: cognitoConfig.redirectUri,
});

const TOKEN_KEYS = {
  accessToken: 'fareshare.accessToken',
  idToken: 'fareshare.idToken',
  refreshToken: 'fareshare.refreshToken',
  expiresAt: 'fareshare.expiresAt',
} as const;

const CHECKER_TILES = Array.from({ length: 160 });

export default function SignInScreen({ navigation }: Props) {
  const [activeMode, setActiveMode] = useState<AuthMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [signInRequest, , promptSignIn] = AuthSession.useAuthRequest(
    {
      clientId: cognitoConfig.clientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: [...cognitoConfig.scopes],
      usePKCE: true,
    },
    cognitoAuthDiscovery
  );

  const [signUpRequest, , promptSignUp] = AuthSession.useAuthRequest(
    {
      clientId: cognitoConfig.clientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: [...cognitoConfig.scopes],
      usePKCE: true,
    },
    cognitoSignUpDiscovery
  );

  const requestsReady = Boolean(signInRequest && signUpRequest);
  const isBusy = activeMode !== null;

  async function authenticate(mode: AuthMode) {
    const authRequest =
      mode === 'signIn' ? signInRequest : signUpRequest;

    const promptAsync =
      mode === 'signIn' ? promptSignIn : promptSignUp;

    if (!authRequest || isBusy) {
      return;
    }

    setErrorMessage(null);
    setActiveMode(mode);

    try {
      const result = await promptAsync();

      if (result.type === 'error') {
        setErrorMessage(
          result.error?.message ??
            'Cognito could not complete authentication.'
        );
        return;
      }

      if (result.type !== 'success') {
        return;
      }

      const authorizationCode = result.params.code;
      const codeVerifier = authRequest.codeVerifier;

      if (!authorizationCode || !codeVerifier) {
        throw new Error(
          'Cognito did not return a complete authorization response.'
        );
      }

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: cognitoConfig.clientId,
          code: authorizationCode,
          redirectUri,
          extraParams: {
            code_verifier: codeVerifier,
          },
        },
        cognitoAuthDiscovery
      );

      const secureWrites: Promise<void>[] = [
        SecureStore.setItemAsync(
          TOKEN_KEYS.accessToken,
          tokenResponse.accessToken
        ),
      ];

      if (tokenResponse.idToken) {
        secureWrites.push(
          SecureStore.setItemAsync(
            TOKEN_KEYS.idToken,
            tokenResponse.idToken
          )
        );
      }

      if (tokenResponse.refreshToken) {
        secureWrites.push(
          SecureStore.setItemAsync(
            TOKEN_KEYS.refreshToken,
            tokenResponse.refreshToken
          )
        );
      }

      if (tokenResponse.expiresIn) {
        const issuedAt =
          tokenResponse.issuedAt ??
          AuthSession.getCurrentTimeInSeconds();

        secureWrites.push(
          SecureStore.setItemAsync(
            TOKEN_KEYS.expiresAt,
            String(issuedAt + tokenResponse.expiresIn)
          )
        );
      }

      await Promise.all(secureWrites);

      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'FareShare could not complete authentication.'
      );
    } finally {
      setActiveMode(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />

      <CheckerBackground />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>F</Text>
            <View style={styles.logoAccent} />
          </View>

          <Text style={styles.brandName}>FareShare</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>Your journey starts here</Text>

          <Text style={styles.subtitle}>
            Sign in or create your secure FareShare account.
          </Text>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.cardTitle}>Continue to FareShare</Text>

          <Text style={styles.cardSubtitle}>
            Your account credentials are securely handled by Amazon
            Cognito.
          </Text>

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!requestsReady || isBusy}
            onPress={() => authenticate('signIn')}
            style={({ pressed }) => [
              styles.primaryButton,
              (!requestsReady || isBusy) && styles.disabledButton,
              pressed && !isBusy && styles.pressedButton,
            ]}
          >
            <LinearGradient
              colors={['#7A1FFF', '#B13CFF', '#8A2BE2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            >
              {activeMode === 'signIn' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Sign in securely
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!requestsReady || isBusy}
            onPress={() => authenticate('signUp')}
            style={({ pressed }) => [
              styles.secondaryButton,
              (!requestsReady || isBusy) && styles.disabledButton,
              pressed && !isBusy && styles.pressedButton,
            ]}
          >
            {activeMode === 'signUp' ? (
              <ActivityIndicator color="#B13CFF" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                Create an account
              </Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.securityText}>
          Secure authentication powered by AWS
        </Text>
      </ScrollView>
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
              isLight
                ? styles.checkerTileLight
                : styles.checkerTileDark,
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
  checkerboard: {
    position: 'absolute',
top: 0,
right: 0,
bottom: 0,
left: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    opacity: 0.32,
  },
  checkerTile: {
    width: '12.5%',
    aspectRatio: 1,
  },
  checkerTileLight: {
    backgroundColor: '#151515',
  },
  checkerTileDark: {
    backgroundColor: '#090909',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 42,
  },
  logoMark: {
    width: 58,
    height: 58,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    transform: [{ skewX: '-8deg' }],
  },
  logoLetter: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  logoAccent: {
    position: 'absolute',
    right: 7,
    bottom: 8,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#A72FFF',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#B8B8C1',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 340,
  },
  authCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#303038',
    backgroundColor: 'rgba(15, 15, 18, 0.94)',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#A7A7B0',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    color: '#FF9D9D',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#303038',
  },
  dividerText: {
    color: '#777782',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 14,
  },
  secondaryButton: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#8A2BE2',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(138, 43, 226, 0.08)',
  },
  secondaryButtonText: {
    color: '#C260FF',
    fontSize: 17,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.82,
  },
  securityText: {
    color: '#777782',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 22,
  },
});