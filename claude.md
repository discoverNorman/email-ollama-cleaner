# Norman's Email Trash Hauling - Development Guidelines

## Project Overview
An AI-powered email classification app that uses Ollama to classify emails as spam, newsletter, or keep. Built with TypeScript, Hono, Drizzle ORM, SQLite, and Svelte 5.

## Styling Guidelines

### Brand Theme: Trash Truck
The app has a playful "trash hauling" theme with a garbage truck carrying emails. All UI should reinforce this theme.

### Color Palette
**DO NOT USE PURPLE.** The primary color scheme is green (trash truck theme):

- **Primary**: Emerald/Green (`#10b981`, `#059669`, `#34d399`)
- **Accent**: Green gradient (`from-emerald-500 to-green-600`)
- **Success**: Green (`#10b981`)
- **Warning**: Amber (`#f59e0b`)
- **Danger/Spam**: Red (`#ef4444`)
- **Keep Badge**: Green (`#10b981`)
- **Newsletter Badge**: Amber (`#f59e0b`)

### Gradients (Replace all purple with green)
```css
/* Primary gradient - USE THIS */
--gradient-primary: linear-gradient(135deg, #10b981 0%, #059669 100%);

/* DO NOT USE purple gradients like: */
/* linear-gradient(135deg, #667eea 0%, #764ba2 100%); */
```

### UX Philosophy
- **Best UX in the world** - Make Apple designers jealous
- Glassmorphism effects with subtle blur
- Smooth animations on all interactions
- Toast notifications for feedback
- Loading states with animated trash truck
- Fun, playful copy ("Haulin'", "Beep beep!", etc.)

### Component Patterns
- Rounded corners: `rounded-2xl` or `rounded-3xl`
- Cards: Glass effect with subtle shadows
- Buttons: Gradient backgrounds with hover lift effect
- Inputs: Premium styling with focus rings
- Animations: Use `ease-out-expo` for smooth feel

### Icons
- Use SVG trash truck logo throughout
- Heroicons for standard UI icons
- Custom truck SVG for loading states

## Architecture

### Backend (src/)
- `server.ts` - Hono server entry point
- `routes/api.ts` - API endpoints
- `services/` - Business logic (email-processor, imap-client, ollama-client)
- `db/` - Drizzle ORM schema and database

### Frontend (frontend/src/)
- `App.svelte` - Main application component
- `lib/api.ts` - API client functions
- `app.css` - Global styles and Tailwind utilities

## Important Notes
- Email deletion requires user confirmation (no auto-delete)
- EULA must be accepted before using the app
- Ollama connection status shown in header
- Model selection available in quick settings popover
