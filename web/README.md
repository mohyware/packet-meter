# PacketMeter Web Frontend

React frontend for PacketMeter server with Google OAuth authentication.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the `web` directory:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
VITE_API_BASE_URL=http://localhost:8080
```

3. Get a Google OAuth Client ID:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add `http://localhost:3000` to authorized JavaScript origins
   - Copy the Client ID to your `.env` file

4. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Features

- Google OAuth login (no password required)
- Device management dashboard
- View device usage reports
- Create new devices
- Responsive design

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack React Query
- Google OAuth (@react-oauth/google)
- Axios

## Build

```bash
npm run build
```

The built files will be in the `dist` directory.
