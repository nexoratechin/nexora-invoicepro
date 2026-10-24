import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatPaise,
  invoiceDisplayStatus,
  type InvoiceStatus,
  type PaymentState,
} from '@nexora/shared';

import type { ApiInvoice } from './api';
import { colors, radius, spacing, type } from './theme';
import { Badge } from './ui';

const labels = {
  draft: 'Draft',
  void: 'Void',
  paid: 'Paid',
  overdue: 'Overdue',
  partial: 'Part paid',
  unpaid: 'Unpaid',
} as const;

const tones = {
  draft: 'neutral',
  void: 'neutral',
  paid: 'green',
  overdue: 'red',
  partial: 'blue',
  unpaid: 'amber',
} as const;

export function StatusPill({
  status,
  paymentState,
  overdue,
}: {
  status: InvoiceStatus;
  paymentState: PaymentState;
  overdue: boolean;
}) {
  const display = invoiceDisplayStatus(status, paymentState, overdue);

  return <Badge label={labels[display]} tone={tones[display]} />;
}

export function invoiceTitle(invoice: ApiInvoice): string {
  const name =
    typeof invoice.customerId === 'string'
      ? (invoice.customerSnapshot?.name ?? 'Customer')
      : (invoice.customerId.name ?? invoice.customerSnapshot?.name ?? 'Customer');

  return `${invoice.invoiceNumber ?? 'Draft'} · ${name}`;
}

export function InvoiceRow({ invoice, onPress }: { invoice: ApiInvoice; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowMain}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {invoiceTitle(invoice)}
        </Text>
        <Text style={styles.rowMeta}>
          {formatDate(invoice.invoiceDate)} · due {formatDate(invoice.dueDate)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.amount}>{formatPaise(invoice.totals.totalMinor)}</Text>
        <StatusPill
          status={invoice.status}
          paymentState={invoice.paymentState}
          overdue={invoice.overdue}
        />
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
    </Pressable>
  );
}

export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set';
  }

  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);

  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function SelectSheet<T>({
  visible,
  title,
  items,
  labelOf,
  keyOf,
  onSelect,
  onClose,
  emptyLabel = 'Nothing to choose from',
}: {
  visible: boolean;
  title: string;
  items: T[];
  labelOf: (item: T) => string;
  keyOf: (item: T) => string;
  onSelect: (item: T) => void;
  onClose: () => void;
  emptyLabel?: string;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={type.heading}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.inkMuted} />
            </Pressable>
          </View>

          {items.length === 0 ? (
            <Text style={[type.muted, styles.sheetEmpty]}>{emptyLabel}</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={keyOf}
              contentContainerStyle={styles.sheetList}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onSelect(item);
                  }}
                  style={({ pressed }) => [styles.sheetItem, pressed && styles.rowPressed]}
                >
                  <Text style={styles.sheetItemText}>{labelOf(item)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  rowPressed: { backgroundColor: 'rgba(10,27,53,0.03)' },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '500', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.inkMuted },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(5,15,32,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '75%',
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetList: { paddingVertical: spacing.sm },
  sheetEmpty: { padding: spacing.lg, textAlign: 'center' },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sheetItemText: { fontSize: 15, color: colors.ink },
});
