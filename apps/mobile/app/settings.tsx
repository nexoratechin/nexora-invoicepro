import { StyleSheet, Text } from 'react-native';

import { useAuth } from '../src/auth';
import { GST_STATE_CODES } from '@nexora/shared';
import { spacing, type } from '../src/theme';
import { Card, Row, Screen, SectionTitle } from '../src/ui';

export default function SettingsScreen() {
  const { session } = useAuth();
  const business = session?.business;
  const settings = session?.settings;
  const stateName =
    business === undefined
      ? ''
      : (GST_STATE_CODES[business.stateCode as keyof typeof GST_STATE_CODES] ?? business.stateCode);
  const address =
    business === undefined
      ? ''
      : [
          business.address.line1,
          business.address.city,
          business.address.state,
          business.address.pincode,
        ]
          .filter((part) => part !== '')
          .join(', ');

  return (
    <Screen>
      <Card>
        <SectionTitle>Business</SectionTitle>
        <Row label="Name" value={business?.name ?? '-'} />
        <Row
          label="GSTIN"
          value={business?.gstin === '' || business === undefined ? 'Not set' : business.gstin}
        />
        <Row label="State" value={stateName} />
        <Row label="Address" value={address === '' ? '-' : address} />
        <Row label="Phone" value={business?.phone === '' ? '-' : (business?.phone ?? '-')} />
        <Row label="Email" value={business?.email === '' ? '-' : (business?.email ?? '-')} />
      </Card>

      <Card>
        <SectionTitle>Invoice defaults</SectionTitle>
        <Row label="Prefix" value={settings?.invoicePrefix ?? 'NXP'} />
        <Row
          label="Payment terms"
          value={`${String(settings?.defaultPaymentTermsDays ?? 15)} days`}
        />
        <Row label="Default GST" value={`${String((settings?.defaultTaxRateBp ?? 1800) / 100)}%`} />
        <Row
          label="UPI"
          value={settings?.bankDetails.upiId === '' ? '-' : (settings?.bankDetails.upiId ?? '-')}
        />
        <Row
          label="Bank account"
          value={
            settings?.bankDetails.accountNumber === ''
              ? '-'
              : `${settings?.bankDetails.bankName ?? ''} · ${settings?.bankDetails.accountNumber ?? ''}`
          }
        />
      </Card>

      <Card>
        <SectionTitle>Your profile</SectionTitle>
        <Row label="Name" value={session?.user.name ?? '-'} />
        <Row label="Email" value={session?.user.email ?? '-'} />
        <Row label="Role" value={session?.role ?? '-'} />
      </Card>

      <Text style={styles.footer}>
        Editing business details happens in the web app for now. This screen reads the session you
        are signed in with.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { ...type.muted, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
});
