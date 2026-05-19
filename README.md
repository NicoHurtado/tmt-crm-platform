# TMT CRM Platform

CRM platform for managing reservations, clients, partners, and drivers for a transportation and tourism company in Medellín, Colombia.

## Overview

TMT CRM handles the full lifecycle of transportation bookings — from client-facing reservation flows to internal operations management. It supports co-branded partner pages, online payments, driver assignment, and automated notifications.

## Features

- **Reservations** — multi-step booking wizard with real-time pricing (vehicle type, municipality surcharges, night rates)
- **Partners (Aliados)** — co-branded pages for hotels, Airbnbs, and agencies with custom rates and commissions
- **Payments** — Bold payment gateway integration with HMAC signature verification
- **Admin panel** — full CRUD, calendar sync, driver management, and statistics
- **Notifications** — automated email confirmations and driver assignment alerts
- **Tracking** — client-facing reservation status tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Railway) via Prisma 5 |
| Auth | NextAuth v4 |
| Payments | Bold |
| Storage | Vercel Blob |
| Automation | n8n (Railway) |
| Styling | Tailwind CSS + Shadcn/ui |
| Deployment | Railway |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npx prisma migrate dev

# Seed the database
npx prisma db seed

# Start development server
npm run dev
```

## Environment Variables

See `.env.example` for the full list of required variables including database URL, Bold keys, Google Calendar credentials, SMTP config, and NextAuth secret.

## Project Structure

```
app/          # Pages and API routes (58 endpoints)
components/   # UI components (admin, public, reservation wizard)
lib/          # Business logic, services, and utilities
prisma/       # Schema (18 models) and seed
```
