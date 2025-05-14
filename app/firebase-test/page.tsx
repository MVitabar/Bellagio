"use client"

import { useState } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

export default function FirebaseTestPage() {
  const { app, auth, db, isInitialized, error } = useFirebase()
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({
    app: null,
    auth: null,
    db: null,
  })

  const runTests = () => {
    setTestResults({
      app: !!app,
      auth: !!auth,
      db: !!db,
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Firebase Configuration Test</CardTitle>
          <CardDescription>Test your Firebase configuration to ensure everything is working correctly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Firebase Initialized:</span>
              {isInitialized ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            {testResults.app !== null && (
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <span>Firebase App:</span>
                  {testResults.app ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span>Firebase Auth:</span>
                  {testResults.auth ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span>Firebase Firestore:</span>
                  {testResults.db ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            )}

            {isInitialized && !error && (
              <div className="mt-4 text-sm">
                <p>
                  <strong>Firebase Config:</strong>
                </p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto mt-2">
                  {JSON.stringify(
                    {
                      apiKey: app?.options.apiKey ? "✓ Set" : "✗ Missing",
                      authDomain: app?.options.authDomain ? "✓ Set" : "✗ Missing",
                      projectId: app?.options.projectId ? "✓ Set" : "✗ Missing",
                      storageBucket: app?.options.storageBucket ? "✓ Set" : "✗ Missing",
                      messagingSenderId: app?.options.messagingSenderId ? "✓ Set" : "✗ Missing",
                      appId: app?.options.appId ? "✓ Set" : "✗ Missing",
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={runTests} className="w-full">
            Run Tests
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

