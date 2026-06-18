import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus, Trash2, Loader2, Calculator as CalcIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  calculationsApi,
  CALCULATION_TYPE,
  type CalculationItem,
  type CalculationType,
} from "@/lib/api/calculations"
import { queryClient } from "@/lib/providers"
import { formatMoney } from "@/lib/format"

type Props = {
  customerId: number
}

const VAT = 1.15
const DEFAULT_YEARS = 3

export function CalculatorCard({ customerId }: Props) {
  const [years, setYears] = useState(DEFAULT_YEARS)

  const { data, isLoading } = useQuery({
    queryKey: ["calculations", customerId],
    queryFn: () => calculationsApi.list(customerId),
  })

  const items = data?.items ?? []

  const assets = items.filter(
    (i) => i.calculationItemTypeId === CALCULATION_TYPE.ASSET
  )
  const properties = items.filter(
    (i) => i.calculationItemTypeId === CALCULATION_TYPE.PROPERTY
  )
  const liabilities = items.filter(
    (i) => i.calculationItemTypeId === CALCULATION_TYPE.LIABILITY
  )

  const fees = useMemo(() => {
    const assetTotal = assets.reduce((s, i) => s + parseFloat(i.value || "0"), 0)
    const propertyTotal = properties.reduce(
      (s, i) => s + parseFloat(i.value || "0"),
      0
    )
    const liabilityTotal = liabilities.reduce(
      (s, i) => s + parseFloat(i.value || "0"),
      0
    )

    const estateValue = assetTotal + propertyTotal - liabilityTotal

    const executorFee = 0.035 * VAT * estateValue
    const conveyanceFee = 0.025 * VAT * propertyTotal
    const adminFee = 0.02 * estateValue + 0.01 * years * estateValue
    const totalFees = executorFee + conveyanceFee + adminFee

    return {
      assetTotal,
      propertyTotal,
      liabilityTotal,
      estateValue,
      executorFee,
      conveyanceFee,
      adminFee,
      totalFees,
    }
  }, [assets, properties, liabilities, years])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estate value calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground py-4">Loading…</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalcIcon className="h-4 w-4" />
              Estate value calculator
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Enter assets, properties, and liabilities. Fees calculate live.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Admin years:</label>
            <Input
              type="number"
              min={0}
              max={20}
              value={years}
              onChange={(e) => setYears(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 h-8 text-sm"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <ItemSection
          title="Assets"
          subtitle="Cash, vehicles, investments — anything that isn't real estate"
          items={assets}
          subtotal={fees.assetTotal}
          customerId={customerId}
          typeId={CALCULATION_TYPE.ASSET}
        />

        <ItemSection
          title="Properties"
          subtitle="Real estate. Counts toward both estate value and conveyance fees"
          items={properties}
          subtotal={fees.propertyTotal}
          customerId={customerId}
          typeId={CALCULATION_TYPE.PROPERTY}
        />

        <ItemSection
          title="Liabilities"
          subtitle="Bonds, debts — deducted from total estate value"
          items={liabilities}
          subtotal={fees.liabilityTotal}
          customerId={customerId}
          typeId={CALCULATION_TYPE.LIABILITY}
        />

        <Separator />

        <FeeSummary fees={fees} years={years} />
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
// Section with line items
// ─────────────────────────────────────────────────────────

function ItemSection({
  title,
  subtitle,
  items,
  subtotal,
  customerId,
  typeId,
}: {
  title: string
  subtitle: string
  items: CalculationItem[]
  subtotal: number
  customerId: number
  typeId: CalculationType
}) {
  const addMutation = useMutation({
    mutationFn: () =>
      calculationsApi.create({
        customerId,
        calculationItemTypeId: typeId,
        description: "",
        value: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculations", customerId] })
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-2">
          No items added.
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {items.map((item) => (
            <ItemRow
              key={`${item.id}:${item.description}:${item.value}`}
              item={item}
              customerId={customerId}
            />
          ))}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">
              Subtotal
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatMoney(subtotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Editable row with debounced save on blur
// ─────────────────────────────────────────────────────────

function ItemRow({
  item,
  customerId,
}: {
  item: CalculationItem
  customerId: number
}) {
  const [description, setDescription] = useState(item.description)
  const [value, setValue] = useState(item.value)

  const updateMutation = useMutation({
    mutationFn: (changes: { description?: string; value?: number }) =>
      calculationsApi.update(item.id, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculations", customerId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => calculationsApi.delete(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculations", customerId] })
    },
  })

  function saveDescription() {
    if (description !== item.description) {
      updateMutation.mutate({ description })
    }
  }

  function saveValue() {
    const num = parseFloat(value)
    if (!Number.isNaN(num) && String(num) !== item.value) {
      updateMutation.mutate({ value: num })
    }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 hover:bg-accent/30">
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={saveDescription}
        placeholder="Description (e.g. Primary residence)"
        className="flex-1 h-8 text-sm border-0 bg-transparent focus-visible:bg-background"
      />
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={saveValue}
        placeholder="0.00"
        className="w-36 h-8 text-sm tabular-nums text-right border-0 bg-transparent focus-visible:bg-background"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (confirm("Remove this item?")) deleteMutation.mutate()
        }}
        disabled={deleteMutation.isPending}
        className="h-8 w-8 p-0 flex-shrink-0"
      >
        {deleteMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Fee summary
// ─────────────────────────────────────────────────────────

function FeeSummary({
  fees,
  years,
}: {
  fees: {
    assetTotal: number
    propertyTotal: number
    liabilityTotal: number
    estateValue: number
    executorFee: number
    conveyanceFee: number
    adminFee: number
    totalFees: number
  }
  years: number
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Net estate value</span>
          <span className="text-xl font-bold tabular-nums">
            {formatMoney(fees.estateValue)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Assets ({formatMoney(fees.assetTotal)}) + Properties (
          {formatMoney(fees.propertyTotal)}) − Liabilities (
          {formatMoney(fees.liabilityTotal)})
        </p>
      </div>

      <div className="space-y-1.5 text-sm">
        <FeeLine
          label="Executor fee"
          formula="3.5% × 1.15 VAT × estate"
          value={fees.executorFee}
        />
        <FeeLine
          label="Conveyance fee"
          formula="2.5% × 1.15 VAT × properties"
          value={fees.conveyanceFee}
        />
        <FeeLine
          label="Admin fee"
          formula={`2% + (1% × ${years} yrs) × estate`}
          value={fees.adminFee}
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">Total fees</span>
        <span className="text-2xl font-bold tabular-nums">
          {formatMoney(fees.totalFees)}
        </span>
      </div>
    </div>
  )
}

function FeeLine({
  label,
  formula,
  value,
}: {
  label: string
  formula: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground ml-2">({formula})</span>
      </div>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  )
}
