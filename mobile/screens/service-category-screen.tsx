import type { ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import type {
  RootStackParamList,
  ServiceType,
} from '../navigation/app-navigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceCategory'>;
type ServiceIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

type ServiceOption = {
  serviceType: ServiceType;
  label: string;
  description: string;
  icon: ServiceIcon;
};

const SERVICES: ServiceOption[] = [
  {
    serviceType: 'airport_shuttle',
    label: 'Airport shuttle',
    description: 'Transportation to and from the airport',
    icon: 'airplane',
  },
  {
    serviceType: 'local_transportation',
    label: 'Local transportation',
    description: 'Local rides and scheduled transportation',
    icon: 'map-marker-path',
  },
  {
    serviceType: 'cleaning_services',
    label: 'Cleaning services',
    description: 'Residential and commercial cleaning',
    icon: 'spray-bottle',
  },
  {
    serviceType: 'junk_removal',
    label: 'Junk removal',
    description: 'Hauling and unwanted-item removal',
    icon: 'delete-outline',
  },
  {
    serviceType: 'landscaping',
    label: 'Landscaping',
    description: 'Lawn care and outdoor maintenance',
    icon: 'flower-outline',
  },
];

const CHECKER_TILES = Array.from({ length: 160 });

export default function ServiceCategoryScreen({ navigation, route }: Props) {
  const { zipCode } = route.params;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <CheckerBackground />

      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>Services</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>What service do you need?</Text>
        <Text style={styles.subtitle}>
          Choose a service to see businesses within 25 miles.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('ServiceLocation')}
          style={styles.locationChip}
        >
          <Ionicons name="location" size={18} color="#A72FFF" />
          <Text style={styles.locationText}>ZIP {zipCode}</Text>
          <Text style={styles.changeText}>Change</Text>
        </Pressable>

        <View style={styles.serviceList}>
          {SERVICES.map((service) => (
            <Pressable
              accessibilityRole="button"
              key={service.serviceType}
              onPress={() =>
                navigation.navigate('ServiceResults', {
                  zipCode,
                  serviceType: service.serviceType,
                  serviceLabel: service.label,
                })
              }
              style={({ pressed }) => [
                styles.serviceCard,
                pressed && styles.pressedCard,
              ]}
            >
              <View style={styles.serviceIconContainer}>
                <MaterialCommunityIcons
                  name={service.icon}
                  size={29}
                  color="#A72FFF"
                />
              </View>

              <View style={styles.serviceTextContainer}>
                <Text style={styles.serviceLabel}>{service.label}</Text>
                <Text style={styles.serviceDescription}>
                  {service.description}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={24} color="#A72FFF" />
            </Pressable>
          ))}
        </View>
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
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#34343A',
    backgroundColor: '#151518',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 44 },
  content: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 50 },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: { color: '#A7A7B0', fontSize: 16, lineHeight: 23 },
  locationChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#3A3042',
    borderRadius: 20,
    backgroundColor: 'rgba(167, 47, 255, 0.09)',
    marginTop: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  locationText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  changeText: { color: '#C66BFF', fontSize: 13, fontWeight: '700' },
  serviceList: { gap: 14, marginTop: 28 },
  serviceCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#35353D',
    borderRadius: 18,
    backgroundColor: 'rgba(17, 17, 20, 0.94)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  serviceIconContainer: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3D2B49',
    borderRadius: 16,
    backgroundColor: '#141218',
  },
  serviceTextContainer: { flex: 1, marginHorizontal: 14 },
  serviceLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  serviceDescription: { color: '#9C9CA5', fontSize: 14, lineHeight: 20 },
  pressedCard: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
