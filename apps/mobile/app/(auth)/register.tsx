import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { errorText } from '../../src/api';
import { useAuth } from '../../src/auth';
import { type } from '../../src/theme';
import { Button, ErrorBanner, Screen, TextField } from '../../src/ui';
import { spacing } from '../../src/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    stateCode: '24',
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(): Promise<void> {
    setFailure(null);
    setBusy(true);

    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        businessName: form.businessName.trim(),
        stateCode: form.stateCode.trim(),
      });
    } catch (error) {
      setFailure(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.trim() !== '' &&
    form.password.length >= 10 &&
    form.businessName.trim().length >= 2 &&
    /^\d{2}$/.test(form.stateCode);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={type.title}>Create your account</Text>
        <Text style={[type.muted, styles.subtitle]}>
          One account, one business, ready to raise its first invoice.
        </Text>
      </View>

      {failure !== null && <ErrorBanner message={failure} />}

      <TextField
        label="Your name"
        value={form.name}
        onChangeText={(value) => {
          update('name', value);
        }}
        autoComplete="name"
        placeholder="Parth Prajapati"
      />

      <TextField
        label="Work email"
        value={form.email}
        onChangeText={(value) => {
          update('email', value);
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@company.in"
      />

      <TextField
        label="Password"
        value={form.password}
        onChangeText={(value) => {
          update('password', value);
        }}
        secureTextEntry
        autoComplete="new-password"
        hint="At least 10 characters."
      />

      <TextField
        label="Business name"
        value={form.businessName}
        onChangeText={(value) => {
          update('businessName', value);
        }}
        placeholder="Nexora Technologies"
      />

      <TextField
        label="GST state code"
        value={form.stateCode}
        onChangeText={(value) => {
          update('stateCode', value.replace(/[^0-9]/g, '').slice(0, 2));
        }}
        keyboardType="number-pad"
        hint="Two digits, for example 24 for Gujarat. Decides CGST against IGST."
      />

      <Button
        label="Create account"
        onPress={() => {
          void submit();
        }}
        loading={busy}
        disabled={!canSubmit}
      />

      <Link href="/login" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, gap: 4 },
  subtitle: { maxWidth: 300 },
  link: {
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
