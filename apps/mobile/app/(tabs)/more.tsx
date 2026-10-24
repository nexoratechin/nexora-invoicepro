import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../src/auth';
import { colors, spacing, type } from '../../src/theme';
import { Button, Card, Row, Screen, SectionTitle } from '../../src/ui';

const links = [
  { href: '/products', label: 'Products and services', icon: 'pricetags-outline' },
  { href: '/settings', label: 'Business settings', icon: 'settings-outline' },
] as const;

export default function MoreScreen() {
  const { session, logout } = useAuth();
  const router = useRouter();

  return (
    <Screen>
      <View>
        <Text style={type.title}>More</Text>
        <Text style={[type.muted, styles.subtitle]}>Account, catalogue and business details.</Text>
      </View>

      <Card>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {session?.user.name
                .split(' ')
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? '')
                .join('') ?? '?'}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={type.heading}>{session?.user.name ?? 'Signed in'}</Text>
            <Text style={type.muted}>{session?.user.email}</Text>
          </View>
          <Text style={styles.role}>{session?.role ?? ''}</Text>
        </View>
      </Card>

      <SectionTitle>Business</SectionTitle>
      <Card>
        <Row label="Name" value={session?.business.name ?? '-'} />
        <Row
          label="GSTIN"
          value={session?.business.gstin === '' ? 'Not set' : (session?.business.gstin ?? '-')}
        />
        <Row label="Invoice prefix" value={session?.settings?.invoicePrefix ?? 'NXP'} />
      </Card>

      <View style={styles.links}>
        {links.map((link) => (
          <Pressable
            key={link.href}
            accessibilityRole="button"
            onPress={() => {
              router.push(link.href);
            }}
            style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
          >
            <Ionicons name={link.icon} size={18} color={colors.blue} />
            <Text style={styles.linkText}>{link.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
          </Pressable>
        ))}
      </View>

      <Button
        label="Sign out"
        variant="secondary"
        icon="log-out-outline"
        onPress={() => {
          void logout();
        }}
      />

      <Text style={styles.footer}>
        Nexora InvoicePro · Tax figures are software calculations, not tax advice.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '700' },
  identityText: { flex: 1, gap: 2 },
  role: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.blue,
    textTransform: 'capitalize',
  },
  links: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkPressed: { backgroundColor: 'rgba(10,27,53,0.03)' },
  linkText: { flex: 1, fontSize: 14, color: colors.ink },
  footer: { ...type.muted, textAlign: 'center', fontSize: 11, marginTop: spacing.sm },
});
