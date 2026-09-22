# Canonical mobility foundation

P4.5-A prepares the canonical, household-scoped mobility leg authority. It is a
foundation only: the migration is intentionally not applied and the certified
workbook is intentionally not committed.

## Authority rules

1. One physical vehicle movement is exactly one `MobilityLeg`.
2. Paid fuel and mobility usage are separate authorities and must never be
   reconciled or combined.
3. Participants never multiply a leg: two occupants in one vehicle movement
   still produce one leg.
4. Contexts never multiply a cost. Context, purpose, person, activity, and
   participation are later relations, not physical-leg fields.
5. `NAV`, `JOUR`, and `AUT` are technical reconstruction lineage only.
6. Estimated distance, fuel, cost, and proxy time are never observed values.
7. Estimated fuel cost remains attached to its unique leg. Additive rollups use
   `mobility_usage_estimated_fuel_cost@v1`; the older `fuel_trip_estimate`
   remains non-additive.
8. Persona is the first intended consumer, never the owner of this authority.
9. The neutral leg grain remains compatible with future `MobilityTrip`, Nos
   rythmes de fond, M7, History, Timeline, and Moments projections.

Dataset identity is immutable by household, source hash, and import-method
version. Canonical IDs are deterministic, and `(dataset_id, source_leg_id)` is
unique. The existing `vehicles` primitive is reused. Place links require an
explicit exact label-and-coordinate mapping; unresolved endpoints remain null
and explicit. Historical fuel-price quality and geographic scope are preserved,
and observed times remain separate from proxy route times.

## Capability matrix

| Capability | Previous state | New authority | Can open | Why | Limitations |
| --- | --- | --- | --- | --- | --- |
| `MobilityLeg` | `AUTHORITY_GATED` | `mobility_datasets`, `mobility_legs`, `fct_mobility_leg` | After P4.5-B | Certified unique-leg authority is prepared | No live rows in P4.5-A |
| `Vehicle` | `AUTHORITY_GATED` | Existing `vehicles` primitive referenced by every leg | After vehicle resolution in P4.5-B | No competing vehicle abstraction | Live vehicle row is outside P4.5-A |
| `Distance` | `AUTHORITY_GATED` | Certified road distance on each unique leg | After P4.5-B | Source TomTom reconstruction is preserved | Estimated route evidence |
| `FuelPrice` | `AUTHORITY_GATED` | Per-leg P3 local/department or P4 national fallback authority | After P4.5-B | Period, scope, source, and quality are explicit | Live observation link may remain null |
| `EstimatedFuelCost` | `AUTHORITY_GATED` | Mobility-specific additive metric over unique legs | After P4.5-B | Cost remains attached to one physical leg | Estimated, never paid fuel |
| `RouteDefinition` | `AUTHORITY_GATED` | Route-method reference only | No | No reusable canonical route identity exists | Remains unavailable |

## Operational boundary

The import command is dry-run-only in P4.5-A. Its apply mode fails closed until
P4.5-B receives explicit approval. Database writes, Global V2 publication, and
UI consumption are outside this phase.

## P4.5-C derived context authority

P4.5-C adds no canonical column or table. `MobilityContextResolution` and
`MobilityPresenceResolution` are deterministic M7 owner projections rebuilt
from `MobilityLegFact`, structured LifeEvent types and participations, canonical
place identifiers, `PersonDayFact`, and positive `PlaceVisitFact` intervals.
They are not Persona records and they never carry distance, fuel, or cost.

The context grain is `mobility leg × context reference × subject person`; one
physical leg can therefore have several context links without becoming several
physical movements. Any additive projection must first deduplicate by
`mobilityLegId`. A missing candidate is represented as `UNLINKED`, while proxy,
approximate, or date-only candidates remain `AMBIGUOUS`.

Strong event links require an exact canonical endpoint place and a compatible
observed leg time. An observed arrival may fall from 120 minutes before the
context start through its end; an observed departure may fall from the context
start through 120 minutes after its end; an observed untyped point must fall
inside the interval. Proxy time, approximate intervals, and date-only evidence
never become a strong link. More precise participation evidence takes priority
over weaker evidence for the same event and subject. Source groups such as
`NAV` and `JOUR`, source labels, display labels, merchants, and fuzzy place
matching are never semantic evidence.

Couple presence is strictly pairwise. `CO_PRESENT_CONFIRMED` requires a second
positive participation in the same LifeEvent or an exact positive presence at
the context place. `OTHER_ELSEWHERE_CONFIRMED` requires an exact, overlapping,
positive presence at another canonical place. Missing GPS, absent PersonDay
coverage, and missing participation are never negative proof. Every other case
is `UNKNOWN`; no projection claims that a person was physically alone.
