import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
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

const hostedSignInUrl = (
  process.env.EXPO_PUBLIC_CLERK_SIGNIN_URL || ""
).toString();

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

export default function Landing() {
  const router = useRouter();
  const { isSignedIn } = useAuth() as any;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Alcovia</Text>
        <View style={styles.headerActions}>
          {!isSignedIn ? (
            <>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={styles.link}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/signup")}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Create account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/dashboard")}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Open dashboard</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>Intervention automation for students</Text>
        <Text style={styles.lead}>
          Fast detection of low focus scores and seamless mentor workflows —
          reduce student drop-off and surface help early.
        </Text>

        <TouchableOpacity
          style={styles.cta}
          onPress={() =>
            isSignedIn ? router.push("/dashboard") : router.push("/signup")
          }
        >
          <Text style={styles.ctaText}>
            {isSignedIn ? "Go to Dashboard" : "Get started — it's free"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.features}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Realtime checks</Text>
          <Text style={styles.cardText}>
            Submit daily check-ins and automatically flag students who need
            help.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mentor workflow</Text>
          <Text style={styles.cardText}>
            Mentors get email prompts with a one-click assignment page to unlock
            remedial actions.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Focus timer & cheat alerts</Text>
          <Text style={styles.cardText}>
            Built-in focus timer and simple cheat detection to catch distracted
            sessions.
          </Text>
        </View>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 60,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  brand: {
    fontSize: 20,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  link: {
    marginRight: 16,
    color: "#374151",
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: "#0A84FF",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

  hero: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  lead: {
    textAlign: "center",
    color: "#555",
    maxWidth: 420,
    marginBottom: 18,
    fontSize: 15,
  },
  cta: {
    backgroundColor: "#111827",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
  },

  features: {
    marginTop: 8,
  },
  card: {
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2FF",
  },
  cardTitle: {
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 15,
  },
  cardText: {
    color: "#444",
    fontSize: 14,
  },
});
