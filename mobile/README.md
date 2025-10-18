# Society Karbhar — Mobile (Expo)

This folder contains a minimal React Native (Expo) scaffold for the Society Karbhar mobile app.

Getting started

1. Install Expo CLI (if you don't have it):

```bash
npm install -g expo-cli
```

2. From the `mobile/` folder, install dependencies:

```bash
cd mobile
npm install
```

3. Start the app

```bash
npm start
# or
npm run android
```

Notes
- The API base URL default targets `http://10.0.2.2:4000` which works for Android emulator to reach your host machine's `localhost`.
- For iOS simulator or physical devices replace with your machine IP or backend host.
- This is a minimal scaffold (Login + Home). Next steps: integrate secure token storage, role-based screens, navigation (react-navigation), and Cloudinary uploads.
