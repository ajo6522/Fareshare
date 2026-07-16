import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/app-navigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AvailableRides'>;

export default function AvailableRidesScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Rides</Text>

      <Text style={styles.subtitle}>
        Available rides will appear here.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('RideDetails')}
      >
        <Text style={styles.buttonText}>View Ride Details</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
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
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
});