import { useState } from "react"
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { accountsApi } from "@/lib/api/accounts"
import { queryClient } from "@/lib/providers"

export const Route = createFileRoute("/brokers/new")({
  component: AddBrokerPage,
})

const BROKER_TYPE_ID = 2

const brokerSchema = z.object({
  firstName: z.string().min(1, "Required").max(100),
  lastName: z.string().min(1, "Required").max(100),
  email: z.string().email("Valid email required"),
  contactNumber: z.string().max(50),
  manageAll: z.boolean(),
})

type BrokerFormData = z.infer<typeof brokerSchema>

function AddBrokerPage() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const navigate = useNavigate()

  const form = useForm<BrokerFormData>({
    resolver: zodResolver(brokerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      contactNumber: "",
      manageAll: false,
    },
    mode: "onTouched",
  })

  const createMutation = useMutation({
    mutationFn: (data: BrokerFormData) =>
      accountsApi.create({
        accountTypeId: BROKER_TYPE_ID,
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      navigate({ to: "/brokers" })
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : "Unknown error")
    },
  })

  function onSubmit(data: BrokerFormData) {
    setSubmitError(null)
    createMutation.mutate(data)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/brokers">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to brokers
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add a broker</h1>
        <p className="text-muted-foreground mt-1">
          New brokers won't be able to log in until auth is wired up in a later phase.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
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
                control={form.control}
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
              <CardTitle className="text-base">Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="manageAll"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-sm cursor-pointer">
                        Manage all customers
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        When enabled, this broker can see and edit every customer in the
                        business, not just their assigned ones. Treat as an admin
                        permission.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {submitError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button asChild variant="outline" type="button">
              <Link to="/brokers">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create broker"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}