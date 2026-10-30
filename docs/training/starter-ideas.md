# Starter ideas

Six extensions you can build in 10–15 minutes with Claude. Each stays in the green lane: it reads data Covenant already has and adds nothing new to the core. Paste the prompt, answer Claude's questions, and confirm the plan.

(The **Deal one-pager** is the walkthrough demo, so pick something else.)

## 1. Upcoming ICs (page)

> *A page called "Upcoming ICs" listing every active deal with an IC meeting coming up: the date, the deal, its stage, the deal lead and the facility size. Soonest first.*

Uses: deals, IC dates, metrics. Try next: highlight meetings in the next 7 days. (Showing whether the memo is ready would need an engineer to add memo status to the SDK.)

## 2. Red-flag tracker (page)

> *A page called "Red flags" showing every open red-flag diligence finding on active deals: the deal, the workstream, the finding, its owner and due date. Let me add a note to the deal from each row.*

Uses: diligence items, deals, **add a note**. Try next: group by deal.

## 3. Covenant headroom watchlist (page)

> *A page called "Headroom watchlist" listing deals whose covenant cushion is below our guideline, worst first, with leverage, the covenant level and the cushion.*

Uses: each deal's metrics (leverage, covenant level, cushion), which Covenant already calculates. Asking to *change* the guideline or the calculation would need an engineer.

## 4. Sponsor scorecard (page)

> *A page called "Sponsor scorecard": for each sponsor, how many deals we've seen, closed, passed and lost, and the average leverage on closed deals.*

Uses: deals, companies, metrics. Try next: a bar chart of deals per sponsor.

## 5. Diligence checklist (deal tab)

> *A tab on each deal called "DD checklist" showing the deal's diligence requests and findings grouped by workstream, with open items first, and a button to add a new request.*

Uses: diligence items, **add a diligence item**.

## 6. Relationship touchpoints (deal tab)

> *A tab on each deal called "Touchpoints" listing the latest notes about the deal, its borrower and its sponsor, newest first, with who wrote them.*

Uses: notes, companies, people.

## Ideas that need an engineer

Claude will offer to write an engineering request for these:

- changing how leverage, cushion or any other figure is calculated;
- new kinds of data (e.g. tracking a sector limit per sector);
- editing terms, moving deals between stages, or changing who can do what;
- pulling data from outside Covenant (market data, email, the data room).
