import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const createUser = functions.https.onCall(async (data: any, context: any) => {
  // Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Validate required fields
  if (
    !data.username ||
    !data.password ||
    !data.role
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required user data."
    );
  }

  // Validate username length
  if (data.username.length < 3) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Username must be at least 3 characters long"
    );
  }

  // Generate email
  const internalEmail = `${data.username.trim().replace(/\s+/g, '.').toLowerCase()}@company.com`;

  try {
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: internalEmail,
      password: data.password,
      displayName: data.username,
      emailVerified: true,
      disabled: false
    });

    // Save user in Firestore
    await admin.firestore()
      .doc(`users/${userRecord.uid}`)
      .set({
        uid: userRecord.uid,
        email: internalEmail,
        username: data.username,
        role: data.role,
        isInternalAccount: true,
        createdBy: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return { success: true, userId: userRecord.uid, email: internalEmail };
  } catch (error: any) {
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Error creating user"
    );
  }
});
