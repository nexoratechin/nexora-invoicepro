import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth';
import { colors } from '../src/theme';
import { Loading } from '../src/ui';

/**
 * Sends the user to the right group after the session resolves. The redirect
 * waits for status to leave loading, otherwise a refresh bounce would fight the
 * first render.
 */
function useAuthRedirect(): void {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'anonymous' && !inAuthGroup) {
      router.replace('/login');
    }

    if (status === 'authenticated' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router]);
}

function RootNavigator() {
  const { status } = useAuth();
  useAuthRedirect();

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontSize: 16, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.mist },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="invoices/[id]" options={{ title: 'Invoice' }} />
        <Stack.Screen name="invoices/new" options={{ title: 'New invoice' }} />
        <Stack.Screen name="customers/[id]" options={{ title: 'Customer' }} />
        <Stack.Screen name="customers/new" options={{ title: 'New customer' }} />
        <Stack.Screen name="products" options={{ title: 'Products' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>

      {status === 'loading' && (
        <View style={styles.overlay}>
          <Loading label="Restoring your session" />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
