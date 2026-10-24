import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  formatPaise,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '@nexora/shared';

import { api, errorText, type ApiCustomer, type ApiInvoice, type ApiPayment } from '../../src/api';
import { useAuth } from '../../src/auth';
import { StatusPill, formatDate, invoiceTitle } from '../../src/components';
import { colors, radius, spacing, type } from '../../src/theme';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Loading,
  Row,
  Screen,
  SectionTitle,
  useFetch,
} from '../../src/ui';

interface Detail {
  invoice: ApiInvoice;
  customer: ApiCustomer | null;
  payments: ApiPayment[];
}

function idempotencyKey(): string {
  return `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { data, error, loading, reload } = useFetch<Detail>(
    () => api<Detail>(`/invoices/${id}`),
    [id],
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [reason, setReason] = useState('');

  if (loading && data === null) {
    return (
      <Screen>
        <Loading label="Loading the invoice" />
      </Screen>
    );
  }

  if (error !== null || data === null) {
    return (
      <Screen>
        <ErrorBanner message={error ?? 'Invoice not found'} onRetry={reload} />
      </Screen>
    );
  }

  const { invoice, customer, payments } = data;
  const canManage = session?.role === 'owner' || session?.role === 'admin';

  async function post(path: string, body: unknown): Promise<void> {
    setBusy(true);
    setFailure(null);

    try {
      await api(`/invoices/${id}${path}`, { method: 'POST', body: JSON.stringify(body) });
      reload();
    } catch (cause) {
      setFailure(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function savePayment(): Promise<void> {
    const rupees = Number(amount.replace(',', '.'));

    if (!Number.isFinite(rupees) || rupees <= 0) {
      setFailure('Enter an amount greater than zero');

      return;
    }

    setBusy(true);
    setFailure(null);

    try {
      await api(`/invoices/${id}/payments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey() },
        body: JSON.stringify({
          amountMinor: Math.round(rupees * 100),
          paidAt: new Date().toISOString().slice(0, 10),
          method,
          reference: '',
          note: 'Recorded from the mobile app',
        }),
      });
      setPaymentOpen(false);
      setAmount('');
      reload();
    } catch (cause) {
      setFailure(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={type.title}>{invoice.invoiceNumber ?? 'Draft invoice'}</Text>
          <Text style={[type.muted, styles.subtitle]}>{invoiceTitle(invoice)}</Text>
        </View>
        <StatusPill
          status={invoice.status}
          paymentState={invoice.paymentState}
          overdue={invoice.overdue}
        />
      </View>

      {failure !== null && <ErrorBanner message={failure} />}

      {invoice.status === 'void' && (
        <Card>
          <Badge label="Void" tone="neutral" />
          <Text style={[type.muted, styles.gap]}>
            {invoice.voidReason ?? 'No reason recorded.'} It stays in the list but not in revenue.
          </Text>
        </Card>
      )}

      <Card>
        <SectionTitle>Summary</SectionTitle>
        <Row label="Subtotal" value={formatPaise(invoice.totals.subtotalMinor)} />
        <Row label="Taxable value" value={formatPaise(invoice.totals.taxableTotalMinor)} />
        {invoice.taxTreatment === 'intra' ? (
          <>
            <Row label="CGST" value={formatPaise(invoice.totals.cgstTotalMinor)} />
            <Row label="SGST" value={formatPaise(invoice.totals.sgstTotalMinor)} />
          </>
        ) : (
          <Row label="IGST" value={formatPaise(invoice.totals.igstTotalMinor)} />
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPaise(invoice.totals.totalMinor)}</Text>
        </View>
        <Row label="Paid" value={formatPaise(invoice.amountPaidMinor)} />
        <Row label="Balance due" value={formatPaise(invoice.balanceDueMinor)} />
      </Card>

      <Card>
        <SectionTitle>Details</SectionTitle>
        <Row label="Invoice date" value={formatDate(invoice.invoiceDate)} />
        <Row label="Due date" value={formatDate(invoice.dueDate)} />
        <Row label="Customer" value={customer?.name ?? 'Customer'} />
        <Row label="Place of supply" value={invoice.placeOfSupplyStateCode} />
      </Card>

      <Card>
        <SectionTitle>Items</SectionTitle>
        {invoice.lineItems.map((line) => (
          <View key={line.lineNo} style={styles.line}>
            <Text style={styles.lineTitle}>{line.description}</Text>
            <Text style={type.muted}>
              {line.quantityMilli / 1000} × {formatPaise(line.unitPriceMinor)} ·{' '}
              {line.taxRateBp / 100}% GST
            </Text>
            <Text style={styles.lineTotal}>{formatPaise(line.lineTotalMinor)}</Text>
          </View>
        ))}
      </Card>

      {invoice.status === 'draft' && (
        <Button
          label="Issue invoice"
          icon="send-outline"
          loading={busy}
          onPress={() => {
            void post('/issue', {});
          }}
        />
      )}

      {invoice.status === 'issued' && invoice.balanceDueMinor > 0 && (
        <Button
          label="Record a payment"
          icon="cash-outline"
          onPress={() => {
            setFailure(null);
            setAmount(String(invoice.balanceDueMinor / 100));
            setPaymentOpen(true);
          }}
        />
      )}

      {invoice.status === 'issued' && (
        <Button
          label="Duplicate"
          variant="secondary"
          icon="copy-outline"
          loading={busy}
          onPress={() => {
            void (async () => {
              try {
                const created = await api<{ invoice: ApiInvoice }>(`/invoices/${id}/duplicate`, {
                  method: 'POST',
                  body: '{}',
                });
                router.push(`/invoices/${created.invoice.id}`);
              } catch (cause) {
                setFailure(errorText(cause));
              }
            })();
          }}
        />
      )}

      {canManage && invoice.status === 'issued' && (
        <Button
          label="Void invoice"
          variant="ghost"
          icon="ban-outline"
          onPress={() => {
            setFailure(null);
            setReason('');
            setVoidOpen(true);
          }}
        />
      )}

      <SectionTitle>Payments</SectionTitle>
      <Card>
        {payments.length === 0 ? (
          <Text style={type.muted}>Nothing recorded yet.</Text>
        ) : (
          payments.map((payment) => (
            <Row
              key={payment.id}
              label={`${formatDate(payment.paidAt)} · ${PAYMENT_METHOD_LABELS[payment.method]}`}
              value={`${formatPaise(payment.amountMinor)}${payment.status === 'void' ? ' (void)' : ''}`}
            />
          ))
        )}
      </Card>

      <SectionTitle>History</SectionTitle>
      <Card>
        {(invoice.events ?? []).map((event, index) => (
          <View key={`${event.createdAt}-${String(index)}`} style={styles.event}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{event.message}</Text>
              <Text style={type.muted}>{formatDate(event.createdAt)}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Modal
        visible={paymentOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setPaymentOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={type.heading}>Record a payment</Text>
            <Text style={[type.muted, styles.gap]}>
              Balance due {formatPaise(invoice.balanceDueMinor)}. Part payments are fine.
            </Text>

            <Text style={styles.label}>Amount (INR)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={styles.input}
              accessibilityLabel="Payment amount"
            />

            <Text style={styles.label}>Method</Text>
            <View style={styles.methods}>
              {PAYMENT_METHODS.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: method === option }}
                  onPress={() => {
                    setMethod(option);
                  }}
                  style={[styles.method, method === option ? styles.methodActive : null]}
                >
                  <Text
                    style={[
                      styles.methodText,
                      { color: method === option ? colors.white : colors.inkMuted },
                    ]}
                  >
                    {PAYMENT_METHOD_LABELS[option]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setPaymentOpen(false);
                }}
              />
              <Button
                label="Save"
                loading={busy}
                onPress={() => {
                  void savePayment();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={voidOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setVoidOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={type.heading}>Void this invoice?</Text>
            <Text style={[type.muted, styles.gap]}>
              The number stays used. The invoice leaves revenue but stays in the list.
            </Text>

            <Text style={styles.label}>Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Raised against the wrong customer"
              placeholderTextColor="rgba(74,92,120,0.5)"
              style={styles.input}
              accessibilityLabel="Void reason"
            />

            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setVoidOpen(false);
                }}
              />
              <Button
                label="Void"
                variant="danger"
                loading={busy}
                disabled={reason.trim().length < 3}
                onPress={() => {
                  void post('/void', { reason: reason.trim() }).then(() => {
                    setVoidOpen(false);
                  });
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  subtitle: { marginTop: 2 },
  gap: { marginTop: spacing.sm },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  totalLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  totalValue: { fontSize: 20, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  line: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineTitle: { fontSize: 14, color: colors.ink },
  lineTotal: { fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  event: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cyan, marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,15,32,0.4)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  label: { ...type.label, marginTop: spacing.sm },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(10,27,53,0.15)',
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  method: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  methodActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  methodText: { fontSize: 12, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
