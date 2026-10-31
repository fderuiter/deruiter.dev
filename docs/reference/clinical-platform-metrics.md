# Clinical Data Platform metric registry

<!-- Generated from METRIC_REGISTRY by scripts/generate-metric-artifacts.ts. Do not edit by hand. -->

Synthetic data for demonstration. Every study, site, subject and vendor is fictional. Values are for the default portfolio (seed 301) at its data cut, 2026-09-30.

The governed metrics of the Clinical Data Platform
([ADR 0066](../../adr/0066-clinical-data-platform-architecture.md)),
each defined once in `METRIC_REGISTRY` (`lib/clinical-platform`) over the
[gold star schema](clinical-platform-star-schema.md). The TypeScript
evaluator behind the platform's dashboards, the SQL for DuckDB, PostgreSQL
and SQL Server, the dbt MetricFlow YAML and the Power BI TMDL measures are
all compiled from these definitions, and a test runs the DuckDB SQL
against the TypeScript evaluator on the same data. Regenerate this page,
the golden files and the registry lock with
`npx tsx scripts/generate-metric-artifacts.ts`; a unit test fails when
they drift.

A `portfolio` metric rolls up to one value and can be grouped by any
allowed dimension. A `study` metric is defined per study, so every query
of it groups by study. A certified metric whose computation changes needs
a major version bump, and a certified report may only use certified
metrics.

## Summary

| Metric | Id | Status | Version | Grain | Value |
| --- | --- | --- | --- | --- | --- |
| Subjects screened | `subjects_screened` | certified | 1.0.0 | portfolio | 1,808 subjects |
| Subjects enrolled | `subjects_enrolled` | certified | 1.0.0 | portfolio | 1,228 subjects |
| Enrollment vs plan | `enrollment_vs_plan` | certified | 1.0.0 | portfolio | 78.8% |
| Screen failure rate | `screen_failure_rate` | certified | 1.0.0 | portfolio | 31.4% |
| Screen failures | `screen_failures` | certified | 1.0.0 | portfolio | 562 subjects |
| Early termination rate | `early_termination_rate` | certified | 1.0.0 | portfolio | 8.3% |
| Site activation cycle time | `site_activation_cycle_time` | certified | 1.0.0 | portfolio | 154.0 days |
| Sites selected | `sites_selected` | certified | 1.0.0 | portfolio | 120 sites |
| Sites contracted | `sites_contracted` | certified | 1.0.0 | portfolio | 120 sites |
| Sites IRB approved | `sites_irb_approved` | certified | 1.0.0 | portfolio | 120 sites |
| Sites initiated | `sites_initiated` | certified | 1.0.0 | portfolio | 120 sites |
| Sites activated | `sites_activated` | certified | 1.0.0 | portfolio | 120 sites |
| Sites with a first subject in | `sites_with_first_subject_in` | certified | 1.0.0 | portfolio | 118 sites |
| Selection to executed agreement | `selection_to_contract_days` | certified | 1.0.0 | portfolio | 38.0 days |
| Executed agreement to IRB approval | `contract_to_irb_approval_days` | certified | 1.0.0 | portfolio | 26.0 days |
| IRB approval to initiation visit | `irb_approval_to_initiation_days` | certified | 1.0.0 | portfolio | 20.0 days |
| Initiation visit to activation | `initiation_to_activation_days` | certified | 1.0.0 | portfolio | 3.5 days |
| Activation to first subject in | `activation_to_first_subject_in_days` | certified | 1.0.0 | portfolio | 48.0 days |
| Data entry lag (median) | `data_entry_lag_median` | certified | 1.0.0 | portfolio | 2.0 days |
| Data entry lag (90th percentile) | `data_entry_lag_p90` | certified | 1.0.0 | portfolio | 9.0 days |
| Data entry lag (mean) | `data_entry_lag_mean` | certified | 1.0.0 | portfolio | 3.5 days |
| Missed visit rate | `missed_visit_rate` | certified | 1.0.0 | portfolio | 1.9% |
| Out-of-window visit rate | `out_of_window_visit_rate` | certified | 1.0.0 | portfolio | 3.1% |
| Query rate per 100 visits | `query_rate_per_100_visits` | certified | 1.0.0 | portfolio | 47.2 queries per 100 visits |
| Open queries | `open_query_count` | certified | 1.1.0 | portfolio | 36 queries |
| Query aging | `query_aging_mean` | certified | 1.1.0 | portfolio | 2.9 days |
| Query resolution time (median) | `query_resolution_time_median` | certified | 1.1.0 | portfolio | 5.0 days |
| Open queries aged 0 to 7 days | `open_queries_aged_0_7_days` | certified | 1.0.0 | portfolio | 33 queries |
| Open queries aged 8 to 30 days | `open_queries_aged_8_30_days` | certified | 1.0.0 | portfolio | 3 queries |
| Open queries aged 31 to 60 days | `open_queries_aged_31_60_days` | certified | 1.0.0 | portfolio | 0 queries |
| Open queries aged over 60 days | `open_queries_aged_over_60_days` | certified | 1.0.0 | portfolio | 0 queries |
| SDV completion | `sdv_completion` | certified | 1.0.0 | portfolio | 85.4% |
| Overdue monitoring visit reports | `monitoring_reports_overdue` | certified | 2.0.0 | portfolio | 2 monitoring visits |
| Overdue interim monitoring visits | `monitoring_visits_overdue` | certified | 1.0.0 | portfolio | 5 planned visits |
| Monitoring report cycle time (median) | `monitoring_report_cycle_time_median` | certified | 1.0.0 | portfolio | 14.0 days |
| Important deviations per 100 subjects | `important_deviation_rate` | certified | 1.0.0 | portfolio | 13.9 deviations per 100 enrolled subjects |
| Non-important deviations per 100 subjects | `non_important_deviation_rate` | certified | 1.0.0 | portfolio | 13.1 deviations per 100 enrolled subjects |
| Subjects with an important deviation | `subjects_with_important_deviation` | certified | 1.0.0 | portfolio | 13.0% |
| Protocol deviations | `protocol_deviation_count` | certified | 1.0.0 | portfolio | 332 deviations |
| Events sent for adjudication | `cec_events_reported` | certified | 1.0.0 | portfolio | 39 events |
| Events adjudicated | `cec_events_adjudicated` | certified | 1.0.0 | portfolio | 28 events |
| Events awaiting adjudication | `cec_adjudication_backlog` | certified | 1.0.0 | portfolio | 11 events |
| Time to adjudication (median) | `cec_adjudication_time_median` | certified | 1.0.0 | portfolio | 27.5 days |
| Protocol final to first subject in | `protocol_final_to_fpi_days` | certified | 1.0.0 | study | DEMO-101: 90 days; DEMO-201: 90 days; DEMO-202: 132 days; DEMO-203: 147 days; DEMO-301: 93 days; DEMO-302: 185 days; DEV-401: 114 days; DEV-402: 86 days |
| First subject in to last subject in | `fpi_to_lpi_days` | certified | 1.0.0 | study | DEMO-101: 128 days; DEMO-201: 457 days; DEMO-202: 527 days; DEMO-203: 442 days; DEMO-301: 176 days; DEV-401: 201 days |
| Last subject last visit to database lock | `lplv_to_dbl_days` | certified | 1.0.0 | study | DEMO-101: 75 days; DEMO-301: 46 days; DEV-401: 43 days |
| Budget burn vs plan | `budget_burn_vs_plan` | certified | 1.0.0 | portfolio | 103.7% |
| Cost per enrolled subject | `cost_per_enrolled_subject` | certified | 1.0.0 | portfolio | $37,872 |
| Actual spend | `actual_spend` | certified | 1.0.0 | portfolio | $46,506,401 |
| Budget at completion | `budget_at_completion` | certified | 1.0.0 | portfolio | $67,121,250 |
| Forecast at completion | `forecast_at_completion` | certified | 1.0.0 | portfolio | $69,977,656 |
| Variance at completion | `variance_at_completion` | certified | 1.0.0 | portfolio | $2,856,406 |
| Forecast against budget at completion | `forecast_vs_budget_at_completion` | certified | 1.0.0 | portfolio | 104.3% |

## Enrollment

### Subjects screened

Subjects who entered screening, counted on their screening date. Each counts once, whatever the screening outcome.

- Id: `subjects_screened`, version 1.0.0, certified.
- Formula: count of gold.fct_enrollment rows where event_type = 'screened'.
- Unit: subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Screening (`screening-term`).

### Subjects enrolled

Subjects enrolled into a study, counted on their enrollment date. Subjects who later completed or discontinued still count.

- Id: `subjects_enrolled`, version 1.0.0, certified.
- Formula: count of gold.fct_enrollment rows where event_type = 'enrolled'.
- Unit: subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Enrollment (`enrollment-term`).

### Enrollment vs plan

Enrolled subjects as a share of the planned enrollment, the sum of the current site targets. The plan is the whole-study target, not a time-phased curve, so an enrolling study is expected to sit below 100%.

- Id: `enrollment_vs_plan`, version 1.0.0, certified.
- Formula: (count of gold.fct_enrollment rows where event_type = 'enrolled') / (sum of planned_enrollment over gold.dim_site rows where is_current = true).
- Unit: share of target. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Enrollment (`enrollment-term`).

### Screen failure rate

Share of screened subjects whose screening ended in a screen failure, by screening date. Subjects still in screening at the data cut have no outcome yet and are left out of both counts.

- Id: `screen_failure_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_enrollment rows where event_type = 'screened' and subject_status = 'screen-failed') / (count of gold.fct_enrollment rows where event_type = 'screened' and subject_status <> 'screening').
- Unit: share of screened subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Screen failure (`screen-failure-term`).

### Screen failures

Subjects whose screening ended in a screen failure, by screening date. It can be broken down by the reason screening failed; the screen failure rate cannot, because its denominator holds the subjects who passed, and they have no reason.

- Id: `screen_failures`, version 1.0.0, certified.
- Formula: count of gold.fct_enrollment rows where event_type = 'screened' and subject_status = 'screen-failed'.
- Unit: subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `screen_failure_reason`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Screen failure (`screen-failure-term`).

### Early termination rate

Subjects who discontinued before completing the study, as a share of subjects enrolled.

- Id: `early_termination_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_enrollment rows where event_type = 'discontinued') / (count of gold.fct_enrollment rows where event_type = 'enrolled').
- Unit: share of enrolled subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Early termination (`early-termination-term`).

## Site start-up

### Site activation cycle time

Median days from the study's protocol finalisation to a site's activation, over activated sites. Protocol finalisation is gold.dim_study.start_on; the metric reads it as the first day of the site's first gold.dim_site version, which the gold build opens on that date.

- Id: `site_activation_cycle_time`, version 1.0.0, certified.
- Formula: median of days from valid_from to activated_on over gold.dim_site rows where version_number = 1 and activated_on is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Sites selected

Sites selected by the sponsor by the data cut, each counted once. A site reaches the start-up stages in order: selection, executed agreement, IRB or ethics approval, initiation visit, activation, first subject in.

- Id: `sites_selected`, version 1.0.0, certified.
- Formula: count of gold.dim_site rows where version_number = 1 and selected_on is not null.
- Unit: sites. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Sites contracted

Sites with an executed clinical trial agreement by the data cut, each counted once. A site reaches the start-up stages in order: selection, executed agreement, IRB or ethics approval, initiation visit, activation, first subject in.

- Id: `sites_contracted`, version 1.0.0, certified.
- Formula: count of gold.dim_site rows where version_number = 1 and contracted_on is not null.
- Unit: sites. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Sites IRB approved

Sites with the study approved by their IRB or ethics committee by the data cut, each counted once. A site reaches the start-up stages in order: selection, executed agreement, IRB or ethics approval, initiation visit, activation, first subject in.

- Id: `sites_irb_approved`, version 1.0.0, certified.
- Formula: count of gold.dim_site rows where version_number = 1 and irb_approved_on is not null.
- Unit: sites. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Sites initiated

Sites with a site initiation visit by the data cut, each counted once. A site reaches the start-up stages in order: selection, executed agreement, IRB or ethics approval, initiation visit, activation, first subject in.

- Id: `sites_initiated`, version 1.0.0, certified.
- Formula: count of gold.dim_site rows where version_number = 1 and initiated_on is not null.
- Unit: sites. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Sites activated

Sites activated by the data cut, each counted once. A site reaches the start-up stages in order: selection, executed agreement, IRB or ethics approval, initiation visit, activation, first subject in.

- Id: `sites_activated`, version 1.0.0, certified.
- Formula: count of gold.dim_site rows where version_number = 1 and activated_on is not null.
- Unit: sites. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Sites with a first subject in

Sites that have enrolled a subject by the data cut, each counted once. A site reaches the start-up stages in order: selection, executed agreement, IRB or ethics approval, initiation visit, activation, first subject in.

- Id: `sites_with_first_subject_in`, version 1.0.0, certified.
- Formula: count of gold.dim_site rows where version_number = 1 and first_subject_in_on is not null.
- Unit: sites. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Selection to executed agreement

Median days from a site's selection to its executed clinical trial agreement, over sites that reached both stages by the data cut.

- Id: `selection_to_contract_days`, version 1.0.0, certified.
- Formula: median of days from selected_on to contracted_on over gold.dim_site rows where version_number = 1 and selected_on is not null and contracted_on is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Executed agreement to IRB approval

Median days from the executed agreement to the IRB or ethics committee's approval, over sites that reached both stages by the data cut.

- Id: `contract_to_irb_approval_days`, version 1.0.0, certified.
- Formula: median of days from contracted_on to irb_approved_on over gold.dim_site rows where version_number = 1 and contracted_on is not null and irb_approved_on is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### IRB approval to initiation visit

Median days from IRB or ethics approval to the site initiation visit, over sites that reached both stages by the data cut.

- Id: `irb_approval_to_initiation_days`, version 1.0.0, certified.
- Formula: median of days from irb_approved_on to initiated_on over gold.dim_site rows where version_number = 1 and irb_approved_on is not null and initiated_on is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Initiation visit to activation

Median days from the site initiation visit to activation, over sites that reached both stages by the data cut.

- Id: `initiation_to_activation_days`, version 1.0.0, certified.
- Formula: median of days from initiated_on to activated_on over gold.dim_site rows where version_number = 1 and initiated_on is not null and activated_on is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

### Activation to first subject in

Median days from activation to the first subject the site enrolled, over sites that reached both stages by the data cut.

- Id: `activation_to_first_subject_in_days`, version 1.0.0, certified.
- Formula: median of days from activated_on to first_subject_in_on over gold.dim_site rows where version_number = 1 and activated_on is not null and first_subject_in_on is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Site activation (`site-activation-term`).

## Visits and data entry

### Data entry lag (median)

Median days from a visit to the entry of its data in the EDC, over visits with data entered.

- Id: `data_entry_lag_median`, version 1.0.0, certified.
- Formula: median of entry_lag_days over gold.fct_visit rows where entry_lag_days is not null and visit_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Electronic Data Capture (EDC) (`edc-term`).

### Data entry lag (90th percentile)

90th percentile of days from a visit to the entry of its data in the EDC, interpolated linearly between ranked values. It shows the slow tail the median hides.

- Id: `data_entry_lag_p90`, version 1.0.0, certified.
- Formula: 90th percentile of entry_lag_days over gold.fct_visit rows where entry_lag_days is not null and visit_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Electronic Data Capture (EDC) (`edc-term`).

### Data entry lag (mean)

Mean days from a visit to the entry of its data in the EDC, over visits with data entered. The key risk indicator for entry timeliness.

- Id: `data_entry_lag_mean`, version 1.0.0, certified.
- Formula: mean of entry_lag_days over gold.fct_visit rows where entry_lag_days is not null and visit_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Electronic Data Capture (EDC) (`edc-term`).

### Missed visit rate

Missed visits as a share of all visits due by the data cut, dated by the planned visit date.

- Id: `missed_visit_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_visit rows where visit_status = 'missed') / (count of gold.fct_visit rows).
- Unit: share of visits due. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Missed visit (`missed-visit-term`).

### Out-of-window visit rate

Visits performed outside their protocol window, as a share of visits performed.

- Id: `out_of_window_visit_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_visit rows where visit_date_key is not null and is_out_of_window = true) / (count of gold.fct_visit rows where visit_date_key is not null).
- Unit: share of visits performed. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Visit window (`visit-window-term`).

## Queries

### Query rate per 100 visits

Data queries opened per 100 visits performed. The gold model holds no CRF page counts, so the rate is per visit rather than per 100 CRF pages.

- Id: `query_rate_per_100_visits`, version 1.0.0, certified.
- Formula: (count of gold.fct_query rows) / (count of gold.fct_visit rows where visit_date_key is not null), times 100.
- Unit: queries per 100 visits. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Data query (`data-query-term`).

### Open queries

Queries not closed at the data cut: still open, or answered by the site and awaiting review. Closed studies are left out by default, because their backlog is history.

- Id: `open_query_count`, version 1.1.0, certified.
- Formula: count of gold.fct_query rows where query_status in ('open', 'answered').
- Unit: queries. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `queried_form`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Data query (`data-query-term`).

### Query aging

Mean days from opening to the data cut of the queries not closed at the cut. Closed studies are left out by default, because their backlog is history.

- Id: `query_aging_mean`, version 1.1.0, certified.
- Formula: mean of days from date(opened_date_key) to the data cut over gold.fct_query rows where query_status in ('open', 'answered').
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `queried_form`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Data query (`data-query-term`).

### Query resolution time (median)

Median calendar days from a query's opening to its closing, over closed queries. Days are counted between UTC dates.

- Id: `query_resolution_time_median`, version 1.1.0, certified.
- Formula: median of days from date(opened_date_key) to date(closed_date_key) over gold.fct_query rows where closed_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `queried_form`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Data query (`data-query-term`).

### Open queries aged 0 to 7 days

Queries not closed at the data cut that opened 0 to 7 days before it, counted between UTC dates. With the other age bands it splits the open queries, so the four add up to them. Closed studies are left out by default, because their backlog is history.

- Id: `open_queries_aged_0_7_days`, version 1.0.0, certified.
- Formula: count of gold.fct_query rows where query_status in ('open', 'answered') and days from date(opened_date_key) to the data cut >= 0 and days from date(opened_date_key) to the data cut <= 7.
- Unit: queries. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `queried_form`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Data query (`data-query-term`).

### Open queries aged 8 to 30 days

Queries not closed at the data cut that opened 8 to 30 days before it, counted between UTC dates. With the other age bands it splits the open queries, so the four add up to them. Closed studies are left out by default, because their backlog is history.

- Id: `open_queries_aged_8_30_days`, version 1.0.0, certified.
- Formula: count of gold.fct_query rows where query_status in ('open', 'answered') and days from date(opened_date_key) to the data cut >= 8 and days from date(opened_date_key) to the data cut <= 30.
- Unit: queries. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `queried_form`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Data query (`data-query-term`).

### Open queries aged 31 to 60 days

Queries not closed at the data cut that opened 31 to 60 days before it, counted between UTC dates. With the other age bands it splits the open queries, so the four add up to them. Closed studies are left out by default, because their backlog is history.

- Id: `open_queries_aged_31_60_days`, version 1.0.0, certified.
- Formula: count of gold.fct_query rows where query_status in ('open', 'answered') and days from date(opened_date_key) to the data cut >= 31 and days from date(opened_date_key) to the data cut <= 60.
- Unit: queries. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `queried_form`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Data query (`data-query-term`).

### Open queries aged over 60 days

Queries not closed at the data cut that opened more than 60 days before it, counted between UTC dates. With the other age bands it splits the open queries, so the four add up to them. Closed studies are left out by default, because their backlog is history.

- Id: `open_queries_aged_over_60_days`, version 1.0.0, certified.
- Formula: count of gold.fct_query rows where query_status in ('open', 'answered') and days from date(opened_date_key) to the data cut >= 61.
- Unit: queries. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `queried_form`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: Data query (`data-query-term`).

## Monitoring

### SDV completion

CRF pages source-verified at monitoring visits as a share of the pages due for source data verification at those visits.

- Id: `sdv_completion`, version 1.0.0, certified.
- Formula: (sum of sdv_pages_verified over gold.fct_monitoring_visit rows) / (sum of sdv_pages_due over gold.fct_monitoring_visit rows).
- Unit: share of pages due. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Monitoring Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Source Document Verification (SDV) (`sdv-term`).

### Overdue monitoring visit reports

Monitoring visits whose report was still not final after its due date, at the data cut. The due date is the visit date plus the report deadline in the study's monitoring plan.

- Id: `monitoring_reports_overdue`, version 2.0.0, certified.
- Formula: count of gold.fct_monitoring_visit rows where report_final_date_key is null and days from date(report_due_date_key) to the data cut > 0.
- Unit: monitoring visits. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Monitoring Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Monitoring visit (`monitoring-visit-term`).

### Overdue interim monitoring visits

Interim monitoring visits the monitoring plan scheduled whose visit window closed before the data cut with no visit made. Each site's next visit is planned the plan's interval after its previous visit and is on time until the plan's window closes.

- Id: `monitoring_visits_overdue`, version 1.0.0, certified.
- Formula: count of gold.fct_planned_monitoring_visit rows where actual_date_key is null and days from date(due_date_key) to the data cut > 0.
- Unit: planned visits. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Monitoring Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Monitoring visit (`monitoring-visit-term`).

### Monitoring report cycle time (median)

Median days from a monitoring visit to its final report, over visits whose report is final.

- Id: `monitoring_report_cycle_time_median`, version 1.0.0, certified.
- Formula: median of days_to_final_report over gold.fct_monitoring_visit rows where days_to_final_report is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Monitoring Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Monitoring visit (`monitoring-visit-term`).

## Protocol deviations

### Important deviations per 100 subjects

Protocol deviations classed as important (after ICH E3) per 100 enrolled subjects.

- Id: `important_deviation_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_deviation rows where is_important = true) / (count of gold.fct_enrollment rows where event_type = 'enrolled'), times 100.
- Unit: deviations per 100 enrolled subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`.
- Default filters: none.
- Owner: Clinical Quality Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Important protocol deviation (`important-deviation-term`).

### Non-important deviations per 100 subjects

Protocol deviations not classed as important per 100 enrolled subjects.

- Id: `non_important_deviation_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_deviation rows where is_important = false) / (count of gold.fct_enrollment rows where event_type = 'enrolled'), times 100.
- Unit: deviations per 100 enrolled subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`.
- Default filters: none.
- Owner: Clinical Quality Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Protocol deviation (`protocol-deviation-term`).

### Subjects with an important deviation

Share of enrolled subjects with at least one important protocol deviation, a common study-level quality tolerance limit parameter.

- Id: `subjects_with_important_deviation`, version 1.0.0, certified.
- Formula: (distinct count of subject_id over gold.fct_deviation rows where is_important = true) / (count of gold.fct_enrollment rows where event_type = 'enrolled').
- Unit: share of enrolled subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`.
- Default filters: none.
- Owner: Clinical Quality Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Important protocol deviation (`important-deviation-term`).

### Protocol deviations

Protocol deviations that occurred, important or not, counted on the date each occurred. It can be broken down by category and importance; the rates per 100 enrolled subjects cannot, because enrollment has neither.

- Id: `protocol_deviation_count`, version 1.0.0, certified.
- Formula: count of gold.fct_deviation rows.
- Unit: deviations. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`, `deviation_category`, `deviation_importance`.
- Default filters: none.
- Owner: Clinical Quality Lead. Steward: Clinical Operations Data Steward.
- Glossary term: Protocol deviation (`protocol-deviation-term`).

## Event adjudication

### Events sent for adjudication

Events sites reported to the clinical events committee by the data cut.

- Id: `cec_events_reported`, version 1.0.0, certified.
- Formula: count of gold.fct_cec_adjudication rows.
- Unit: events. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Medical Safety Lead. Steward: Safety Data Steward.
- Glossary term: Event adjudication (`event-adjudication-term`).

### Events adjudicated

Reported events the clinical events committee had adjudicated by the data cut.

- Id: `cec_events_adjudicated`, version 1.0.0, certified.
- Formula: count of gold.fct_cec_adjudication rows where adjudicated_date_key is not null.
- Unit: events. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Medical Safety Lead. Steward: Safety Data Steward.
- Glossary term: Event adjudication (`event-adjudication-term`).

### Events awaiting adjudication

Reported events the clinical events committee had not adjudicated by the data cut. Closed studies are counted too, because an event still waiting holds up database lock.

- Id: `cec_adjudication_backlog`, version 1.0.0, certified.
- Formula: count of gold.fct_cec_adjudication rows where adjudicated_date_key is null.
- Unit: events. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Medical Safety Lead. Steward: Safety Data Steward.
- Glossary term: Event adjudication (`event-adjudication-term`).

### Time to adjudication (median)

Median calendar days from the site's report of an event to its adjudication by the clinical events committee, over events adjudicated by the data cut.

- Id: `cec_adjudication_time_median`, version 1.0.0, certified.
- Formula: median of days from date(reported_date_key) to date(adjudicated_date_key) over gold.fct_cec_adjudication rows where adjudicated_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Medical Safety Lead. Steward: Safety Data Steward.
- Glossary term: Event adjudication (`event-adjudication-term`).

## Milestones

### Protocol final to first subject in

Days from protocol finalisation to the first subject's enrollment in one study: study start-up, through regulatory approval and the first site's activation. A study that has not reached both milestones has no value.

- Id: `protocol_final_to_fpi_days`, version 1.0.0, certified.
- Formula: days from the actual protocol-final date to the actual first-subject-in date in gold.fct_milestone, per study.
- Unit: days. Grain: study.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`.
- Default filters: none.
- Owner: Portfolio Management Lead. Steward: Portfolio Data Steward.
- Glossary term: Study start-up (`study-start-up-term`).

### First subject in to last subject in

Days from the first subject's enrollment to the last subject's in one study: the enrollment period. A study that has not reached both milestones has no value.

- Id: `fpi_to_lpi_days`, version 1.0.0, certified.
- Formula: days from the actual first-subject-in date to the actual last-subject-in date in gold.fct_milestone, per study.
- Unit: days. Grain: study.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`.
- Default filters: none.
- Owner: Portfolio Management Lead. Steward: Portfolio Data Steward.
- Glossary term: Enrollment period (`enrollment-period-term`).

### Last subject last visit to database lock

Days from the last subject's last visit to database lock in one study. A study that has not reached both milestones has no value.

- Id: `lplv_to_dbl_days`, version 1.0.0, certified.
- Formula: days from the actual last-subject-last-visit date to the actual database-lock date in gold.fct_milestone, per study.
- Unit: days. Grain: study.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`.
- Default filters: none.
- Owner: Portfolio Management Lead. Steward: Portfolio Data Steward.
- Glossary term: Database lock (DBL) (`database-lock-term`).

## Finance

### Budget burn vs plan

Actual spend as a share of the budget for the same months, up to the data cut. Above 100% means spend runs ahead of budget.

- Id: `budget_burn_vs_plan`, version 1.0.0, certified.
- Formula: (sum of actual_usd over gold.fct_spend rows) / (sum of budget_usd over gold.fct_spend rows).
- Unit: share of budget. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `vendor`, `month`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: Budget burn (`budget-burn-term`).

### Cost per enrolled subject

Actual spend up to the data cut divided by the number of subjects enrolled. The gold model holds no randomisation fact, so the denominator is enrolled rather than randomised subjects.

- Id: `cost_per_enrolled_subject`, version 1.0.0, certified.
- Formula: (sum of actual_usd over gold.fct_spend rows) / (count of gold.fct_enrollment rows where event_type = 'enrolled').
- Unit: USD per enrolled subject. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: Enrollment (`enrollment-term`).

### Actual spend

Actual spend booked up to the data cut, in US dollars, with each quarter spread evenly over its three months.

- Id: `actual_spend`, version 1.0.0, certified.
- Formula: sum of actual_usd over gold.fct_spend rows.
- Unit: USD. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `vendor`, `month`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: Budget burn (`budget-burn-term`).

### Budget at completion

The budget booked up to the data cut plus the planned budget for every quarter after it, up to the planned final report. Once the final report is in, nothing remains and it is the budget booked.

- Id: `budget_at_completion`, version 1.0.0, certified.
- Formula: sum of budget_at_completion_usd over gold.fct_spend_forecast rows.
- Unit: USD. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `vendor`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: Forecast at completion (`forecast-at-completion-term`).

### Forecast at completion

Actual spend up to the data cut plus the planned budget still to come, scaled by each vendor's actual spend over its budget to date. A vendor running 10% over budget is forecast to stay 10% over for the rest of the study. Each vendor is forecast on its own ratio, so the vendors add up to the study.

- Id: `forecast_at_completion`, version 1.0.0, certified.
- Formula: sum of forecast_at_completion_usd over gold.fct_spend_forecast rows.
- Unit: USD. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `vendor`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: Forecast at completion (`forecast-at-completion-term`).

### Variance at completion

Forecast at completion minus budget at completion. Above 0 is a forecast overrun, below 0 an underrun, the same sign as spend variance.

- Id: `variance_at_completion`, version 1.0.0, certified.
- Formula: sum of variance_at_completion_usd over gold.fct_spend_forecast rows.
- Unit: USD. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `vendor`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: Forecast at completion (`forecast-at-completion-term`).

### Forecast against budget at completion

Forecast at completion as a share of the budget at completion. Above 100% means the study or vendor is forecast to overrun its budget.

- Id: `forecast_vs_budget_at_completion`, version 1.0.0, certified.
- Formula: (sum of forecast_at_completion_usd over gold.fct_spend_forecast rows) / (sum of budget_at_completion_usd over gold.fct_spend_forecast rows).
- Unit: share of budget. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `vendor`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: Forecast at completion (`forecast-at-completion-term`).

## Dimensions

| Dimension | Id | Attribute | Description |
| --- | --- | --- | --- |
| Study | `study` | `gold.dim_study.study_id` | Protocol id, for example DEMO-301. |
| Study status | `study_status` | `gold.dim_study.study_status` | Lifecycle status of the study at the data cut. |
| Therapeutic area | `therapeutic_area` | `gold.dim_study.therapeutic_area` | Therapeutic area of the study. |
| Phase | `phase` | `gold.dim_study.phase` | Development phase or device study stage. |
| Product type | `product_type` | `gold.dim_study.product_type` | Investigational product type: drug, biologic or device. |
| Operating model | `operating_model` | `gold.dim_study.operating_model` | Who runs the study: the sponsor or a CRO. |
| Site | `site` | `gold.dim_site.site_id` | Site id; every version of a site rolls up to it. |
| Country | `country` | `gold.dim_country.country_code` | ISO 3166-1 alpha-2 country code of the site. |
| Region | `region` | `gold.dim_country.region` | Operational region of the site's country. |
| Month | `month` | `gold.dim_date.year_month` | Calendar month, as YYYY-MM, of the date each measure is dated by. |
| Vendor | `vendor` | `gold.dim_vendor.vendor_name` | Fictional vendor name; investigator grants have none. |
| Deviation category | `deviation_category` | `gold.fct_deviation.deviation_category` | What a protocol deviation concerns, for example Informed consent process. |
| Deviation importance | `deviation_importance` | `gold.fct_deviation.importance` | Whether a protocol deviation is important (after ICH E3) or not. |
| Queried form | `queried_form` | `gold.fct_query.queried_form` | CRF form of the queried field, named by its CDASH domain, for example VS. |
| Screen failure reason | `screen_failure_reason` | `gold.fct_enrollment.screen_failure_reason` | Why screening failed, for example Inclusion criterion not met; empty for any subject who did not fail screening. |

## Not in the registry

Metrics a clinical operations or portfolio lead would expect that the
gold model cannot compute yet. They are left out rather than approximated.

| Metric | Why | Gold data it needs | Nearest registry metric |
| --- | --- | --- | --- |
| eTMF completeness | Expected and filed eTMF documents reach silver (silver.etmf_document) but no gold fact. | A gold fact of expected eTMF documents with due and filed date keys and the site and study keys. | none |
| Cost per randomised subject | Randomisations reach silver (silver.irt_randomization) but no gold fact. | A gold fact of randomisations with the study, site and date keys. | `cost_per_enrolled_subject` |
| Query rate per 100 CRF pages | No gold table counts the CRF pages a visit produces; sdv_pages_due counts only the pages due for source data verification. | The number of CRF pages entered per visit in gold.fct_visit. | `query_rate_per_100_visits` |
| Enrollment against a time-phased plan | Gold holds each site's total enrollment target but no planned enrollment by month. | Planned cumulative enrollment per study or site and month. | `enrollment_vs_plan` |
| Adverse event reporting rate (key risk indicator) | The operational gold marts hold no adverse events; they exist only in the Study Data Pipeline's SDTM for DEMO-301. | A gold fact of reported adverse events with the study, site and onset date keys for every study. | none |
| Primary endpoint missing data (quality tolerance limit) | Gold holds no endpoint assessments. | Planned and collected primary endpoint assessments per subject and visit. | none |
