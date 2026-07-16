import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/app-navigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <Text style={styles.subtitle}>
        Sign-up form fields will go here later.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.buttonText}>Continue to Home</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
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
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});