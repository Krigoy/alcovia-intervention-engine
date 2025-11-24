import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.navbar}>
        <Text style={styles.logo}>Intervention Engine</Text>

        <View style={styles.navRight}>
          {!isSignedIn && (
            <>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={styles.navLink}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/signup")}
                style={styles.navButton}
              >
                <Text style={styles.navButtonText}>Sign Up</Text>
              </TouchableOpacity>
            </>
          )}

          {isSignedIn && (
            <>
              <TouchableOpacity
                onPress={() => router.push("/dashboard")}
                style={styles.navButton}
              >
                <Text style={styles.navButtonText}>Dashboard</Text>
              </TouchableOpacity>

              <View style={{ width: 10 }} />

              <TouchableOpacity
                onPress={() => router.push("/focus")}
                style={[styles.navButton, { backgroundColor: "#34C759" }]}
              >
                <Text style={styles.navButtonText}>Focus Mode</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          Student Intervention Engine Prototype
        </Text>

        <Text style={styles.heroSubtitle}>
          Automatically analyze daily student data, detect Focus Score issues,
          and trigger mentor interventions in real-time.
        </Text>

        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() =>
            isSignedIn ? router.push("/dashboard") : router.push("/signup")
          }
        >
          <Text style={styles.ctaBtnText}>
            {isSignedIn ? "Go to Dashboard" : "Get Started"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.features}>
        <Text style={styles.sectionTitle}>What This Prototype Includes</Text>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Daily Check-In Parsing</Text>
          <Text style={styles.featureDesc}>
            Reads daily student logs, evaluates Focus Score, and assigns status.
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Automatic Alerts</Text>
          <Text style={styles.featureDesc}>
            Triggers n8n workflows when a student needs intervention.
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Mentor Dashboard</Text>
          <Text style={styles.featureDesc}>
            View all student statuses and assign remedial tasks instantly.
          </Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  navLink: {
    marginRight: 20,
    fontSize: 15,
    color: "#333",
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
    maxWidth: 320,
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
