---
name: expo-skills
description: Expo and React Native development - app building, EAS deployment, SDK upgrades, and mobile best practices. Use when building mobile apps with Expo.
---

# Expo Development Skills

## When to Use This Skill

- Building React Native apps with Expo
- Deploying with EAS (Expo Application Services)
- Upgrading Expo SDK versions
- Configuring app builds and submissions
- Implementing mobile-specific features

## Project Setup

### Create New Project

```bash
# Create with latest template
npx create-expo-app@latest my-app

# With specific template
npx create-expo-app my-app --template tabs
npx create-expo-app my-app --template blank-typescript

# Start development
cd my-app
npx expo start
```

### Project Structure

```
my-app/
├── app/                    # App Router (file-based routing)
│   ├── (tabs)/            # Tab navigator group
│   │   ├── index.tsx      # Home tab
│   │   ├── explore.tsx    # Explore tab
│   │   └── _layout.tsx    # Tab layout
│   ├── _layout.tsx        # Root layout
│   └── +not-found.tsx     # 404 page
├── assets/                # Static assets
├── components/            # Shared components
├── constants/             # Theme, config
├── hooks/                 # Custom hooks
├── app.json              # Expo config
├── eas.json              # EAS Build config
└── package.json
```

## App Configuration

### app.json / app.config.js

```javascript
// app.config.js
export default {
  expo: {
    name: "My App",
    slug: "my-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.company.myapp",
      buildNumber: "1",
      infoPlist: {
        NSCameraUsageDescription: "This app uses the camera to..."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.company.myapp",
      versionCode: 1,
      permissions: ["CAMERA", "RECORD_AUDIO"]
    },
    plugins: [
      "expo-router",
      ["expo-camera", { cameraPermission: "Allow camera access" }],
      ["expo-notifications", { icon: "./assets/notification-icon.png" }]
    ],
    extra: {
      eas: { projectId: "your-project-id" },
      apiUrl: process.env.API_URL
    }
  }
};
```

## EAS Build & Submit

### Setup EAS

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure project
eas build:configure
```

### eas.json Configuration

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD1234"
      },
      "android": {
        "serviceAccountKeyPath": "./pc-api-key.json",
        "track": "internal"
      }
    }
  }
}
```

### Build Commands

```bash
# Development build (for dev client)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build (internal testing)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## SDK Upgrades

### Upgrade Process

```bash
# Check current version
npx expo --version

# Install upgrade tool
npx expo install expo@latest

# Or specific version
npx expo install expo@52

# Fix dependencies
npx expo install --fix

# Check for issues
npx expo-doctor
```

### Common Upgrade Issues

```javascript
// Check for deprecated APIs
// SDK 52 changes:
// - expo-app-loading removed, use expo-splash-screen
// - Constants.manifest deprecated, use Constants.expoConfig

// Before (SDK 51)
import Constants from 'expo-constants';
const apiUrl = Constants.manifest?.extra?.apiUrl;

// After (SDK 52+)
import Constants from 'expo-constants';
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

## Common Patterns

### Navigation (Expo Router)

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

// Navigate programmatically
import { router } from 'expo-router';

router.push('/details/123');
router.replace('/home');
router.back();
```

### Authentication Flow

```typescript
// app/_layout.tsx
import { useAuth } from '@/hooks/useAuth';
import { Redirect, Stack } from 'expo-router';

export default function AppLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Stack />;
}
```

### Secure Storage

```typescript
import * as SecureStore from 'expo-secure-store';

// Store token
await SecureStore.setItemAsync('authToken', token);

// Retrieve token
const token = await SecureStore.getItemAsync('authToken');

// Delete token
await SecureStore.deleteItemAsync('authToken');
```

### Push Notifications

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require physical device');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  return token.data;
}
```

### Camera & Image Picker

```typescript
import * as ImagePicker from 'expo-image-picker';

async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (!result.canceled) {
    return result.assets[0].uri;
  }
}

async function takePhoto() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled) {
    return result.assets[0].uri;
  }
}
```

## Performance Tips

```typescript
// Use memo for expensive components
const MemoizedList = React.memo(ExpensiveList);

// Use FlashList instead of FlatList
import { FlashList } from "@shopify/flash-list";

<FlashList
  data={items}
  renderItem={renderItem}
  estimatedItemSize={100}
/>

// Optimize images
import { Image } from 'expo-image';

<Image
  source={uri}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
/>
```

## Debugging

```bash
# Open developer menu
# iOS Simulator: Cmd + D
# Android Emulator: Cmd + M

# View logs
npx expo start --clear

# Debug with React DevTools
npx react-devtools
```

## Checklist

- [ ] Configure app.json with correct identifiers
- [ ] Set up EAS for builds
- [ ] Add required permissions
- [ ] Configure splash screen and icons
- [ ] Set up push notifications
- [ ] Test on physical devices
- [ ] Configure environment variables
- [ ] Set up error monitoring
