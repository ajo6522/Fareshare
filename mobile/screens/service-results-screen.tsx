import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import type { RootStackParamList } from '../navigation/app-navigator';
import { apiRequest } from '../services/api-client';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceResults'>;

type ServiceBusiness = {
  businessId: number;
  businessName: string;
  description: string | null;
  city: string;
  state: string;
  postalCode: string;
  distanceMiles: number;
};

type ServiceSearchResponse = {
  businesses: ServiceBusiness[];
};

type ResultsStatus = 'loading' | 'ready' | 'error';

const CHECKER_TILES = Array.from({ length: 160 });

export default function ServiceResultsScreen({ navigation, route }: Props) {
  const { zipCode, serviceType, serviceLabel } = route.params;
  const [businesses, setBusinesses] = useState<ServiceBusiness[]>([]);
  const [status, setStatus] = useState<ResultsStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadBusinesses() {
      setStatus('loading');
      setErrorMessage(null);

      try {
        const query = new URLSearchParams({
          zipCode,
          serviceType,
          radiusMiles: '25',
        });
        const response = await apiRequest<ServiceSearchResponse>(
          `/services/search?${query.toString()}`
        );

        if (isMounted) {
          setBusinesses(response.businesses);
          setStatus('ready');
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'FareShare could not load businesses right now.'
          );
          setStatus('error');
        }
      }
    }

    loadBusinesses();

    return () => {
      isMounted = false;
    };
  }, [retryAttempt, serviceType, zipCode]);

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

        <Text numberOfLines={1} style={styles.headerTitle}>
          {serviceLabel}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {status === 'loading' ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#A72FFF" />
          <Text style={styles.stateTitle}>Finding nearby businesses</Text>
          <Text style={styles.stateMessage}>
            Searching within 25 miles of {zipCode}...
          </Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.centeredState}>
          <Ionicons name="cloud-offline-outline" size={48} color="#A72FFF" />
          <Text style={styles.stateTitle}>We couldn’t load the results</Text>
          <Text style={styles.stateMessage}>{errorMessage}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetryAttempt((attempt) => attempt + 1)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : businesses.length === 0 ? (
        <View style={styles.centeredState}>
          <View style={styles.emptyIconContainer}>
            <MaterialCommunityIcons
              name="map-search-outline"
              size={45}
              color="#A72FFF"
            />
          </View>
          <Text style={styles.stateTitle}>No matches in your area yet</Text>
          <Text style={styles.stateMessage}>
            We couldn’t find any {serviceLabel.toLowerCase()} providers within
            25 miles of ZIP code {zipCode}.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('ServiceCategory', { zipCode })}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Choose another service</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('ServiceLocation')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Change ZIP code</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.resultsTitle}>{serviceLabel} near you</Text>
          <Text style={styles.resultsSubtitle}>
            {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'}
            {' '}within 25 miles of {zipCode}
          </Text>

          <View style={styles.businessList}>
            {businesses.map((business) => (
              <View key={business.businessId} style={styles.businessCard}>
                <View style={styles.businessIcon}>
                  <MaterialCommunityIcons
                    name="storefront-outline"
                    size={29}
                    color="#A72FFF"
                  />
                </View>

                <View style={styles.businessDetails}>
                  <Text style={styles.businessName}>
                    {business.businessName}
                  </Text>
                  <Text style={styles.businessLocation}>
                    {business.city}, {business.state} {business.postalCode}
                  </Text>
                  {business.description ? (
                    <Text numberOfLines={2} style={styles.businessDescription}>
                      {business.description}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>
                    {business.distanceMiles.toFixed(1)} mi
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
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
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerSpacer: { width: 44 },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  emptyIconContainer: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#4A245E',
    backgroundColor: 'rgba(167, 47, 255, 0.12)',
  },
  stateTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  stateMessage: {
    color: '#A7A7B0',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 350,
  },
  primaryButton: {
    minWidth: 230,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#A72FFF',
    marginTop: 26,
    paddingHorizontal: 22,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 14 },
  secondaryButtonText: { color: '#C66BFF', fontSize: 15, fontWeight: '700' },
  resultsContent: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 50 },
  resultsTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    marginBottom: 6,
  },
  resultsSubtitle: { color: '#A7A7B0', fontSize: 15, lineHeight: 22 },
  businessList: { gap: 14, marginTop: 24 },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#35353D',
    borderRadius: 18,
    backgroundColor: 'rgba(17, 17, 20, 0.94)',
    padding: 16,
  },
  businessIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3D2B49',
    borderRadius: 15,
    backgroundColor: '#141218',
  },
  businessDetails: { flex: 1, marginHorizontal: 13 },
  businessName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  businessLocation: { color: '#A7A7B0', fontSize: 13, lineHeight: 19 },
  businessDescription: {
    color: '#898993',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  distanceBadge: {
    borderRadius: 12,
    backgroundColor: 'rgba(167, 47, 255, 0.13)',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  distanceText: { color: '#C66BFF', fontSize: 12, fontWeight: '800' },
});
