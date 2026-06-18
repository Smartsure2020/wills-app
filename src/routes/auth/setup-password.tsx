import { useState, useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { supabase } from "@/lib/supabase"
import { useSession } from "@/lib/providers"

export const Route = createFileRoute("/auth/setup-password")({
  component: SetupPasswordPage,
})

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Must be at least 8 characters")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type PasswordFormData = z.infer<typeof passwordSchema>

function SetupPasswordPage() {
  const navigate = useNavigate()
  const { session, isLoading } = useSession()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // If user arrives without a session, the invite link wasn't valid
  // (or they navigated here directly). Give them an explanation.
  const noSession = !isLoading && !session

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  async function onSubmit(data: PasswordFormData) {
    setSubmitting(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({
      password: data.password,
    })

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    // Brief pause so the success state is visible, then redirect
    setTimeout(() => navigate({ to: "/" }), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <KeyRound className="h-6 w-6" />
            Set your password
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center mt-1">
            {session?.user.email
              ? `Welcome, ${session.user.email}. Choose a password to finish setting up your account.`
              : "Setting up your account…"}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Verifying invite…
            </div>
          ) : noSession ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-amber-900">
                We couldn't verify your invite. The link may have expired or already been used.
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate({ to: "/login" })}
              >
                Back to sign in
              </Button>
            </div>
          ) : success ? (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <div className="font-medium">Password set</div>
              <div className="text-sm text-muted-foreground">
                Redirecting to your dashboard…
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Set password and continue"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}