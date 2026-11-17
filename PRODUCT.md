# Product

<!-- impeccable:product-schema 1 -->

> Written by a design sub-agent from the task brief and the repository (docs/PANEL.md, panel/README.md, the
> `dev_xenastudios_hallow` extension), without a live interview. Facts marked *(inferred)* come from the brief
> or the code, not from a confirmed answer.

## Platform

web

## Users

- **Network staff of one Minecraft network (Hallow):** helpers, moderators, admins, developers and the owner. They
  use the panel while the network is live, often with the game open in another window, to answer a report, look a
  player up, punish or lift a punishment, or check that the network is healthy.
- **Operators** (admins, developers): run the fleet: proxies, lobbies, game instances, game kinds, nodes, and the
  fleet manager's settings and spend caps.
- Panel staff need no Minecraft account; what they can do comes from panel roles carrying `hallow.*` permissions.

## Product Purpose

One panel runs the whole network: live network state, players, punishments, reports, ranks, anticheat, game kinds,
instances and the machines they run on. Success: staff handle a player issue in seconds and trust what the panel
shows, because it reflects the control plane live and every action is audited.

## Positioning

A fork of the Calagopus hosting panel turned network-first: Hallow's pages lead and the hosting pages stay, out of
the way. Everything reads the Hallow control plane through the panel's backend, so the browser never talks to it.

## Operating Context

- Live operations: pages refresh every few seconds; staff glance at the Overview, then act on one player.
- Moderation flows: search a player by name/UUID/IP → profile → punish (from templates) or revoke with a reason;
  handle reports (claim → resolve with a punishment, or dismiss).
- Operations flows: end an instance, open its console, edit a game kind's scaling, change fleet settings.
- *(inferred)* Mostly desktop, in long sessions, at night as often as by day.

## Capabilities and Constraints

- Calagopus core (Rust/Axum + React/Mantine) with Hallow as one extension; core edits only for branding or
  extension hooks (panel/HALLOW-CHANGES.md). Upstream is merged every two weeks, so changes stay in the extension.
- UI kit: Mantine 8 via the core's `@/elements` wrappers, Tailwind utilities, FontAwesome icons.
- English only for Hallow strings today; the core has 19 languages.
- Destructive actions (ban, end an instance, delete a rank/kind) affect live players.

## Brand Commitments

- Name "Hallow Panel"; the Hallow violet (`#6a4cf5` light primary, `#8467ff` dark primary) over cool near-black
  surfaces; the halo "H" logo. Footer keeps the Calagopus credit (MIT notice).
- From the brief: **dense, fast, trustworthy, dark-first**.

## Evidence on Hand

- Live data comes from the control plane; there are no screenshots, testimonials or usage numbers in the repo.

## Product Principles

1. **Live and honest.** Show when data was fetched, keep last-good data visible on failure, never fake numbers.
2. **Fast to the player.** Any player is one search away; every list links to the profile.
3. **Safe by default.** Destructive actions confirm, say what they affect, and leave an audit trail.
4. **Dense, not cramped.** Tables over cards for lists; space separates groups, not every row.
5. **Network first.** Hallow's pages lead; hosting features stay available but quiet.

## Accessibility & Inclusion

- *(inferred)* WCAG 2.2 AA: contrast in both schemes, visible focus, full keyboard use of tables, filters and modals.
