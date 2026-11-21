# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

.NET 10 Web API (ASP.NET Core + EF Core + Npgsql PostgreSQL) hosted on Render, with a React (Vite + TypeScript + Tailwind CSS) frontend hosted on GitHub Pages.

## Users

- **Guest:** Urban resident or visitor in Skopje browsing available electric scooters and bicycles by station and time window before creating an account.
- **Customer:** Registered rider reserving a vehicle for a planned window (up to 7 days), picking it up, returning it to a city station, and managing upcoming or past bookings.
- **Administrator:** Fleet operator managing vehicles, vehicle types, and Skopje stations, monitoring all reservations, pulling vehicles into service/maintenance, and reviewing monthly revenue and popularity reports.

## Product Purpose

An urban electric scooter and bicycle rental web application for Skopje. Riders find free vehicles for a specific time window, reserve with automatic transparent pricing, pick up and return vehicles at city stations, and manage their booking history. Administrators maintain fleet readiness, station inventory, and operational reporting.

## Positioning

Time-window-first urban micro-mobility reservation platform with station-to-station pickup/return, automatic full-day discount pricing, and late-return penalty enforcement—combining rider self-service with a full fleet operations console.

## Operating Context

- **City & Language:** English UI grounded in Skopje stations.
- **Core Rental Lifecycle:** Catalog search & availability check → Reservation (`Reserved`) → Vehicle pickup (`Active`) → Station return (`Completed`, with late penalty if overdue) or cancellation (`Cancelled`, allowed up to 1 hour before start).
- **Admin Operations:** Fleet CRUD (vehicles, vehicle types, stations), service/maintenance toggle (hides vehicle from catalog), reservation filtering, and monthly revenue / vehicle popularity dashboard.

## Capabilities and Constraints

- **Catalog & Availability:** Filter by vehicle type, station/location, and date/time window; display only vehicles free across the entire selected period; support pagination and price sorting.
- **Reservation Rules:** Reject overlapping reservations for the same vehicle; reject past start times; enforce a maximum rental duration of 7 days; auto-calculate price (`hours × hourly rate` with a full-day discount).
- **Pickup & Return:** Transition reservation to `Active` on pickup and `Completed` on return to a chosen station; apply late-return penalty (e.g., `1.5×` rate) when returned past the booked end time.
- **My Reservations:** List active and past reservations; permit cancellation only up to 1 hour before start time.
- **Admin Panel:** CRUD for vehicles, types, and stations; filterable view of all reservations; maintenance/service status removes vehicles from the public catalog; analytics dashboard (monthly revenue, most popular vehicles).
- **Open Decisions:** Exact full-day discount percentage/threshold, and currency display (MKD default in comps; confirm if EUR is also needed).

## Brand Commitments

- **Brand Name:** Rydio (`RYDIO`).
- **Visual World:** Suminagashi Ink Basin (`medium-native-fluid-ink-basin`) — paper-white surface (`#F6F7F9`), deep indigo ink (`#0A1A33`), dilute slate (`#606D80`), hairline mist rules (`#DDE2E8`), and delicate flowing ink-current marbling echoing the Vardar River.

## Evidence on Hand

- No existing brand assets, photography, or production dataset yet. Demo Skopje stations, vehicle catalog entries, and sample reservations will be seeded for development and evaluation.

## Product Principles

1. **Availability truth first:** Never show or allow booking a vehicle that is already reserved in the requested window or marked in maintenance.
2. **Transparent pricing at every step:** Riders see exact duration, full-day discounts, and potential late-return penalties before confirming or returning.
3. **Clear role separation:** Guest discovery, Customer ride management, and Admin fleet operations each expose only the actions appropriate to that role.
4. **Operational clarity over clutter:** Status transitions (`Reserved` → `Active` → `Completed` / `Cancelled`) and fleet maintenance states are unambiguous at a glance.
