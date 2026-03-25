# FirstAcad Hub - Frontend

This is the frontend application for FirstAcad Hub, built with Vite, React, TypeScript, and Tailwind CSS.

## 🛠️ Technology Stack
- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Network & State:** React Query (TanStack Query)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm, yarn, or bun

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Environment Variables:
   Copy `.env.example` to `.env` if required and adjust API endpoints if necessary.

3. Start the development server:
   ```bash
   npm run dev
   ```
   The app will run at `http://localhost:8080` (or `http://localhost:5173`).

### Building for Production
```bash
npm run build
```
The output will be generated in the `dist/` directory.

### Preview Production Build
```bash
npm run preview
```

## 🗂️ Project Structure
- `src/pages` - Application route components
- `src/components` - Reusable UI components
- `src/lib` - Utility functions and API clients
- `src/types` - TypeScript interfaces and definitions
- `src/data` - Mock or static data
