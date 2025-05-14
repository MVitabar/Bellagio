"use client"

import { useFirebase } from "./firebase-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"

export function FirebaseError() {
  const { error } = useFirebase()

  if (!error) return null

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Firebase Error</AlertTitle>
          <AlertDescription>
            There was a problem connecting to our services. This might be due to:
            <ul className="list-disc pl-5 mt-2">
              <li>Network connectivity issues</li>
              <li>Temporary service disruption</li>
              <li>Configuration problems</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Technical details: {error.message}</p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Page
          </Button>
        </div>
      </div>
    </div>
  )
}

