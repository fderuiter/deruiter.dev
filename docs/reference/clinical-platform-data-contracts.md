# Clinical Data Platform data contracts

<!-- Generated from the data product registry by scripts/generate-data-contracts.ts. Do not edit by hand. -->

Synthetic data for demonstration. Every study, site, subject and vendor is fictional.

Every silver and gold table of the Clinical Data Platform
([ADR 0066](../../adr/0066-clinical-data-platform-architecture.md)) and
the Study Data Pipeline's SDTM and ADaM output is a data product with an
owner, a steward and a versioned data contract. A contract lists each
column's type, nullability, classification and limits, the primary key,
the service levels and the retention period. Columns, keys and
classifications are read from the
[star schema](clinical-platform-star-schema.md) and the pipeline's
metadata; ownership, service levels and retention are recorded once per
product. Each contract is also published as an
[Open Data Contract Standard](https://bitol-io.github.io/open-data-contract-standard/) v3.2.0
file in `__tests__/fixtures/clinical-platform/odcs/`, validated against the
standard's JSON schema. Regenerate this page, the ODCS files and the
contract lock with `npx tsx scripts/generate-data-contracts.ts`; a unit
test fails when they drift.

A unit test checks every generated dataset against its contract: schema conformance
(columns, types, lengths, patterns and the primary key), then
completeness of required values, freshness of the latest load and
publication of every table. A removed or retyped column, a column that
may now be null, a narrower limit, a stricter classification or a weaker
service level is breaking and needs a major version bump; an added
column or a stronger promise needs at least a minor one.

Classification runs public, internal, confidential, restricted. A
product holds personal health data when its rows describe study
subjects. The data is synthetic; the labels are the ones the real data
would carry.

## Products

| Product | Id | Domain | Owner | Steward | Classification | Personal health data | Freshness | Availability | Retention | Version |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Studies | `silver.study` | Portfolio | Portfolio Management Lead | Portfolio Data Steward | internal | No | 7 days | 99% | 10 years | 1.0.0 |
| Planned visits | `silver.planned_visit` | Portfolio | Portfolio Management Lead | Portfolio Data Steward | internal | No | 7 days | 99% | 10 years | 1.0.0 |
| Sites | `silver.site` | Site management | Clinical Operations Lead | Clinical Operations Data Steward | internal | No | 1 day | 99% | 10 years | 1.1.0 |
| Vendors | `silver.vendor` | Vendor management | Clinical Outsourcing Lead | Vendor Data Steward | internal | No | 7 days | 99% | 10 years | 1.0.0 |
| EDC subjects | `silver.edc_subject` | EDC | Clinical Data Management Lead | Clinical Data Steward | confidential | Yes | 1 day | 99% | 25 years | 1.1.0 |
| EDC visits | `silver.edc_visit` | EDC | Clinical Data Management Lead | Clinical Data Steward | confidential | Yes | 1 day | 99% | 25 years | 1.0.0 |
| EDC queries | `silver.edc_query` | EDC | Clinical Data Management Lead | Clinical Data Steward | confidential | Yes | 1 day | 99% | 25 years | 1.0.0 |
| EDC adverse events | `silver.edc_adverse_event` | EDC | Medical Safety Lead | Safety Data Steward | confidential | Yes | 1 day | 99% | 25 years | 1.0.0 |
| EDC vital signs | `silver.edc_vital_sign` | EDC | Clinical Data Management Lead | Clinical Data Steward | confidential | Yes | 1 day | 99% | 25 years | 1.0.0 |
| Study milestones | `silver.ctms_milestone` | CTMS | Portfolio Management Lead | Portfolio Data Steward | internal | No | 1 day | 99% | 10 years | 1.0.0 |
| Monitoring plans | `silver.ctms_monitoring_plan` | CTMS | Clinical Monitoring Lead | Clinical Operations Data Steward | internal | No | 7 days | 99% | 25 years | 1.0.0 |
| Monitoring visits | `silver.ctms_monitoring_visit` | CTMS | Clinical Monitoring Lead | Clinical Operations Data Steward | internal | No | 1 day | 99% | 25 years | 1.0.0 |
| Protocol deviations | `silver.ctms_deviation` | CTMS | Clinical Quality Lead | Clinical Quality Data Steward | confidential | Yes | 1 day | 99% | 25 years | 1.0.0 |
| Site staff assignments | `silver.ctms_site_staff` | CTMS | Clinical Operations Lead | Clinical Operations Data Steward | confidential | No | 1 day | 99% | 25 years | 1.0.0 |
| Randomisations | `silver.irt_randomization` | IRT | Clinical Supply Lead | IRT Data Steward | restricted | Yes | 1 day | 99% | 25 years | 1.0.0 |
| Drug kits | `silver.irt_kit` | IRT | Clinical Supply Lead | IRT Data Steward | confidential | Yes | 1 day | 99% | 25 years | 1.0.0 |
| TMF documents | `silver.etmf_document` | eTMF | Trial Master File Lead | TMF Data Steward | internal | No | 1 day | 99% | 25 years | 1.0.0 |
| Finance lines | `silver.finance_line` | Finance | Clinical Finance Lead | Finance Data Steward | confidential | No | 31 days | 99% | 10 years | 1.0.0 |
| Budget plan lines | `silver.finance_plan_line` | Finance | Clinical Finance Lead | Finance Data Steward | confidential | No | 31 days | 99% | 10 years | 1.0.0 |
| Event adjudications | `silver.cec_adjudication` | Clinical events committee | Medical Safety Lead | Safety Data Steward | confidential | Yes | 1 day | 99% | 25 years | 1.0.0 |
| Study dimension | `gold.dim_study` | Conformed dimensions | Portfolio Management Lead | Portfolio Data Steward | internal | No | 1 day | 99.5% | 10 years | 1.0.0 |
| Site dimension | `gold.dim_site` | Conformed dimensions | Clinical Operations Lead | Clinical Operations Data Steward | confidential | No | 1 day | 99.5% | 10 years | 1.1.0 |
| Country dimension | `gold.dim_country` | Conformed dimensions | Clinical Operations Lead | Clinical Operations Data Steward | public | No | 1 day | 99.5% | 10 years | 1.0.0 |
| Date dimension | `gold.dim_date` | Conformed dimensions | Data Platform Lead | Platform Data Steward | public | No | 1 day | 99.5% | 10 years | 1.0.0 |
| Vendor dimension | `gold.dim_vendor` | Conformed dimensions | Clinical Outsourcing Lead | Vendor Data Steward | internal | No | 1 day | 99.5% | 10 years | 1.0.0 |
| Milestone dimension | `gold.dim_milestone` | Conformed dimensions | Portfolio Management Lead | Portfolio Data Steward | public | No | 1 day | 99.5% | 10 years | 1.0.0 |
| Monitoring plan dimension | `gold.dim_monitoring_plan` | Conformed dimensions | Clinical Monitoring Lead | Clinical Operations Data Steward | internal | No | 7 days | 99.5% | 10 years | 1.0.0 |
| Enrollment facts | `gold.fct_enrollment` | Operations mart | Clinical Operations Lead | Clinical Operations Data Steward | confidential | Yes | 1 day | 99.5% | 10 years | 1.1.0 |
| Visit facts | `gold.fct_visit` | Operations mart | Clinical Data Management Lead | Clinical Data Steward | confidential | Yes | 1 day | 99.5% | 10 years | 1.1.0 |
| Query facts | `gold.fct_query` | Operations mart | Clinical Data Management Lead | Clinical Data Steward | confidential | Yes | 1 day | 99.5% | 10 years | 1.1.0 |
| Deviation facts | `gold.fct_deviation` | Operations mart | Clinical Quality Lead | Clinical Quality Data Steward | confidential | Yes | 1 day | 99.5% | 10 years | 1.0.0 |
| Event adjudication facts | `gold.fct_cec_adjudication` | Safety mart | Medical Safety Lead | Safety Data Steward | confidential | Yes | 1 day | 99.5% | 10 years | 1.0.0 |
| Adverse event facts | `gold.fct_adverse_event` | Safety mart | Medical Safety Lead | Safety Data Steward | confidential | Yes | 1 day | 99.5% | 10 years | 1.0.0 |
| Vital sign facts | `gold.fct_vital_sign` | RBQM mart | Clinical Data Management Lead | Clinical Data Steward | confidential | Yes | 1 day | 99.5% | 10 years | 1.0.0 |
| Monitoring visit facts | `gold.fct_monitoring_visit` | Operations mart | Clinical Monitoring Lead | Clinical Operations Data Steward | internal | No | 1 day | 99.5% | 10 years | 1.1.0 |
| Planned monitoring visit facts | `gold.fct_planned_monitoring_visit` | Operations mart | Clinical Monitoring Lead | Clinical Operations Data Steward | internal | No | 1 day | 99.5% | 10 years | 1.0.0 |
| Milestone facts | `gold.fct_milestone` | Portfolio mart | Portfolio Management Lead | Portfolio Data Steward | internal | No | 1 day | 99.5% | 10 years | 1.0.0 |
| Spend facts | `gold.fct_spend` | Finance mart | Clinical Finance Lead | Finance Data Steward | confidential | No | 31 days | 99.5% | 10 years | 1.0.0 |
| Spend forecast facts | `gold.fct_spend_forecast` | Finance mart | Clinical Finance Lead | Finance Data Steward | confidential | No | 31 days | 99.5% | 10 years | 1.0.0 |
| KRI snapshots | `gold.fct_kri_snapshot` | RBQM mart | Clinical Quality Lead | Clinical Quality Data Steward | internal | No | 1 day | 99.5% | 10 years | 1.0.0 |
| Study data: SDTM and ADaM | `study-data-pipeline` | Study data | Biostatistics Lead | Clinical Data Standards Steward | restricted | Yes | 30 days | 99.5% | 25 years | 2.15.0 |

## Retention

| Period | Basis | Products |
| --- | --- | --- |
| 10 years | Sponsor records policy for operational and derived data: a policy choice, not a regulatory minimum. | 27 |
| 25 years | Regulation (EU) No 536/2014, Article 58: the trial master file is archived for at least 25 years after the end of the trial. | 14 |

## Lineage and consumers

| Product | Upstream | Consumers |
| --- | --- | --- |
| `silver.study` | `bronze.portfolio.studies` | `gold.dim_study`, `gold.dim_site` |
| `silver.planned_visit` | `bronze.portfolio.studies` | `gold.fct_visit` |
| `silver.site` | `bronze.portfolio.sites` | `gold.dim_site`, `gold.dim_country`, `gold.fct_enrollment`, `gold.fct_visit`, `gold.fct_query`, `gold.fct_deviation`, `gold.fct_cec_adjudication`, `gold.fct_adverse_event`, `gold.fct_vital_sign`, `gold.fct_monitoring_visit`, `gold.fct_planned_monitoring_visit`, `gold.fct_kri_snapshot` |
| `silver.vendor` | `bronze.portfolio.vendors` | `gold.dim_vendor` |
| `silver.edc_subject` | `bronze.edc.subjects` | `gold.dim_site`, `gold.fct_enrollment`, `gold.fct_visit`, `gold.fct_kri_snapshot` |
| `silver.edc_visit` | `bronze.edc.visits` | `gold.fct_visit`, `gold.fct_kri_snapshot` |
| `silver.edc_query` | `bronze.edc.queries` | `gold.fct_query`, `gold.fct_kri_snapshot` |
| `silver.edc_adverse_event` | `bronze.edc.adverseEvents` | `gold.fct_adverse_event` |
| `silver.edc_vital_sign` | `bronze.edc.vitalSigns` | `gold.fct_vital_sign` |
| `silver.ctms_milestone` | `bronze.ctms.milestones` | `gold.dim_milestone`, `gold.fct_milestone`, `gold.fct_spend_forecast` |
| `silver.ctms_monitoring_plan` | `bronze.ctms.monitoringPlans` | `gold.dim_monitoring_plan`, `gold.fct_monitoring_visit`, `gold.fct_planned_monitoring_visit` |
| `silver.ctms_monitoring_visit` | `bronze.ctms.monitoringVisits` | `gold.dim_site`, `gold.fct_monitoring_visit`, `gold.fct_planned_monitoring_visit` |
| `silver.ctms_deviation` | `bronze.ctms.deviations` | `gold.fct_deviation`, `gold.fct_kri_snapshot` |
| `silver.ctms_site_staff` | `bronze.ctms.siteStaff` | `gold.dim_site` |
| `silver.irt_randomization` | `bronze.irt.randomizations` | None recorded |
| `silver.irt_kit` | `bronze.irt.kits` | None recorded |
| `silver.etmf_document` | `bronze.etmf` | None recorded |
| `silver.finance_line` | `bronze.finance` | `gold.fct_spend`, `gold.fct_spend_forecast` |
| `silver.finance_plan_line` | `bronze.financePlan` | `gold.fct_spend_forecast` |
| `silver.cec_adjudication` | `bronze.cec` | `gold.fct_cec_adjudication` |
| `gold.dim_study` | `silver.study` | `gold.fct_enrollment`, `gold.fct_visit`, `gold.fct_query`, `gold.fct_deviation`, `gold.fct_cec_adjudication`, `gold.fct_adverse_event`, `gold.fct_vital_sign`, `gold.fct_monitoring_visit`, `gold.fct_planned_monitoring_visit`, `gold.fct_milestone`, `gold.fct_spend`, `gold.fct_spend_forecast`, `gold.fct_kri_snapshot` |
| `gold.dim_site` | `silver.ctms_monitoring_visit`, `silver.ctms_site_staff`, `silver.edc_subject`, `silver.site`, `silver.study` | `gold.fct_enrollment`, `gold.fct_visit`, `gold.fct_query`, `gold.fct_deviation`, `gold.fct_cec_adjudication`, `gold.fct_adverse_event`, `gold.fct_vital_sign`, `gold.fct_monitoring_visit`, `gold.fct_planned_monitoring_visit`, `gold.fct_kri_snapshot`, `enrollment_vs_plan`, `site_activation_cycle_time`, `sites_selected`, `sites_contracted`, `sites_irb_approved`, `sites_initiated`, `sites_activated`, `sites_with_first_subject_in`, `selection_to_contract_days`, `contract_to_irb_approval_days`, `irb_approval_to_initiation_days`, `initiation_to_activation_days`, `activation_to_first_subject_in_days` |
| `gold.dim_country` | `silver.site` | `gold.fct_enrollment`, `gold.fct_visit`, `gold.fct_query`, `gold.fct_deviation`, `gold.fct_cec_adjudication`, `gold.fct_adverse_event`, `gold.fct_vital_sign`, `gold.fct_monitoring_visit`, `gold.fct_planned_monitoring_visit`, `gold.fct_kri_snapshot` |
| `gold.dim_date` | None | None recorded |
| `gold.dim_vendor` | `silver.vendor` | `gold.fct_spend`, `gold.fct_spend_forecast` |
| `gold.dim_milestone` | `silver.ctms_milestone` | `gold.fct_milestone` |
| `gold.dim_monitoring_plan` | `silver.ctms_monitoring_plan` | `gold.fct_monitoring_visit`, `gold.fct_planned_monitoring_visit` |
| `gold.fct_enrollment` | `gold.dim_country`, `gold.dim_site`, `gold.dim_study`, `silver.edc_subject`, `silver.site` | `subjects_screened`, `subjects_enrolled`, `enrollment_vs_plan`, `screen_failure_rate`, `screen_failures`, `early_termination_rate`, `important_deviation_rate`, `non_important_deviation_rate`, `subjects_with_important_deviation`, `cost_per_enrolled_subject` |
| `gold.fct_visit` | `gold.dim_country`, `gold.dim_site`, `gold.dim_study`, `silver.edc_subject`, `silver.edc_visit`, `silver.planned_visit`, `silver.site` | `data_entry_lag_median`, `data_entry_lag_p90`, `data_entry_lag_mean`, `missed_visit_rate`, `out_of_window_visit_rate`, `query_rate_per_100_visits` |
| `gold.fct_query` | `gold.dim_country`, `gold.dim_site`, `gold.dim_study`, `silver.edc_query`, `silver.site` | `query_rate_per_100_visits`, `open_query_count`, `query_aging_mean`, `query_resolution_time_median`, `open_queries_aged_0_7_days`, `open_queries_aged_8_30_days`, `open_queries_aged_31_60_days`, `open_queries_aged_over_60_days` |
| `gold.fct_deviation` | `gold.dim_country`, `gold.dim_site`, `gold.dim_study`, `silver.ctms_deviation`, `silver.site` | `important_deviation_rate`, `non_important_deviation_rate`, `subjects_with_important_deviation`, `protocol_deviation_count` |
| `gold.fct_cec_adjudication` | `gold.dim_country`, `gold.dim_site`, `gold.dim_study`, `silver.cec_adjudication`, `silver.site` | `cec_events_reported`, `cec_events_adjudicated`, `cec_adjudication_backlog`, `cec_adjudication_time_median` |
| `gold.fct_adverse_event` | `gold.dim_country`, `gold.dim_site`, `gold.dim_study`, `silver.edc_adverse_event`, `silver.site` | None recorded |
| `gold.fct_vital_sign` | `gold.dim_country`, `gold.dim_site`, `gold.dim_study`, `silver.edc_vital_sign`, `silver.site` | None recorded |
| `gold.fct_monitoring_visit` | `gold.dim_country`, `gold.dim_monitoring_plan`, `gold.dim_site`, `gold.dim_study`, `silver.ctms_monitoring_plan`, `silver.ctms_monitoring_visit`, `silver.site` | `sdv_completion`, `monitoring_reports_overdue`, `monitoring_report_cycle_time_median` |
| `gold.fct_planned_monitoring_visit` | `gold.dim_country`, `gold.dim_monitoring_plan`, `gold.dim_site`, `gold.dim_study`, `silver.ctms_monitoring_plan`, `silver.ctms_monitoring_visit`, `silver.site` | `monitoring_visits_overdue` |
| `gold.fct_milestone` | `gold.dim_milestone`, `gold.dim_study`, `silver.ctms_milestone` | `protocol_final_to_fpi_days`, `fpi_to_lpi_days`, `lplv_to_dbl_days` |
| `gold.fct_spend` | `gold.dim_study`, `gold.dim_vendor`, `silver.finance_line` | `budget_burn_vs_plan`, `cost_per_enrolled_subject`, `actual_spend` |
| `gold.fct_spend_forecast` | `gold.dim_study`, `gold.dim_vendor`, `silver.ctms_milestone`, `silver.finance_line`, `silver.finance_plan_line` | `budget_at_completion`, `forecast_at_completion`, `variance_at_completion`, `forecast_vs_budget_at_completion` |
| `gold.fct_kri_snapshot` | `gold.dim_country`, `gold.dim_site`, `gold.dim_study`, `silver.ctms_deviation`, `silver.edc_query`, `silver.edc_subject`, `silver.edc_visit`, `silver.site` | None recorded |
| `study-data-pipeline` | `usdm.DEMO-301` | None recorded |

## Study data datasets (`study-data-pipeline`)

| Dataset | Description | Structure | Key | Variables |
| --- | --- | --- | --- | --- |
| TA | Trial Arms | One record per planned element per arm | STUDYID, ARMCD, TAETORD | 10 |
| TE | Trial Elements | One record per planned element | STUDYID, ETCD | 7 |
| TV | Trial Visits | One record per planned visit | STUDYID, VISITNUM | 8 |
| TI | Trial Inclusion Exclusion Criteria | One record per inclusion or exclusion criterion | STUDYID, IETESTCD | 5 |
| TS | Trial Summary | One record per trial summary parameter value | STUDYID, TSPARMCD, TSSEQ | 9 |
| DM | Demographics | One record per subject | STUDYID, USUBJID | 24 |
| SV | Subject Visits | One record per actual or planned visit per subject | STUDYID, USUBJID, VISITNUM | 11 |
| EX | Exposure | One record per constant-dosing interval per subject | STUDYID, USUBJID, EXSEQ | 13 |
| CM | Concomitant/Prior Medications | One record per recorded intervention occurrence or constant-dosing interval per subject | STUDYID, USUBJID, CMSEQ | 21 |
| AE | Adverse Events | One record per adverse event per subject | STUDYID, USUBJID, AESEQ | 31 |
| MH | Medical History | One record per medical history event per subject | STUDYID, USUBJID, MHSEQ | 14 |
| IE | Inclusion/Exclusion Criteria Not Met | One record per inclusion/exclusion criterion not met per subject | STUDYID, USUBJID, IETESTCD | 13 |
| VS | Vital Signs | One record per vital sign measurement per visit per subject | STUDYID, USUBJID, VSSEQ | 17 |
| LB | Laboratory Test Results | One record per lab test per visit per subject | STUDYID, USUBJID, LBSEQ | 23 |
| EG | ECG Test Results | One record per ECG observation per replicate per time point or one record per ECG observation per beat per visit per subject | STUDYID, USUBJID, EGSEQ | 17 |
| DS | Disposition | One record per disposition status or protocol milestone per subject | STUDYID, USUBJID, DSSEQ | 10 |
| SUPPDM | Supplemental Qualifiers for DM | One record per supplemental qualifier per subject | STUDYID, RDOMAIN, USUBJID, QNAM | 10 |
| RELREC | Related Records | One record per related record per relationship | STUDYID, RDOMAIN, USUBJID, IDVAR, IDVARVAL, RELID | 7 |
| SE | Subject Elements | One record per actual Element per subject | STUDYID, USUBJID, ETCD, SESTDTC | 13 |
| CO | Comments | One record per comment per subject | STUDYID, USUBJID, COSEQ | 8 |
| ADSL | Subject-Level Analysis Dataset | One record per subject | STUDYID, USUBJID | 26 |
| ADVS | Vital Signs Analysis | One or more records per subject per parameter per analysis visit | STUDYID, USUBJID, ASEQ | 27 |
| ADLB | Laboratory Analysis | One or more records per subject per parameter per analysis visit | STUDYID, USUBJID, ASEQ | 27 |
| ADEG | ECG Analysis | One or more records per subject per parameter per analysis visit | STUDYID, USUBJID, ASEQ | 32 |
| ADAE | Adverse Events Analysis | One record per adverse event per subject | STUDYID, USUBJID, ASEQ | 27 |
| ADCM | Concomitant Meds Analysis | One record per medication per subject | STUDYID, USUBJID, ASEQ | 29 |
| ADTTE | Time-to-Event Analysis | One record per subject per parameter | STUDYID, USUBJID, ASEQ | 22 |
| ADHCE | Hierarchical Composite | One record per subject per hierarchy component | STUDYID, USUBJID, ASEQ | 17 |
