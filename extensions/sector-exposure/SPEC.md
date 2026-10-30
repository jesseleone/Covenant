# Sector exposure

## What it does

- A page in the left menu that shows how much money the fund holds in each broad sector (business services, healthcare, software), from closed deals, and how much more is in the active pipeline.
- A bar for each sector, and a table underneath with each sub-sector, its deals, the fund's hold and the average leverage.
- Flags any sector that is more than half of what's shown, so concentration is easy to spot.
- A switch between "Closed book", "Active pipeline" and "Both".

## Out of scope

- Passed and lost deals (they are not exposure).
- Changing any data: this page only reads.
- Limits or targets per sector (there is no such data yet; that would need an engineer).

## Open questions

- Should the concentration flag use a different threshold than 50%? (Kept at 50% for now.)
