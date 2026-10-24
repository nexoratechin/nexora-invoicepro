import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { computeInvoice, formatPaise, parseRupeeAmount, resolveTaxTreatment } from '@nexora/shared';

import {
  api,
  errorText,
  type ApiCustomer,
  type ApiInvoice,
  type ApiProduct,
  type Page,
} from '../../src/api';
import { useAuth } from '../../src/auth';
import { SelectSheet } from '../../src/components';
import { colors, radius, spacing, type } from '../../src/theme';
import { Button, Card, Chip, ErrorBanner, Row, Screen, SectionTitle, useFetch } from '../../src/ui';

const TAX_RATES = [0, 500, 1200, 1800, 2800];

interface Line {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRateBp: number;
}

function blankLine(): Line {
  return {
    key: `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    description: '',
    quantity: '1',
    unitPrice: '',
    taxRateBp: 1800,
  };
}

function todayIso(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export default function NewInvoiceScreen() {
  const params = useLocalSearchParams<{ customerId?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [customerId, setCustomerId] = useState(params.customerId ?? '');
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'issue' | null>(null);
  const [customerSheet, setCustomerSheet] = useState(false);
  const [productSheet, setProductSheet] = useState(false);

  const customers = useFetch<Page<ApiCustomer>>(
    () => api<Page<ApiCustomer>>('/customers?pageSize=100&status=active'),
    [],
  );
  const products = useFetch<Page<ApiProduct>>(
    () => api<Page<ApiProduct>>('/products?pageSize=100&isActive=true'),
    [],
  );

  const customer = customers.data?.items.find((item) => item.id === customerId);
  const businessState = session?.business.stateCode ?? '24';
  const placeOfSupply =
    customer?.stateCode === '' || customer?.stateCode === undefined
      ? businessState
      : customer.stateCode;

  function updateLine(key: string, patch: Partial<Line>): void {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addProduct(product: ApiProduct): void {
    setLines((current) => [
      ...current.filter((line) => line.description !== '' || line.unitPrice !== ''),
      {
        key: `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        description: product.name,
        quantity: '1',
        unitPrice: String(product.unitPriceMinor / 100),
        taxRateBp: product.taxRateBp,
      },
    ]);
    setProductSheet(false);
  }

  const preview = (() => {
    try {
      const treatment = resolveTaxTreatment(businessState, placeOfSupply);
      const computed = computeInvoice(
        lines
          .filter((line) => line.description.trim() !== '' && line.unitPrice.trim() !== '')
          .map((line) => ({
            description: line.description,
            quantityMilli: Math.max(1, Math.round(Number(line.quantity) * 1000)),
            unitPriceMinor: parseRupeeAmount(line.unitPrice),
            taxRateBp: line.taxRateBp,
          })),
        treatment,
      );

      return { totals: computed.totals, taxTreatment: treatment };
    } catch {
      return null;
    }
  })();

  async function submit(mode: 'draft' | 'issue'): Promise<void> {
    setFailure(null);

    if (customerId === '') {
      setFailure('Choose a customer first');

      return;
    }

    const usable = lines.filter(
      (line) => line.description.trim() !== '' && line.unitPrice.trim() !== '',
    );

    if (usable.length === 0) {
      setFailure('Add at least one line with a description and a price');

      return;
    }

    setBusy(mode);

    try {
      const today = todayIso();
      const created = await api<{ invoice: ApiInvoice }>('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          invoiceDate: today,
          dueDate: addDays(today, session?.settings?.defaultPaymentTermsDays ?? 15),
          placeOfSupplyStateCode: placeOfSupply,
          notes,
          terms: '',
          lineItems: usable.map((line) => ({
            description: line.description,
            unitLabel: 'unit',
            quantityMilli: Math.max(1, Math.round(Number(line.quantity) * 1000)),
            unitPriceMinor: parseRupeeAmount(line.unitPrice),
            discountBp: 0,
            taxRateBp: line.taxRateBp,
          })),
        }),
      });

      if (mode === 'issue') {
        await api(`/invoices/${created.invoice.id}/issue`, { method: 'POST', body: '{}' });
      }

      router.replace(`/invoices/${created.invoice.id}`);
    } catch (cause) {
      setFailure(errorText(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      {failure !== null && <ErrorBanner message={failure} />}

      <Card>
        <SectionTitle>Customer</SectionTitle>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setCustomerSheet(true);
          }}
          style={styles.picker}
        >
          <Text style={customer === undefined ? styles.pickerPlaceholder : styles.pickerValue}>
            {customer?.name ?? 'Choose a customer'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.inkMuted} />
        </Pressable>
        <Row label="Place of supply" value={placeOfSupply} />
        <Text style={type.muted}>
          {preview?.taxTreatment === 'inter'
            ? 'Different state, so the whole rate is IGST.'
            : 'Same state, so the rate splits into CGST and SGST.'}
        </Text>
      </Card>

      <SectionTitle>Items</SectionTitle>

      {lines.map((line, index) => (
        <Card key={line.key}>
          <View style={styles.lineHeader}>
            <Text style={type.label}>Line {index + 1}</Text>
            {lines.length > 1 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setLines((current) => current.filter((item) => item.key !== line.key));
                }}
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            )}
          </View>

          <TextInput
            accessibilityLabel={`Description for line ${String(index + 1)}`}
            value={line.description}
            onChangeText={(value) => {
              updateLine(line.key, { description: value });
            }}
            placeholder="Website redesign"
            placeholderTextColor="rgba(74,92,120,0.5)"
            style={styles.input}
          />

          <View style={styles.pair}>
            <View style={styles.half}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                accessibilityLabel={`Quantity for line ${String(index + 1)}`}
                value={line.quantity}
                onChangeText={(value) => {
                  updateLine(line.key, { quantity: value.replace(/[^0-9.]/g, '') });
                }}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Unit price (INR)</Text>
              <TextInput
                accessibilityLabel={`Price for line ${String(index + 1)}`}
                value={line.unitPrice}
                onChangeText={(value) => {
                  updateLine(line.key, { unitPrice: value.replace(/[^0-9.]/g, '') });
                }}
                keyboardType="decimal-pad"
                placeholder="25000"
                placeholderTextColor="rgba(74,92,120,0.5)"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>GST rate</Text>
          <View style={styles.taxes}>
            {TAX_RATES.map((rate) => (
              <Chip
                key={rate}
                label={`${String(rate / 100)}%`}
                active={line.taxRateBp === rate}
                onPress={() => {
                  updateLine(line.key, { taxRateBp: rate });
                }}
              />
            ))}
          </View>
        </Card>
      ))}

      <Button
        label="Add from products"
        variant="secondary"
        icon="pricetags-outline"
        onPress={() => {
          setProductSheet(true);
        }}
      />

      <Button
        label="Add a blank line"
        variant="ghost"
        icon="add"
        onPress={() => {
          setLines((current) => [...current, blankLine()]);
        }}
      />

      <Card>
        <SectionTitle>Notes</SectionTitle>
        <TextInput
          accessibilityLabel="Invoice notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Thank you for your business."
          placeholderTextColor="rgba(74,92,120,0.5)"
          multiline
          style={[styles.input, styles.multiline]}
        />
      </Card>

      <Card>
        <SectionTitle>Totals</SectionTitle>
        {preview === null ? (
          <Text style={type.muted}>Add a description and a price to see the totals.</Text>
        ) : (
          <>
            <Row label="Subtotal" value={formatPaise(preview.totals.subtotalMinor)} />
            <Row label="Taxable value" value={formatPaise(preview.totals.taxableTotalMinor)} />
            {preview.taxTreatment === 'intra' ? (
              <>
                <Row label="CGST" value={formatPaise(preview.totals.cgstTotalMinor)} />
                <Row label="SGST" value={formatPaise(preview.totals.sgstTotalMinor)} />
              </>
            ) : (
              <Row label="IGST" value={formatPaise(preview.totals.igstTotalMinor)} />
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPaise(preview.totals.totalMinor)}</Text>
            </View>
          </>
        )}
      </Card>

      <Button
        label="Issue invoice"
        icon="send-outline"
        loading={busy === 'issue'}
        disabled={busy !== null}
        onPress={() => {
          void submit('issue');
        }}
      />
      <Button
        label="Save as draft"
        variant="secondary"
        loading={busy === 'draft'}
        disabled={busy !== null}
        onPress={() => {
          void submit('draft');
        }}
      />

      <SelectSheet
        visible={customerSheet}
        title="Choose a customer"
        items={customers.data?.items ?? []}
        keyOf={(item) => item.id}
        labelOf={(item) => item.name}
        emptyLabel="No active customers. Add one from the Customers tab."
        onClose={() => {
          setCustomerSheet(false);
        }}
        onSelect={(item) => {
          setCustomerId(item.id);
          setCustomerSheet(false);
        }}
      />

      <SelectSheet
        visible={productSheet}
        title="Add from products"
        items={products.data?.items ?? []}
        keyOf={(item) => item.id}
        labelOf={(item) => `${item.name} · ${formatPaise(item.unitPriceMinor)}`}
        emptyLabel="No active products yet."
        onClose={() => {
          setProductSheet(false);
        }}
        onSelect={addProduct}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(10,27,53,0.15)',
    paddingHorizontal: spacing.md,
  },
  pickerValue: { fontSize: 15, color: colors.ink },
  pickerPlaceholder: { fontSize: 15, color: 'rgba(74,92,120,0.7)' },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remove: { fontSize: 12, fontWeight: '600', color: colors.danger },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(10,27,53,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  pair: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1, gap: 4 },
  label: { ...type.label, marginTop: 2 },
  taxes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
});
