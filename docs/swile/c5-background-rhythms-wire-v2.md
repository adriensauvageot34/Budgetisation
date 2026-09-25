# BackgroundRhythms annual wire v2

`analysis_global_background_rhythms` keeps its empty `{}` query parameters and uses
`global-background-rhythms@v2`, `analysis_global_background_rhythms@v2`, and
`global-background-rhythms-compact-wire@v2`. The twelve
`analysis_global_background_rhythm_month_detail` CAR resources remain v1. The
annual resource plus those twelve details form exactly thirteen snapshots.

The annual payload contains `food`, `carMobility`, `quality`, destinations, and
publication/resource metadata. CAR is unchanged. In `food`, `annual.moneyQuality`
and each month's last tuple field encode money quality. The month tuple positions
are:

1. month;
2. courses minimum or exact amount;
3. restaurants minimum or exact amount;
4. deliveries minimum or exact amount;
5. total minimum or exact amount;
6. non-grocery minimum or exact amount;
7. non-grocery share or `null`;
8. grocery behavior tuple;
9. restaurant behavior tuple;
10. delivery purchase count;
11. three ordered highlight buckets;
12. grocery/restaurant knowledge and limitation codes;
13. money-quality tuple `[mask, exactKnownSubtotal, minimumTotal]`.

Mask bits 0–4 mean `LOWER_BOUND` for courses, restaurants, deliveries, total,
and non-grocery amount respectively. An unset bit means `KNOWN`. Bit 5 means
the non-grocery share is `GATED`; the corresponding share field is `null`.
The exact subtotal and minimum total refer to the total FOOD amount, with
`exactKnownSubtotal <= minimumTotal`. The total bit is set exactly when the
minimum exceeds the exact subtotal. The runtime schema rejects unknown bits,
negative money, inconsistent totals, and duplicate or unordered months.

`food.benefitCoverage` is separate from money quality. It contains `status`
(`FULL`, `PARTIAL`, or `NOT_OBSERVED`), the first and last analysis months,
and sparse `[monthIndex, coverageState]` exceptions. A full window has no
exceptions. The default for `PARTIAL` and `NOT_OBSERVED` is
`OUT_OF_COVERAGE`; exceptions may mark covered months. An outside month
never acquires a zero funding amount merely because no funding tuple exists.

`food.monthlyBenefitFunding` contains sparse `[monthIndex, amount]` pairs.
It contains only server-computed observed Benefit funding for covered months.
The server includes only PurchaseEvents that C4 has already admitted to a
FOOD stream; C5 does not classify those purchases again.
It is explanatory and does not alter the FOOD gross or the three streams.
Neither annual, hover, nor top-entry wire contains a funding split.

Each highlight tuple has at least five fields in this order: stable source
identity, economic amount, source type, economic date, merchant label. Optional
trailing fields are basket class, article count, occurrence ID, activity ID,
activity label, and one sparse extension. The extension is `L` for a lower
bound amount, `U` for the Uber Eats channel, or `LU` for both. A direct or
in-person channel is omitted. `PURCHASE_COMPONENT` is a valid source type;
the UI does not require an Operation ID. Missing trailing nullable fields are
restored by the semantic decoder. An extension requires all ten preceding
positions, using `null` where no value exists. The runtime schema rejects
invalid arity, source or extension codes, and duplicate highlight identities.

`expandGlobalBackgroundFoodReadModel` validates the compact wire and returns
typed money, share, coverage, funding, and highlight objects. React receives
that semantic result and only formats or displays the server's decisions.
The C5 fixture suite covers exact and lower-bound money, mixed and
Benefit-only purchases, the Uber Eats channel, an unobserved source month,
and sparse monthly funding.
