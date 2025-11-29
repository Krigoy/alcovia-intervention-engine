import React, { useState } from "react";
import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-expo";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  Image,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Slot } from "expo-router";
import Sidebar from "../components/Sidebar";

WebBrowser.maybeCompleteAuthSession();

function AvatarMenuInLayout() {
  const { signOut, isLoaded } = useAuth() as any;
  const { user } = useUser() as any;
  const [open, setOpen] = useState(false);
  const displayName = (user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "User") as string;
  const avatar = user?.profileImageUrl;
  const doSignOut = async () => {
    setOpen(false);
    try {
      if (isLoaded && typeof signOut === "function") await signOut();
    } catch (e) {
      console.warn(e);
    }
  };
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.bottomAvatarBtn}
        accessibilityLabel="Open user menu"
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.bottomAvatarImg} />
        ) : (
          <Text style={styles.bottomAvatarInitial}>
            {String(displayName || "U")
              .charAt(0)
              .toUpperCase()}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuName}>{displayName}</Text>
            <TouchableOpacity style={styles.menuItem} onPress={doSignOut}>
              <Text style={styles.menuItemText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function TopRightSignIn({ hostedSignInUrl }: { hostedSignInUrl: string }) {
  const { isSignedIn } = useAuth() as any;
  const [opening, setOpening] = useState(false);
  const openHostedSignIn = async () => {
    if (!hostedSignInUrl) return;
    setOpening(true);
    try {
      const redirectUrl = Linking.createURL("/callback");
      await WebBrowser.openAuthSessionAsync(hostedSignInUrl, redirectUrl);
    } catch (e) {
      console.warn(e);
    } finally {
      setOpening(false);
    }
  };
  return (
    <View pointerEvents="box-none" style={styles.topRightContainer}>
      {!isSignedIn ? (
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={openHostedSignIn}
          disabled={opening}
        >
          <Text style={styles.loginText}>
            {opening ? "Opening..." : "Sign In"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const hostedSignInUrl = process.env.EXPO_PUBLIC_CLERK_SIGNIN_URL || "";
  if (!publishableKey || !hostedSignInUrl) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorTitle}>Missing environment variables</Text>
        <Text style={styles.errorText}>
          Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and EXPO_PUBLIC_CLERK_SIGNIN_URL
          in your environment and restart.
        </Text>
      </SafeAreaView>
    );
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SafeAreaView style={styles.safe}>
        <Sidebar />
        <View style={styles.main}>
          <TopRightSignIn hostedSignInUrl={hostedSignInUrl} />
          <Slot />
        </View>
        <View style={styles.bottomLeftAvatarWrapper}>
          <AvatarMenuInLayout />
        </View>
      </SafeAreaView>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fff",
  },
  main: {
    flex: 1,
    paddingTop: Platform.OS === "web" ? 20 : 0,
  },
  topRightContainer: {
    position: "absolute",
    right: 20,
    top: Platform.OS === "ios" ? 44 : 16,
    zIndex: 1000,
    padding: 4,
  },
  loginBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  loginText: { color: "#fff", fontWeight: "600" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  errorText: { color: "#555", textAlign: "center", paddingHorizontal: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menu: {
    marginTop: Platform.OS === "ios" ? 70 : 40,
    marginRight: 12,
    width: 180,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  menuName: { fontWeight: "700", marginBottom: 8 },
  menuItem: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6 },
  menuItemText: { color: "#EF4444", fontWeight: "700" },

  bottomAvatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  bottomAvatarImg: { width: 42, height: 42, borderRadius: 12 },
  bottomAvatarInitial: { fontWeight: "700", color: "#111" },

  bottomLeftAvatarWrapper: {
    position: "absolute",
    left: 12,
    bottom: 18,
    zIndex: 1200,
  },
});
