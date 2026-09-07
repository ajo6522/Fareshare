import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SignInScreen from '../screens/sign-in-screen';
import PreferredNameScreen from '../screens/preferred-name-screen';
import HomeScreen from '../screens/home-screen';
import ServiceProviderHomeScreen from '../screens/service-provider-home-screen';
import ServiceLocationScreen from '../screens/service-location-screen';
import ServiceCategoryScreen from '../screens/service-category-screen';
import ServiceResultsScreen from '../screens/service-results-screen';
import CreateRideScreen from '../screens/create-ride-screen';
import AvailableRidesScreen from '../screens/available-rides-screen';
import RideDetailsScreen from '../screens/ride-details-screen';
import RideRequestsScreen from '../screens/ride-requests-screen';
import ProfileScreen from '../screens/profile-screen';

export type ServiceType =
  | 'airport_shuttle'
  | 'local_transportation'
  | 'cleaning_services'
  | 'junk_removal'
  | 'landscaping';

export type RootStackParamList = {
  SignIn: undefined;
  PreferredName: undefined;
  Home: undefined;
  ProviderHome: undefined;
  ServiceLocation: undefined;
  ServiceCategory: { zipCode: string };
  ServiceResults: {
    zipCode: string;
    serviceType: ServiceType;
    serviceLabel: string;
  };
  CreateRide: undefined;
  AvailableRides: undefined;
  RideDetails: undefined;
  RideRequests: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="SignIn">
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="PreferredName"
          component={PreferredNameScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />

        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ProviderHome"
          component={ServiceProviderHomeScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ServiceLocation"
          component={ServiceLocationScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ServiceCategory"
          component={ServiceCategoryScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ServiceResults"
          component={ServiceResultsScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen name="CreateRide" component={CreateRideScreen} />
        <Stack.Screen
          name="AvailableRides"
          component={AvailableRidesScreen}
        />
        <Stack.Screen name="RideDetails" component={RideDetailsScreen} />
        <Stack.Screen name="RideRequests" component={RideRequestsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
