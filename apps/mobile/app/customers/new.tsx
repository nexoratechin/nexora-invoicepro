import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { api, errorText, type ApiCustomer } from '../../src/api';
import { spacing, type } from '../../src/theme';
import { Button, Card, ErrorBanner, Screen, TextField } from '../../src/ui';
import { GST_STATE_CODES } from '@nexora/shared';

export default function NewCustomerScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    stateCode: '',
    city: '',
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
      const created = await api<{ customer: ApiCustomer }>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          gstin: form.gstin.trim().toUpperCase(),
          stateCode: form.stateCode,
          notes: '',
          billingAddress: {
            line1: '',
            line2: '',
            city: form.city.trim(),
            state: '',
            pincode: '',
            country: 'India',
          },
        }),
      });

      router.replace(`/customers/${created.customer.id}`);
    } catch (cause) {
      setFailure(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  const stateName = GST_STATE_CODES[form.stateCode as keyof typeof GST_STATE_CODES];

  return (
    <Screen>
      {failure !== null && <ErrorBanner message={failure} />}

      <Card>
        <TextField
          label="Name"
          value={form.name}
          onChangeText={(value) => {
            update('name', value);
          }}
          placeholder="Acme Traders"
        />

        <TextField
          label="Email"
          value={form.email}
          onChangeText={(value) => {
            update('email', value);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="billing@acme.in"
        />

        <TextField
          label="Phone"
          value={form.phone}
          onChangeText={(value) => {
            update('phone', value);
          }}
          keyboardType="phone-pad"
          placeholder="+91 98765 43210"
        />

        <TextField
          label="GSTIN"
          value={form.gstin}
          onChangeText={(value) => {
            update('gstin', value.toUpperCase());
          }}
          autoCapitalize="characters"
          placeholder="24AAAAA0000A1Z5"
          hint="Optional. Needed for their input credit."
        />

        <TextField
          label="GST state code"
          value={form.stateCode}
          onChangeText={(value) => {
            update('stateCode', value.replace(/[^0-9]/g, '').slice(0, 2));
          }}
          keyboardType="number-pad"
          placeholder="24"
          hint={
            form.stateCode === ''
              ? 'Leave blank to use your business state.'
              : (stateName ?? 'That code is not in the GST state list')
          }
        />

        <TextField
          label="City"
          value={form.city}
          onChangeText={(value) => {
            update('city', value);
          }}
          placeholder="Mumbai"
        />
      </Card>

      <Button
        label="Add customer"
        loading={busy}
        disabled={form.name.trim().length < 2 || busy}
        onPress={() => {
          void submit();
        }}
      />

      <Text style={styles.footer}>Only the name is required. You can fill the rest in later.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { ...type.muted, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
});
