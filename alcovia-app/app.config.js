// Extends app.json (passed in as `config`) instead of replacing it.
// Expo CLI loads .env automatically, so EXPO_PUBLIC_* values are available here.
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL,
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL,
  },
});
