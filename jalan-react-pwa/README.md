# Jalan React PWA

## Overview
Jalan React PWA is a Progressive Web Application designed to streamline the examination process by storing student scores and providing real-time feedback and data analysis. The application works in tandem with a Scantron machine, which is responsible for scanning and checking the exams.

## Features
- User authentication for students and teachers.
- Role-based access for different user types (students, teachers, admins).
- Management of answer keys and answer sheets.
- Grade reporting and analysis.
- Offline capabilities through service workers.
- Responsive design for mobile and desktop devices.

## Project Structure
```
jalan-react-pwa
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── public
│   └── manifest.webmanifest
├── src
│   ├── service-worker.js
│   ├── registerServiceWorker.js
│   ├── supabaseClient.js
│   ├── components
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── gradeReport.jsx
│   │   ├── signup.jsx
│   │   ├── register.jsx
│   │   ├── login.jsx
│   │   ├── home.jsx
│   │   ├── answerKey.jsx
│   │   ├── answerSheet.jsx
│   │   ├── setting.jsx
│   │   ├── admin.jsx
│   │   ├── adminsetting.jsx
│   │   ├── ForgotPasswordModal.jsx
│   │   └── style.css
│   └── assets
│       └── icons
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/jalan-react-pwa.git
   ```
2. Navigate to the project directory:
   ```
   cd jalan-react-pwa
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Running the Application
To start the development server, run:
```
npm run dev
```
Open your browser and navigate to `http://localhost:3000` to view the application.

## Building for Production
To build the application for production, run:
```
npm run build
```
This will create a `dist` folder with the production-ready files.

## PWA Configuration
The application is configured as a Progressive Web App (PWA) with offline capabilities. The `manifest.webmanifest` file in the `public` directory contains the metadata for the PWA, including the app name, icons, and theme color.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.