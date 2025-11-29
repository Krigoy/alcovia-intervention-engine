import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import Dashboard from "./dashboard";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

const hostedSignInUrl = (
  process.env.EXPO_PUBLIC_CLERK_SIGNIN_URL || ""
).toString();

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth() as any;

  async function openHostedSignIn() {
    if (!hostedSignInUrl) {
      console.warn("Hosted sign-in URL not set: EXPO_PUBLIC_CLERK_SIGNIN_URL");
      return;
    }
    try {
      const redirectUrl = Linking.createURL("/callback");
      await WebBrowser.openAuthSessionAsync(hostedSignInUrl, redirectUrl);
    } catch (err) {
      console.warn("Auth open failed", err);
    }
  }

  if (!isLoaded) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return (
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.navbar}>
          <Text style={s.logo}>Intervention Engine</Text>
          <View style={s.navRight}>
            <TouchableOpacity onPress={openHostedSignIn} style={s.navButton}>
              <Text style={s.navButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.hero}>
          <Text style={s.heroTitle}>Student Intervention Engine Prototype</Text>
          <Text style={s.heroSubtitle}>
            Automatically analyze daily student data, detect Focus Score issues,
            and trigger mentor interventions in real-time.
          </Text>

          <TouchableOpacity onPress={openHostedSignIn} style={s.ctaBtn}>
            <Text style={s.ctaBtnText}>Get Started</Text>
          </TouchableOpacity>
        </View>

        <View style={s.features}>
          <Text style={s.sectionTitle}>What This Prototype Includes</Text>

          <View style={s.featureCard}>
            <Text style={s.featureTitle}>Daily Check-In Parsing</Text>
            <Text style={s.featureDesc}>
              Reads daily student logs, evaluates Focus Score, and assigns
              status.
            </Text>
          </View>

          <View style={s.featureCard}>
            <Text style={s.featureTitle}>Automatic Alerts</Text>
            <Text style={s.featureDesc}>
              Triggers n8n workflows when a student needs intervention.
            </Text>
          </View>

          <View style={s.featureCard}>
            <Text style={s.featureTitle}>Mentor Dashboard</Text>
            <Text style={s.featureDesc}>
              View all student statuses and assign remedial tasks instantly.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={s.wrap}>
      <View style={s.main}>
        <Dashboard />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  wrap: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    backgroundColor: "#fff",
  },
  main: {
    flex: 1,
    minHeight: 0,
  },

  container: {
    paddingTop: 30,
    paddingBottom: 60,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },

  navbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    fontSize: 20,
    fontWeight: "700",
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButton: {
    backgroundColor: "#0A84FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  hero: {
    marginTop: 20,
    marginBottom: 50,
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    maxWidth: 520,
    marginBottom: 22,
  },
  ctaBtn: {
    backgroundColor: "#0A84FF",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  features: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  featureCard: {
    backgroundColor: "#F4F4F6",
    padding: 16,
    marginTop: 12,
    borderRadius: 10,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  featureDesc: {
    color: "#555",
    fontSize: 14,
  },
});
