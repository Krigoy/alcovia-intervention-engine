import React from "react";
import { Slot } from "expo-router";
import { ClerkProvider } from "@clerk/clerk-expo";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SafeAreaView style={{ flex: 1 }}>
        <Slot />
      </SafeAreaView>
    </ClerkProvider>
  );
}
