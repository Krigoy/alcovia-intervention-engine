import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";

const items = [
  { key: "dashboard", label: "Dashboard", route: "/dashboard", icon: "📊" },
  { key: "focus", label: "Focus Timer", route: "/focus", icon: "⏱️" },
  { key: "tasks", label: "Tasks", route: "/tasks", icon: "📝" },
  { key: "profile", label: "Profile", route: "/profile", icon: "👤" },
];

export default function Sidebar({
  initialCollapsed = false,
}: {
  initialCollapsed?: boolean;
}) {
  const router = useRouter();
  const { isSignedIn, isLoaded, signOut } = useAuth() as any;
  const { user } = useUser() as any;
  const displayName = (
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "User"
  ).split(" ")[0];
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const widthAnim = useMemo(
    () => new Animated.Value(initialCollapsed ? 76 : 240),
    [initialCollapsed]
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = () => {
    const toValue = collapsed ? 240 : 76;
    Animated.timing(widthAnim, {
      toValue,
      duration: 180,
      useNativeDriver: false,
    }).start();
    setCollapsed(!collapsed);
  };
  const go = (r: string) => router.push(r);
  const doSignOut = async () => {
    try {
      if (isLoaded && typeof signOut === "function") await signOut();
    } catch (e) {
      console.warn(e);
    } finally {
      setMenuOpen(false);
    }
  };
  return (
    <>
      <Animated.View style={[styles.wrap, { width: widthAnim }]}>
        <Pressable onPress={toggle} style={styles.logoRow}>
          <Text style={styles.logoIcon}>⚡</Text>
          {!collapsed && <Text style={styles.logoText}>Alcovia</Text>}
        </Pressable>
        <View style={styles.items}>
          {items.map((it) => (
            <Pressable
              key={it.key}
              onPress={() => go(it.route)}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemActive,
              ]}
            >
              <Text style={styles.itemIcon}>{it.icon}</Text>
              {!collapsed && <Text style={styles.itemLabel}>{it.label}</Text>}
            </Pressable>
          ))}
        </View>
        <View style={styles.footer}>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.avatar}>
            <Text style={styles.avatarText}>
              {String(displayName.charAt(0) || "U").toUpperCase()}
            </Text>
          </Pressable>
          {!collapsed && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userSmall}>
                {isSignedIn ? "Signed in" : "Guest"}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuOpen(false)}
        >
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

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#EFEFF1",
    height: "100%",
    paddingTop: Platform.OS === "ios" ? 50 : 18,
    paddingHorizontal: 12,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  logoIcon: {
    fontSize: 22,
    width: 32,
    textAlign: "center",
  },
  logoText: {
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 8,
  },
  items: {
    flex: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginBottom: 6,
  },
  itemActive: {
    backgroundColor: "#F3F6FF",
  },
  itemIcon: {
    fontSize: 18,
    width: 36,
    textAlign: "center",
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "700",
  },
  userName: { fontWeight: "700", marginTop: 4 },
  userSmall: { color: "#666", fontSize: 12 },
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
});
