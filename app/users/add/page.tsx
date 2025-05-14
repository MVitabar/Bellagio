"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import {toast} from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserRole } from "@/types/user"
import { useNotifications } from "@/hooks/useNotifications"
import { useEffect } from "react"
import { collection, addDoc } from 'firebase/firestore';
import { useFirebase } from "@/components/firebase-provider";

export default function AddTeamMemberPage() {
  const [formData, setFormData] = useState({
    username: "",
    role: UserRole.WAITER
  });
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invitationLink, setInvitationLink] = useState<string>('');

  const { user } = useAuth()
  const { db } = useFirebase(); 
  const { sendNotification } = useNotifications();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    
    // Clear any existing errors for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.username.trim()) {
      newErrors.username = "Username is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    if (!user || !db) { 
      toast.error("You must be logged in to add a team member");
      return;
    }

    setLoading(true);

    try {
      // Create a new invitation document in Firestore
      const invitationData = {
        email: generatedEmail,
        username: formData.username,
        role: formData.role,
        createdBy: user.uid,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        status: 'pending'
      };

      const invitationRef = await addDoc(collection(db, 'invitations'), invitationData);
      
      // Generate invitation link with document ID
      const invitationLink = `${window.location.origin}/invitation/register?id=${invitationRef.id}`;
      setInvitationLink(invitationLink);

      toast.success("Invitation generated successfully");
      await sendNotification({
        title: "New invitation created",
        message: `An invitation was generated for ${formData.username}`,
        url: window.location.href,
      });
      
      // Clear the form
      setFormData({
        username: "",
        role: UserRole.WAITER
      });
      setGeneratedEmail('');
      
    } catch (error: any) {
      console.error("Error generating invitation:", error);
      toast.error("Error generating invitation");
    } finally {
      setLoading(false);
    }
}

  useEffect(() => {
    // Generate a generic email based on username
    const sanitizedUsername = formData.username.trim().replace(/\s+/g, '.').toLowerCase();
    setGeneratedEmail(`${sanitizedUsername}@company.com`);
  }, [formData.username]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedEmail);
    toast.success('Email copied to clipboard');
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader>
          <CardTitle>Add Team Member</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
                className={errors.username ? "border-red-500" : ""}
              />
              {errors.username && <p className="text-red-500 text-sm">{errors.username}</p>}
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                className="w-full p-2 border rounded"
                disabled={loading}
              >
                {Object.values(UserRole).map(role => (
                  <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Generating..." : "Generate Invitation"}
            </Button>
          </form>

          {/* Show invitation link if it exists */}
          {invitationLink && (
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
              <div className="flex flex-col gap-2">
                <span className="font-medium">Invitation Link:</span>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={invitationLink}
                    readOnly
                    className="flex-1 p-2 border rounded mr-2"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(invitationLink);
                      toast.success('Link copied to clipboard');
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This link will expire in 24 hours
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}