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
| Early termination rate | `early_termination_rate` | certified | 1.0.0 | portfolio | 8.3% |
| Site activation cycle time | `site_activation_cycle_time` | certified | 1.0.0 | portfolio | 154.0 days |
| Data entry lag (median) | `data_entry_lag_median` | certified | 1.0.0 | portfolio | 2.0 days |
| Data entry lag (90th percentile) | `data_entry_lag_p90` | certified | 1.0.0 | portfolio | 9.0 days |
| Data entry lag (mean) | `data_entry_lag_mean` | certified | 1.0.0 | portfolio | 3.5 days |
| Missed visit rate | `missed_visit_rate` | certified | 1.0.0 | portfolio | 1.9% |
| Out-of-window visit rate | `out_of_window_visit_rate` | certified | 1.0.0 | portfolio | 3.1% |
| Query rate per 100 visits | `query_rate_per_100_visits` | certified | 1.0.0 | portfolio | 47.0 queries per 100 visits |
| Open queries | `open_query_count` | certified | 1.0.0 | portfolio | 36 queries |
| Query aging | `query_aging_mean` | certified | 1.0.0 | portfolio | 2.9 days |
| Query resolution time (median) | `query_resolution_time_median` | certified | 1.0.0 | portfolio | 5.0 days |
| SDV completion | `sdv_completion` | certified | 1.0.0 | portfolio | 85.3% |
| Overdue monitoring visit reports | `monitoring_reports_overdue` | draft | 1.0.0 | portfolio | 1 monitoring visits |
| Monitoring report cycle time (median) | `monitoring_report_cycle_time_median` | certified | 1.0.0 | portfolio | 14.0 days |
| Important deviations per 100 subjects | `important_deviation_rate` | certified | 1.0.0 | portfolio | 13.7 deviations per 100 enrolled subjects |
| Non-important deviations per 100 subjects | `non_important_deviation_rate` | certified | 1.0.0 | portfolio | 13.1 deviations per 100 enrolled subjects |
| Subjects with an important deviation | `subjects_with_important_deviation` | certified | 1.0.0 | portfolio | 12.9% |
| First subject in to last subject in | `fpi_to_lpi_days` | certified | 1.0.0 | study | DEMO-101: 128 days; DEMO-201: 457 days; DEMO-202: 527 days; DEMO-203: 442 days; DEMO-301: 176 days; DEV-401: 201 days |
| Last subject last visit to database lock | `lplv_to_dbl_days` | certified | 1.0.0 | study | DEMO-101: 75 days; DEMO-301: 46 days; DEV-401: 43 days |
| Budget burn vs plan | `budget_burn_vs_plan` | certified | 1.0.0 | portfolio | 103.6% |
| Cost per enrolled subject | `cost_per_enrolled_subject` | certified | 1.0.0 | portfolio | $37,839 |

## Enrollment

### Subjects screened

Subjects who entered screening, counted on their screening date. Each counts once, whatever the screening outcome.

- Id: `subjects_screened`, version 1.0.0, certified.
- Formula: count of gold.fct_enrollment rows where event_type = 'screened'.
- Unit: subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

### Subjects enrolled

Subjects enrolled into a study, counted on their enrollment date. Subjects who later completed or discontinued still count.

- Id: `subjects_enrolled`, version 1.0.0, certified.
- Formula: count of gold.fct_enrollment rows where event_type = 'enrolled'.
- Unit: subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

### Enrollment vs plan

Enrolled subjects as a share of the planned enrollment, the sum of the current site targets. The plan is the whole-study target, not a time-phased curve, so an enrolling study is expected to sit below 100%.

- Id: `enrollment_vs_plan`, version 1.0.0, certified.
- Formula: (count of gold.fct_enrollment rows where event_type = 'enrolled') / (sum of planned_enrollment over gold.dim_site rows where is_current = true).
- Unit: share of target. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

### Screen failure rate

Share of screened subjects whose screening ended in a screen failure, by screening date. Subjects still in screening at the data cut have no outcome yet and are left out of both counts.

- Id: `screen_failure_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_enrollment rows where event_type = 'screened' and subject_status = 'screen-failed') / (count of gold.fct_enrollment rows where event_type = 'screened' and subject_status <> 'screening').
- Unit: share of screened subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

### Early termination rate

Subjects who discontinued before completing the study, as a share of subjects enrolled.

- Id: `early_termination_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_enrollment rows where event_type = 'discontinued') / (count of gold.fct_enrollment rows where event_type = 'enrolled').
- Unit: share of enrolled subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

## Site start-up

### Site activation cycle time

Median days from the study's protocol finalisation to a site's activation, over activated sites. Protocol finalisation is gold.dim_study.start_on; the metric reads it as the first day of the site's first gold.dim_site version, which the gold build opens on that date.

- Id: `site_activation_cycle_time`, version 1.0.0, certified.
- Formula: median of days from valid_from to activated_on over gold.dim_site rows where version_number = 1 and activated_on is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `site`, `country`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

## Visits and data entry

### Data entry lag (median)

Median days from a visit to the entry of its data in the EDC, over visits with data entered.

- Id: `data_entry_lag_median`, version 1.0.0, certified.
- Formula: median of entry_lag_days over gold.fct_visit rows where entry_lag_days is not null and visit_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: `edc-term`.

### Data entry lag (90th percentile)

90th percentile of days from a visit to the entry of its data in the EDC, interpolated linearly between ranked values. It shows the slow tail the median hides.

- Id: `data_entry_lag_p90`, version 1.0.0, certified.
- Formula: 90th percentile of entry_lag_days over gold.fct_visit rows where entry_lag_days is not null and visit_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: `edc-term`.

### Data entry lag (mean)

Mean days from a visit to the entry of its data in the EDC, over visits with data entered. The key risk indicator for entry timeliness.

- Id: `data_entry_lag_mean`, version 1.0.0, certified.
- Formula: mean of entry_lag_days over gold.fct_visit rows where entry_lag_days is not null and visit_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: `edc-term`.

### Missed visit rate

Missed visits as a share of all visits due by the data cut, dated by the planned visit date.

- Id: `missed_visit_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_visit rows where visit_status = 'missed') / (count of gold.fct_visit rows).
- Unit: share of visits due. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

### Out-of-window visit rate

Visits performed outside their protocol window, as a share of visits performed.

- Id: `out_of_window_visit_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_visit rows where visit_date_key is not null and is_out_of_window = true) / (count of gold.fct_visit rows where visit_date_key is not null).
- Unit: share of visits performed. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Operations Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

## Queries

### Query rate per 100 visits

Data queries opened per 100 visits performed. The gold model holds no CRF page counts, so the rate is per visit rather than per 100 CRF pages.

- Id: `query_rate_per_100_visits`, version 1.0.0, certified.
- Formula: (count of gold.fct_query rows) / (count of gold.fct_visit rows where visit_date_key is not null), times 100.
- Unit: queries per 100 visits. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: none yet.

### Open queries

Queries not closed at the data cut: still open, or answered by the site and awaiting review. Closed studies are left out by default, because their backlog is history.

- Id: `open_query_count`, version 1.0.0, certified.
- Formula: count of gold.fct_query rows where query_status in ('open', 'answered').
- Unit: queries. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: none yet.

### Query aging

Mean days from opening to the data cut of the queries not closed at the cut. Closed studies are left out by default, because their backlog is history.

- Id: `query_aging_mean`, version 1.0.0, certified.
- Formula: mean of days from date(opened_date_key) to the data cut over gold.fct_query rows where query_status in ('open', 'answered').
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: none yet.

### Query resolution time (median)

Median calendar days from a query's opening to its closing, over closed queries. Days are counted between UTC dates.

- Id: `query_resolution_time_median`, version 1.0.0, certified.
- Formula: median of days from date(opened_date_key) to date(closed_date_key) over gold.fct_query rows where closed_date_key is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Data Management Lead. Steward: Clinical Data Steward.
- Glossary term: none yet.

## Monitoring

### SDV completion

CRF pages source-verified at monitoring visits as a share of the pages due for source data verification at those visits.

- Id: `sdv_completion`, version 1.0.0, certified.
- Formula: (sum of sdv_pages_verified over gold.fct_monitoring_visit rows) / (sum of sdv_pages_due over gold.fct_monitoring_visit rows).
- Unit: share of pages due. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Monitoring Lead. Steward: Clinical Operations Data Steward.
- Glossary term: `sdv-term`.

### Overdue monitoring visit reports

Monitoring visits whose report was still not final more than 20 days after the visit, at the data cut. The 20-day target is an assumption of this registry rather than a sourced standard, so the metric stays a draft, which certified reports cannot use, until a monitoring plan supplies the reporting deadline.

- Id: `monitoring_reports_overdue`, version 1.0.0, draft.
- Formula: count of gold.fct_monitoring_visit rows where report_final_date_key is null and days from date(visit_date_key) to the data cut > 20.
- Unit: monitoring visits. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: `study_status` not in `closed`.
- Owner: Clinical Monitoring Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

### Monitoring report cycle time (median)

Median days from a monitoring visit to its final report, over visits whose report is final.

- Id: `monitoring_report_cycle_time_median`, version 1.0.0, certified.
- Formula: median of days_to_final_report over gold.fct_monitoring_visit rows where days_to_final_report is not null.
- Unit: days. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`, `month`.
- Default filters: none.
- Owner: Clinical Monitoring Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

## Protocol deviations

### Important deviations per 100 subjects

Protocol deviations classed as important (after ICH E3) per 100 enrolled subjects.

- Id: `important_deviation_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_deviation rows where is_important = true) / (count of gold.fct_enrollment rows where event_type = 'enrolled'), times 100.
- Unit: deviations per 100 enrolled subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`.
- Default filters: none.
- Owner: Clinical Quality Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

### Non-important deviations per 100 subjects

Protocol deviations not classed as important per 100 enrolled subjects.

- Id: `non_important_deviation_rate`, version 1.0.0, certified.
- Formula: (count of gold.fct_deviation rows where is_important = false) / (count of gold.fct_enrollment rows where event_type = 'enrolled'), times 100.
- Unit: deviations per 100 enrolled subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`.
- Default filters: none.
- Owner: Clinical Quality Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

### Subjects with an important deviation

Share of enrolled subjects with at least one important protocol deviation, a common study-level quality tolerance limit parameter.

- Id: `subjects_with_important_deviation`, version 1.0.0, certified.
- Formula: (distinct count of subject_id over gold.fct_deviation rows where is_important = true) / (count of gold.fct_enrollment rows where event_type = 'enrolled').
- Unit: share of enrolled subjects. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `site`, `country`, `region`.
- Default filters: none.
- Owner: Clinical Quality Lead. Steward: Clinical Operations Data Steward.
- Glossary term: none yet.

## Milestones

### First subject in to last subject in

Days from the first subject's enrollment to the last subject's in one study: the enrollment period. A study that has not reached both milestones has no value.

- Id: `fpi_to_lpi_days`, version 1.0.0, certified.
- Formula: days from the actual first-subject-in date to the actual last-subject-in date in gold.fct_milestone, per study.
- Unit: days. Grain: study.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`.
- Default filters: none.
- Owner: Portfolio Management Lead. Steward: Portfolio Data Steward.
- Glossary term: none yet.

### Last subject last visit to database lock

Days from the last subject's last visit to database lock in one study. A study that has not reached both milestones has no value.

- Id: `lplv_to_dbl_days`, version 1.0.0, certified.
- Formula: days from the actual last-subject-last-visit date to the actual database-lock date in gold.fct_milestone, per study.
- Unit: days. Grain: study.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`.
- Default filters: none.
- Owner: Portfolio Management Lead. Steward: Portfolio Data Steward.
- Glossary term: none yet.

## Finance

### Budget burn vs plan

Actual spend as a share of the budget for the same months, up to the data cut. Above 100% means spend runs ahead of budget.

- Id: `budget_burn_vs_plan`, version 1.0.0, certified.
- Formula: (sum of actual_usd over gold.fct_spend rows) / (sum of budget_usd over gold.fct_spend rows).
- Unit: share of budget. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`, `vendor`, `month`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: none yet.

### Cost per enrolled subject

Actual spend up to the data cut divided by the number of subjects enrolled. The gold model holds no randomisation fact, so the denominator is enrolled rather than randomised subjects.

- Id: `cost_per_enrolled_subject`, version 1.0.0, certified.
- Formula: (sum of actual_usd over gold.fct_spend rows) / (count of gold.fct_enrollment rows where event_type = 'enrolled').
- Unit: USD per enrolled subject. Grain: portfolio.
- Dimensions: `study`, `study_status`, `therapeutic_area`, `phase`, `product_type`, `operating_model`.
- Default filters: none.
- Owner: Clinical Finance Lead. Steward: Finance Data Steward.
- Glossary term: none yet.

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

## Not in the registry

Metrics a clinical operations or portfolio lead would expect that the
gold model cannot compute yet. They are left out rather than approximated.

| Metric | Why | Gold data it needs | Nearest registry metric |
| --- | --- | --- | --- |
| eTMF completeness | Expected and filed eTMF documents reach silver (silver.etmf_document) but no gold fact. | A gold fact of expected eTMF documents with due and filed date keys and the site and study keys. | none |
| Forecast at completion | gold.fct_spend holds budget only for months up to the data cut, so there is no budget at completion to forecast against. | The approved budget for future periods, or a budget at completion per study and vendor. | `budget_burn_vs_plan` |
| Cost per randomised subject | Randomisations reach silver (silver.irt_randomization) but no gold fact. | A gold fact of randomisations with the study, site and date keys. | `cost_per_enrolled_subject` |
| Query rate per 100 CRF pages | No gold table counts the CRF pages a visit produces; sdv_pages_due counts only the pages due for source data verification. | The number of CRF pages entered per visit in gold.fct_visit. | `query_rate_per_100_visits` |
| Monitoring visits overdue against the monitoring plan | Gold holds the monitoring visits that happened, not the ones the monitoring plan scheduled. | Planned monitoring visit dates, or the planned interval, per site. | `monitoring_reports_overdue` |
| Enrollment against a time-phased plan | Gold holds each site's total enrollment target but no planned enrollment by month. | Planned cumulative enrollment per study or site and month. | `enrollment_vs_plan` |
| Adverse event reporting rate (key risk indicator) | The operational gold marts hold no adverse events; they exist only in the Study Data Pipeline's SDTM for DEMO-301. | A gold fact of reported adverse events with the study, site and onset date keys for every study. | none |
| Primary endpoint missing data (quality tolerance limit) | Gold holds no endpoint assessments. | Planned and collected primary endpoint assessments per subject and visit. | none |
