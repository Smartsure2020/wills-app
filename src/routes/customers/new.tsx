import { useState, useEffect } from "react"
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useForm, useFieldArray, useWatch, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Plus, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDropdowns } from "@/lib/providers"
import { customersApi } from "@/lib/api/customers"
import { accountsApi } from "@/lib/api/accounts"
import { extractDateOfBirthFromSaId } from "@/lib/sa-id"
import { queryClient } from "@/lib/providers"

export const Route = createFileRoute("/customers/new")({
  component: AddCustomerPage,
})

// ─────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────

const relationSchema = z.object({
  relationTypeId: z.coerce.number().int().min(1, "Required"),
  title: z.string().max(10),
  firstName: z.string().min(1, "Required").max(100),
  lastName: z.string().min(1, "Required").max(100),
  email: z.string().email("Valid email").or(z.literal("")),
  contactNumber: z.string().max(50),
})

const customerSchema = z.object({
  assignedTo: z.string().uuid("Please select a broker"),
  title: z.string().max(10),
  firstName: z.string().min(1, "Required").max(100),
  lastName: z.string().min(1, "Required").max(100),
  idNumber: z.string().min(13, "SA ID must be 13 digits").max(13),
  dateOfBirth: z.string().min(1, "Required"),
  email: z.string().email("Valid email required"),
  contactNumber: z.string().max(50),
  countryId: z.coerce.number().int().min(1, "Required"),
  maritalStatusId: z.coerce.number().int().min(1, "Required"),
  wishesId: z.coerce.number().int().min(1, "Required"),
  occupation: z.string().max(255),
  highestEducation: z.string().max(100),
  monthlyIncome: z.coerce.number().min(0, "Must be 0 or more"),
  isSmoker: z.boolean(),
  registeredDonor: z.boolean(),
  willDonate: z.boolean(),
  relations: z.array(relationSchema),
})

type CustomerFormData = z.infer<typeof customerSchema>

const defaultValues: CustomerFormData = {
  assignedTo: "",
  title: "Mr",
  firstName: "",
  lastName: "",
  idNumber: "",
  dateOfBirth: "",
  email: "",
  contactNumber: "",
  countryId: 160,
  maritalStatusId: 0,
  wishesId: 0,
  occupation: "",
  highestEducation: "",
  monthlyIncome: 0,
  isSmoker: false,
  registeredDonor: false,
  willDonate: false,
  relations: [],
}

const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Prof"]

// Fields validated for each step before proceeding
const STEP_1_FIELDS: (keyof CustomerFormData)[] = [
  "assignedTo",
  "title",
  "firstName",
  "lastName",
  "idNumber",
  "dateOfBirth",
  "email",
  "contactNumber",
  "countryId",
  "maritalStatusId",
  "wishesId",
  "occupation",
  "highestEducation",
  "monthlyIncome",
]

// ─────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────

function AddCustomerPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const navigate = useNavigate()

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues,
    mode: "onTouched",
  })

  // Watch idNumber and auto-fill dateOfBirth when 13 digits entered
  const idNumber = useWatch({ control: form.control, name: "idNumber" })
  useEffect(() => {
    if (idNumber && idNumber.length >= 6) {
      const dob = extractDateOfBirthFromSaId(idNumber)
      if (dob) form.setValue("dateOfBirth", dob, { shouldValidate: true })
    }
  }, [idNumber, form])

  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      navigate({ to: "/customers/$customerId", params: { customerId: String(data.id) } })
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : "Unknown error")
    },
  })

  async function handleNext() {
    const valid = await form.trigger(STEP_1_FIELDS)
    if (valid) setStep(2)
  }

  function onSubmit(data: CustomerFormData) {
    setSubmitError(null)
    createMutation.mutate(data)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/customers">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to customers
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add a customer</h1>
        <p className="text-muted-foreground mt-1">
          Step {step} of 2 ·{" "}
          {step === 1 ? "Customer details" : "Relations and submit"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 ? <Step1 control={form.control} /> : <Step2 control={form.control} />}

          {submitError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="flex justify-between pt-2">
            {step === 2 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={createMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step === 1 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create customer"
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Step 1 — Customer details
// ─────────────────────────────────────────────────────────

function Step1({ control }: { control: Control<CustomerFormData> }) {
  const dropdowns = useDropdowns()

  // Fetch brokers for the assignment select
  const { data: brokersData } = useQuery({
    queryKey: ["accounts", { accountTypeId: 2, pageSize: 100 }],
    queryFn: () => accountsApi.list({ accountTypeId: 2, pageSize: 100 }),
  })
  const brokers = brokersData?.items ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="assignedTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Broker</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a broker" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {brokers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.firstName} {b.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TITLES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="firstName"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>First name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="idNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SA ID number</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={13} placeholder="13 digits" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of birth</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="contactNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact number</FormLabel>
                <FormControl><Input type="tel" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DropdownField
              control={control}
              name="countryId"
              label="Country"
              options={dropdowns.countries}
            />
            <DropdownField
              control={control}
              name="maritalStatusId"
              label="Marital status"
              options={dropdowns.maritalStatuses}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="highestEducation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Highest education</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name="monthlyIncome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly income (ZAR)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifestyle and wishes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DropdownField
            control={control}
            name="wishesId"
            label="Wishes"
            options={dropdowns.wishes}
          />

          <Separator />

          <div className="space-y-3">
            <CheckboxField control={control} name="isSmoker" label="Smoker" />
            <CheckboxField
              control={control}
              name="registeredDonor"
              label="Registered organ donor"
            />
            <CheckboxField
              control={control}
              name="willDonate"
              label="Willing to donate"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Step 2 — Relations
// ─────────────────────────────────────────────────────────

function Step2({ control }: { control: Control<CustomerFormData> }) {
  const dropdowns = useDropdowns()
  const { fields, append, remove } = useFieldArray({ control, name: "relations" })

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">Relations</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Family members, beneficiaries, executors, witnesses.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              relationTypeId: 0,
              title: "Mr",
              firstName: "",
              lastName: "",
              email: "",
              contactNumber: "",
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Add relation
        </Button>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
            No relations added. You can add them now or later from the customer profile.
          </div>
        ) : (
          <div className="space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-md p-4 space-y-4 relative">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Relation {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DropdownField
                    control={control}
                    name={`relations.${index}.relationTypeId`}
                    label="Relation type"
                    options={dropdowns.relationTypes}
                  />
                  <FormField
                    control={control}
                    name={`relations.${index}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TITLES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name={`relations.${index}.firstName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`relations.${index}.lastName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name={`relations.${index}.email`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (optional)</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`relations.${index}.contactNumber`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact number (optional)</FormLabel>
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
// Reusable field helpers
// ─────────────────────────────────────────────────────────

type FieldName =
  | keyof CustomerFormData
  | `relations.${number}.${keyof CustomerFormData["relations"][number]}`

function DropdownField({
  control,
  name,
  label,
  options,
}: {
  control: Control<CustomerFormData>
  name: any
  label: string
  options: { id: number; description: string }[]
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            onValueChange={(v) => field.onChange(Number(v))}
            value={field.value ? String(field.value) : undefined}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.id} value={String(opt.id)}>
                  {opt.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CheckboxField({
  control,
  name,
  label,
}: {
  control: Control<CustomerFormData>
  name: "isSmoker" | "registeredDonor" | "willDonate"
  label: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-3 space-y-0">
          <FormControl>
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
          <FormLabel className="text-sm font-normal cursor-pointer">
            {label}
          </FormLabel>
        </FormItem>
      )}
    />
  )
}