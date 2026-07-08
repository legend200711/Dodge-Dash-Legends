# PlaylistSync

> **Transfer your YouTube playlists to Spotify, Apple Music, Amazon Music, and Napster — instantly.**

A full-stack web app with a Legend dark theme, Firebase auth, smart song matching, and live progress tracking.

---

## 🚀 Quick Start

### 1. Clone the project
```bash
git clone <your-repo>
cd PlaylistSync
```

### 2. Install backend dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your API keys (see Setup Guide below)
```

### 4. Set up Firebase (frontend)
Edit `firebase/config.js` and replace the placeholder values with your Firebase project credentials.

### 5. Run the server
```bash
npm run dev    # Development (auto-restarts)
npm start      # Production
```

### 6. Open in browser
Navigate to `http://localhost:3001`

---

## 🔑 API Keys You Need

| Service | Where to Get It |
|---------|----------------|
| **YouTube Data API v3** | [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com) |
| **Firebase** | [Firebase Console](https://console.firebase.google.com) |
| **Spotify** | [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| **Apple Music** | [Apple Developer Portal](https://developer.apple.com) – MusicKit |
| **Amazon Music** | [Amazon Developer Console](https://developer.amazon.com) |
| **Napster** | [Napster Developer Portal](https://developer.napster.com) |

---

## 📁 Project Structure

```
PlaylistSync/
├── index.html          Landing page
├── login.html          Sign In / Register
├── dashboard.html      Main dashboard
├── transfer.html       New transfer flow (4 steps)
├── history.html        Transfer history
├── settings.html       Profile, platforms, preferences
│
├── css/
│   ├── style.css       Global dark theme
│   └── dashboard.css   App layout styles
│
├── js/
│   ├── app.js          Dashboard, history, settings logic
│   ├── auth.js         Firebase auth (email + Google)
│   ├── youtube.js      YouTube playlist parser
│   ├── transfer.js     Transfer engine with live progress
│   └── platforms.js    Platform connection status
│
├── server/
│   ├── index.js        Express server entry point
│   ├── middleware/
│   │   └── auth.js     Firebase token verification
│   ├── routes/
│   │   ├── youtube.js  YouTube Data API route
│   │   ├── platforms.js Song match + playlist creation
│   │   └── oauth.js    OAuth callbacks (Spotify, Amazon, Napster)
│   └── services/
│       ├── firebase-admin.js  Admin SDK
│       └── tokenStore.js      Token refresh logic
│
├── firebase/
│   └── config.js       Firebase client config
│
├── database/
│   └── schema.js       Firestore schema + helpers
│
├── .env.example        Environment variable template
├── package.json
└── README.md
```

---

## 🎯 Features

- **Google + Email Auth** via Firebase Authentication
- **YouTube Playlist Import** – reads title, artist, thumbnail, song count
- **Smart Matching** – cleans "feat.", "(Official Video)", "[Lyrics]" etc.
- **4 Platforms** – Spotify, Apple Music, Amazon Music, Napster
- **Live Progress** – per-song, per-platform progress bars
- **Transfer History** – stored in Firestore, filterable
- **Retry Failed Songs** – one click to retry unmatched songs
- **CSV Export** – download transfer reports
- **Dark Theme** – Legend-branded dark UI
- **Mobile Friendly** – responsive on all screen sizes

---

## 🛡 Security

- All platform tokens encrypted at rest in Firestore (via Firebase security rules)
- Firebase ID tokens verified on every backend request
- Rate limiting on all API routes
- Environment secrets never exposed to the client
- Helmet.js security headers

---

## 📝 Firestore Security Rules

Add these to your Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /songCache/{cacheKey} {
      allow read: if request.auth != null;
      allow write: if false; // Server-side only
    }
  }
}
```

---

Built by **Legend** · Powered by Firebase + Node.js + YouTube API
