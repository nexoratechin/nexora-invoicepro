import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { errorText } from '../../src/api';
import { useAuth } from '../../src/auth';
import { colors, spacing, type } from '../../src/theme';
import { Button, ErrorBanner, Screen, TextField } from '../../src/ui';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setFailure(null);
    setBusy(true);

    try {
      await login(email.trim(), password);
    } catch (error) {
      setFailure(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.trim() !== '' && password !== '' && !busy;

  return (
    <Screen>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <Text style={styles.markText}>N</Text>
        </View>
        <View>
          <Text style={styles.brandName}>Nexora InvoicePro</Text>
          <Text style={styles.brandTag}>Innovate | Automate | Transform</Text>
        </View>
      </View>

      <View style={styles.header}>
        <Text style={type.title}>Sign in</Text>
        <Text style={[type.muted, styles.subtitle]}>
          Your invoices and customers are where you left them.
        </Text>
      </View>

      {failure !== null && <ErrorBanner message={failure} />}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@company.in"
      />

      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        placeholder="Your password"
      />

      <Button
        label="Sign in"
        onPress={() => {
          void submit();
        }}
        loading={busy}
        disabled={!canSubmit}
      />

      <Pressable accessibilityRole="link" style={styles.linkRow}>
        <Link href="/register" style={styles.link}>
          New here? Create an account
        </Link>
      </Pressable>

      <View style={styles.demo}>
        <Text style={styles.demoTitle}>Demo account</Text>
        <Text style={[type.muted, styles.demoBody]}>
          After running the seed script, sign in with:
        </Text>
        <Text style={styles.demoValue}>demo@nexora.test</Text>
        <Text style={styles.demoValue}>nexora-demo-password</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: colors.cyan, fontSize: 22, fontWeight: '700' },
  brandName: { ...type.heading },
  brandTag: { fontSize: 11, color: colors.inkMuted },
  header: { marginTop: spacing.xl, gap: 4 },
  subtitle: { maxWidth: 300 },
  linkRow: { alignItems: 'center', paddingVertical: spacing.sm },
  link: { color: colors.blue, fontSize: 14, fontWeight: '600' },
  demo: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 2,
  },
  demoTitle: { ...type.label },
  demoBody: { marginBottom: 4 },
  demoValue: { fontFamily: 'monospace', fontSize: 13, color: colors.ink },
});
