try {
  require('dotenv/config');
} catch (e) {
  // dotenv not available (e.g., in Vercel build), use process.env directly
}

export default {
  expo: {
    name: "alcovia",
    slug: "alcovia",
    extra: {
      clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL,
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL
    }
  }
};
