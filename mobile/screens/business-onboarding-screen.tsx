import { useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import type { RootStackParamList } from '../navigation/app-navigator';
import {
  createBusinessAccount,
  type BusinessServiceType,
} from '../services/api-client';
import { geocodeBusinessLocation } from '../services/location-service';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'BusinessOnboarding'
>;

type ServiceIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

type ServiceOption = {
  serviceType: BusinessServiceType;
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

function optionalValue(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export default function BusinessOnboardingScreen({ navigation }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [selectedServices, setSelectedServices] = useState<
    BusinessServiceType[]
  >([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    companyName.trim().length >= 2 &&
    city.trim().length > 0 &&
    stateRegion.trim().length > 0 &&
    /^\d{5}$/.test(postalCode.trim()) &&
    selectedServices.length > 0 &&
    !isSubmitting;

  function toggleService(serviceType: BusinessServiceType) {
    setSelectedServices((currentServices) =>
      currentServices.includes(serviceType)
        ? currentServices.filter((value) => value !== serviceType)
        : [...currentServices, serviceType]
    );
  }

  async function submitBusiness() {
    if (!canSubmit) {
      if (!/^\d{5}$/.test(postalCode.trim())) {
        setLocationError('Enter a valid 5-digit ZIP code.');
      }
      return;
    }

    setIsSubmitting(true);
    setLocationError(null);

    try {
      const coordinates = await geocodeBusinessLocation(
        city,
        stateRegion,
        postalCode
      );

      await createBusinessAccount({
        companyName: companyName.trim(),
        description: optionalValue(description),
        city: city.trim(),
        stateRegion: stateRegion.trim(),
        postalCode: postalCode.trim(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        serviceTypes: selectedServices,
      });

      Alert.alert(
        'Business access ready',
        'Your business profile was created. You can now use the FareShare business dashboard.',
        [
          {
            text: 'Continue',
            onPress: () =>
              navigation.reset({
                index: 1,
                routes: [
                  { name: 'Home' },
                  { name: 'ProviderHome' },
                ],
              }),
          },
        ]
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'FareShare could not create your business account.';

      Alert.alert('Unable to create business account', message);
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitle}>Business setup</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>BUSINESS ACCESS</Text>
          <Text style={styles.title}>Join FareShare as a business</Text>
          <Text style={styles.subtitle}>
            Create your business profile and choose every service your business
            provides.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Business details</Text>

            <Text style={styles.inputLabel}>Business name</Text>
            <TextInput
              autoCapitalize="words"
              editable={!isSubmitting}
              maxLength={150}
              onChangeText={setCompanyName}
              placeholder="Your business name"
              placeholderTextColor="#6F6F79"
              style={styles.input}
              value={companyName}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              editable={!isSubmitting}
              maxLength={2000}
              multiline
              onChangeText={setDescription}
              placeholder="Tell customers about your business"
              placeholderTextColor="#6F6F79"
              style={[styles.input, styles.descriptionInput]}
              textAlignVertical="top"
              value={description}
            />

            <View style={styles.cityRow}>
              <View style={styles.cityField}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  autoCapitalize="words"
                  editable={!isSubmitting}
                  maxLength={100}
                  onChangeText={(value) => {
                    setCity(value);
                    if (locationError) {
                      setLocationError(null);
                    }
                  }}
                  placeholder="City"
                  placeholderTextColor="#6F6F79"
                  style={styles.input}
                  value={city}
                />
              </View>

              <View style={styles.stateField}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  autoCapitalize="characters"
                  editable={!isSubmitting}
                  maxLength={100}
                  onChangeText={(value) => {
                    setStateRegion(value);
                    if (locationError) {
                      setLocationError(null);
                    }
                  }}
                  placeholder="State"
                  placeholderTextColor="#6F6F79"
                  style={styles.input}
                  value={stateRegion}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>ZIP code</Text>
            <TextInput
              editable={!isSubmitting}
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={(value) => {
                setPostalCode(value.replace(/\D/g, '').slice(0, 5));
                if (locationError) {
                  setLocationError(null);
                }
              }}
              placeholder="ZIP code"
              placeholderTextColor="#6F6F79"
              style={styles.input}
              value={postalCode}
            />

            <Text style={styles.locationNote}>
              FareShare will convert this business location into coordinates for nearby search.
            </Text>

            {locationError ? (
              <Text style={styles.locationError}>{locationError}</Text>
            ) : null}
          </View>

          <View style={styles.servicesSection}>
            <Text style={styles.sectionTitle}>Services provided</Text>
            <Text style={styles.sectionDescription}>
              Select at least one. You can choose multiple services.
            </Text>

            <View style={styles.serviceList}>
              {SERVICES.map((service) => {
                const isSelected = selectedServices.includes(
                  service.serviceType
                );

                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    disabled={isSubmitting}
                    key={service.serviceType}
                    onPress={() => toggleService(service.serviceType)}
                    style={({ pressed }) => [
                      styles.serviceCard,
                      isSelected && styles.selectedServiceCard,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.serviceIconContainer}>
                      <MaterialCommunityIcons
                        name={service.icon}
                        size={27}
                        color="#C66BFF"
                      />
                    </View>

                    <View style={styles.serviceCopy}>
                      <Text style={styles.serviceLabel}>{service.label}</Text>
                      <Text style={styles.serviceDescription}>
                        {service.description}
                      </Text>
                    </View>

                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={26}
                      color={isSelected ? '#C66BFF' : '#666670'}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => void submitBusiness()}
            style={({ pressed }) => [
              styles.submitButton,
              (!canSubmit || pressed) && styles.submitButtonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Create Business Access</Text>
            )}
          </Pressable>

          <Text style={styles.approvalNote}>
            Your dashboard is available immediately. Public listings remain
            pending until FareShare approves the business.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  keyboardView: { flex: 1 },
  header: {
    height: 64,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    backgroundColor: '#151518',
    borderColor: '#34343A',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 44 },
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 50 },
  eyebrow: {
    color: '#C66BFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    color: '#A5A5AE',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: 'rgba(17, 17, 20, 0.94)',
    borderColor: '#2A2A31',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 26,
    padding: 20,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  sectionDescription: {
    color: '#9C9CA5',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  inputLabel: {
    color: '#D9D9DF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 18,
  },
  input: {
    minHeight: 52,
    backgroundColor: '#0D0D10',
    borderColor: '#35353D',
    borderRadius: 13,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 15,
  },
  descriptionInput: { minHeight: 112, paddingTop: 14 },
  cityRow: { flexDirection: 'row', gap: 12 },
  cityField: { flex: 1.3 },
  stateField: { flex: 1 },
  locationNote: {
    color: '#85858E',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  locationError: {
    color: '#FF9D9D',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  servicesSection: { marginTop: 30 },
  serviceList: { gap: 12, marginTop: 17 },
  serviceCard: {
    minHeight: 92,
    alignItems: 'center',
    backgroundColor: 'rgba(17, 17, 20, 0.94)',
    borderColor: '#35353D',
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  selectedServiceCard: {
    backgroundColor: 'rgba(167, 47, 255, 0.10)',
    borderColor: '#A72FFF',
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    backgroundColor: '#141218',
    borderColor: '#3D2B49',
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
  },
  serviceCopy: { flex: 1, marginHorizontal: 13 },
  serviceLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  serviceDescription: {
    color: '#9C9CA5',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  submitButton: {
    minHeight: 56,
    alignItems: 'center',
    backgroundColor: '#A72FFF',
    borderRadius: 15,
    justifyContent: 'center',
    marginTop: 28,
  },
  submitButtonDisabled: { opacity: 0.55 },
  submitButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  approvalNote: {
    color: '#85858E',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 15,
    textAlign: 'center',
  },
  pressed: { opacity: 0.72 },
});
