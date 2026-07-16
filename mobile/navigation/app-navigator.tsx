import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SignInScreen from '../screens/sign-in-screen';
import SignUpScreen from '../screens/sign-up-screen';
import HomeScreen from '../screens/home-screen';
import CreateRideScreen from '../screens/create-ride-screen';
import AvailableRidesScreen from '../screens/available-rides-screen';
import RideDetailsScreen from '../screens/ride-details-screen';
import RideRequestsScreen from '../screens/ride-requests-screen';
import ProfileScreen from '../screens/profile-screen';

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  Home: undefined;
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
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="CreateRide" component={CreateRideScreen} />
        <Stack.Screen name="AvailableRides" component={AvailableRidesScreen} />
        <Stack.Screen name="RideDetails" component={RideDetailsScreen} />
        <Stack.Screen name="RideRequests" component={RideRequestsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}