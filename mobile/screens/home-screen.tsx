import { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import type { RootStackParamList } from '../navigation/app-navigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type IconName = ComponentProps<typeof Ionicons>['name'];

type IdTokenPayload = {
  given_name?: string;
  name?: string;
  email?: string;
  'cognito:username'?: string;
};

const CHECKER_TILES = Array.from({ length: 160 });
const ID_TOKEN_KEY = 'fareshare.idToken';

export default function HomeScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDisplayName() {
      try {
        const idToken = await SecureStore.getItemAsync(ID_TOKEN_KEY);

        if (!idToken) {
          return;
        }

        const payload = decodeIdToken(idToken);

        const name =
          payload?.given_name ??
          payload?.name?.split(' ')[0] ??
          payload?.email?.split('@')[0] ??
          payload?.['cognito:username'];

        if (isMounted && name) {
          setDisplayName(name);
        }
      } catch {
        // The Home screen can still render without a display name.
      }
    }

    loadDisplayName();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />

      <CheckerBackground />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetter}>F</Text>
              <Ionicons
                name="people"
                size={17}
                color="#A72FFF"
                style={styles.logoPeople}
              />
            </View>

            <Text style={styles.brandName}>FareShare</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              style={styles.headerButton}
            >
              <Ionicons
                name="notifications-outline"
                size={27}
                color="#FFFFFF"
              />
              <View style={styles.notificationDot} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons
                name="person"
                size={25}
                color="#8C8C96"
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>
            Welcome back{displayName ? `, ${displayName}` : ''}
          </Text>

          <Text style={styles.question}>Where are you headed?</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.searchBox,
            pressed && styles.pressedCard,
          ]}
          onPress={() => navigation.navigate('AvailableRides')}
        >
          <Ionicons
            name="search-outline"
            size={31}
            color="#A72FFF"
          />

          <Text style={styles.searchText}>
            Search a destination
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.rideAction,
            pressed && styles.pressedCard,
          ]}
          onPress={() => navigation.navigate('AvailableRides')}
        >
          <View style={styles.rideIconContainer}>
            <Ionicons
              name="car-sport-outline"
              size={29}
              color="#A72FFF"
            />
          </View>

          <Text style={styles.rideActionText}>Find a ride</Text>

          <Ionicons
            name="chevron-forward"
            size={27}
            color="#A72FFF"
          />
        </Pressable>

        <View style={styles.previousSection}>
          <Text style={styles.previousTitle}>Previous rides</Text>
          <Text style={styles.previousEmpty}>
            No previous rides yet
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomNavigation}>
        <NavItem
          icon="home-outline"
          label="Home"
          active
        />

        <NavItem
          icon="search-outline"
          label="Search"
          onPress={() => navigation.navigate('AvailableRides')}
        />

        <NavItem
          icon="car-sport-outline"
          label="Rides"
          onPress={() => navigation.navigate('RideRequests')}
        />

        <NavItem
          icon="chatbubble-ellipses-outline"
          label="Messages"
        />

        <NavItem
          icon="person-outline"
          label="Profile"
          onPress={() => navigation.navigate('Profile')}
        />
      </View>
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

function NavItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        pressed && styles.navItemPressed,
        !onPress && !active && styles.placeholderNavItem,
      ]}
    >
      {active ? <View style={styles.activeIndicator} /> : null}

      <Ionicons
        name={icon}
        size={27}
        color={active ? '#A72FFF' : '#A5A5AE'}
      />

      <Text
        style={[
          styles.navLabel,
          active && styles.activeNavLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function decodeIdToken(token: string): IdTokenPayload | null {
  try {
    const payloadSegment = token.split('.')[1];

    if (!payloadSegment) {
      return null;
    }

    const normalized = payloadSegment
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      '='
    );

    return JSON.parse(atob(padded)) as IdTokenPayload;
  } catch {
    return null;
  }
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 150,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoMark: {
    width: 52,
    height: 52,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    transform: [{ skewX: '-8deg' }],
  },
  logoLetter: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
  },
  logoPeople: {
    position: 'absolute',
    right: 3,
    bottom: 3,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A72FFF',
  },
  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#34343A',
    backgroundColor: '#151518',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingSection: {
    marginTop: 56,
    marginBottom: 30,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '800',
    marginBottom: 8,
  },
  question: {
    color: '#9C9CA5',
    fontSize: 18,
  },
  searchBox: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: '#414149',
    borderRadius: 19,
    backgroundColor: 'rgba(17, 17, 20, 0.92)',
    marginBottom: 20,
  },
  searchText: {
    color: '#A5A5AE',
    fontSize: 18,
    marginLeft: 17,
  },
  rideAction: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#414149',
    borderRadius: 19,
    backgroundColor: 'rgba(17, 17, 20, 0.92)',
  },
  rideIconContainer: {
    width: 57,
    height: 57,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#33333A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111114',
  },
  rideActionText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 18,
  },
  previousSection: {
    marginTop: 48,
  },
  previousTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 8,
  },
  previousEmpty: {
    color: '#8C8C96',
    fontSize: 17,
  },
  pressedCard: {
    opacity: 0.76,
  },
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    minHeight: 103,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 13,
    paddingBottom: 13,
    borderTopWidth: 1,
    borderColor: '#35353C',
    backgroundColor: 'rgba(5, 5, 7, 0.98)',
  },
  navItem: {
    flex: 1,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemPressed: {
    opacity: 0.65,
  },
  placeholderNavItem: {
    opacity: 0.65,
  },
  activeIndicator: {
    position: 'absolute',
    top: -13,
    width: 46,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#A72FFF',
  },
  navLabel: {
    color: '#A5A5AE',
    fontSize: 12,
    marginTop: 7,
  },
  activeNavLabel: {
    color: '#A72FFF',
    fontWeight: '700',
  },
});
