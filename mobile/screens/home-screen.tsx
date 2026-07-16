import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/app-navigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FareShare</Text>

      <Text style={styles.subtitle}>What would you like to do?</Text>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('CreateRide')}
      >
        <Text style={styles.buttonText}>Create a Ride</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('AvailableRides')}
      >
        <Text style={styles.buttonText}>View Available Rides</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('RideRequests')}
      >
        <Text style={styles.buttonText}>Ride Requests</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('Profile')}
      >
        <Text style={styles.buttonText}>Profile</Text>
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
    fontSize: 42,
    fontWeight: 'bold',
    color: '#8A2BE2',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 28,
  },
  button: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
});